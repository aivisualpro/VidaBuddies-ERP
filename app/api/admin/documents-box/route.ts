import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaSupplier from "@/lib/models/VidaSupplier";
import VidaPO from "@/lib/models/VidaPO";
import VBcustomerPO from "@/lib/models/VBcustomerPO";
import VBshipping from "@/lib/models/VBshipping";

export const dynamic = "force-dynamic";

/** Flatten driveDocuments array into the DocumentsBox entity format */
function flattenDriveDocs(docs: any[]): { docName: string; files: any[] }[] {
  if (!Array.isArray(docs) || docs.length === 0) return [];
  // Group all files under a single "Documents" group
  const files = docs.map((d: any) => ({
    _id: d._id?.toString() || d.driveFileId || "",
    fileName: d.documentName || d.fileName || "Untitled",
    fileId: d.driveFileId || d.fileId || "",
    fileLink: d.documentLink || d.fileLink || "",
    isVerified: d.isVerified || false,
    expiryDate: d.expiryDate || null,
    createdBy: d.createdBy || "",
    createdAt: d.createdAt || "",
  }));
  return files.length > 0 ? [{ docName: "Documents", files }] : [];
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") || "suppliers";

    await connectToDatabase();

    if (category === "suppliers") {
      // Get all suppliers that have at least one document with uploaded files
      const suppliers = await VidaSupplier.find({
        isDeleted: { $ne: true },
        "documents.files.0": { $exists: true },
      })
        .select("name vbId documents")
        .lean();

      // Flatten: each supplier -> list of docs -> list of files
      const result = suppliers.map((s: any) => ({
        _id: s._id,
        entityName: s.name,
        entityId: s.vbId,
        documents: (s.documents || [])
          .filter((d: any) => d.files && d.files.length > 0)
          .map((d: any) => ({
            docName: d.name,
            files: d.files.map((f: any) => ({
              _id: f._id?.toString(),
              fileName: f.fileName,
              fileId: f.fileId,
              fileLink: f.fileLink,
              isVerified: f.isVerified,
              expiryDate: f.expiryDate,
              createdBy: f.createdBy,
              createdAt: f.createdAt,
            })),
          })),
      }));

      return NextResponse.json(result);
    }

    if (category === "purchase-orders") {
      // Fetch all POs that have driveDocuments
      const pos = await VidaPO.find({
        "driveDocuments.0": { $exists: true },
      })
        .select("VBNumber driveDocuments")
        .lean();

      // Fetch all CPOs that have driveDocuments
      const cpos = await VBcustomerPO.find({
        "driveDocuments.0": { $exists: true },
      })
        .select("VBNumber VBSerialNumber driveDocuments")
        .lean();

      // Fetch all shippings that have driveDocuments
      const ships = await VBshipping.find({
        "driveDocuments.0": { $exists: true },
      })
        .select("VBNumber VBShipmentNumber svbid driveDocuments")
        .lean();

      // Build a map of PO _id -> VBNumber for label resolution
      const allPOs = await VidaPO.find({}).select("VBNumber").lean();
      const poNameMap: Record<string, string> = {};
      allPOs.forEach((p: any) => {
        poNameMap[p._id.toString()] = p.VBNumber || p._id.toString();
      });

      // Group everything by PO VBNumber
      const grouped: Record<string, {
        _id: string;
        entityName: string;
        entityId: string;
        documents: { docName: string; files: any[] }[];
      }> = {};

      // Helper to ensure a group exists
      const ensureGroup = (poId: string, poLabel: string) => {
        if (!grouped[poId]) {
          grouped[poId] = {
            _id: poId,
            entityName: poLabel,
            entityId: poLabel,
            documents: [],
          };
        }
      };

      // PO-level documents
      for (const po of pos) {
        const poId = (po as any)._id.toString();
        const poLabel = (po as any).VBNumber || poId;
        ensureGroup(poId, poLabel);
        const poDocs = flattenDriveDocs((po as any).driveDocuments);
        if (poDocs.length > 0) {
          // Label the group as the PO number
          poDocs[0].docName = `${poLabel} (PO)`;
          grouped[poId].documents.push(...poDocs);
        }
      }

      // CPO-level documents
      for (const cpo of cpos) {
        const vbNumberRef = (cpo as any).VBNumber?.toString() || "";
        const poLabel = poNameMap[vbNumberRef] || vbNumberRef;
        const poId = vbNumberRef || (cpo as any)._id.toString();
        ensureGroup(poId, poLabel);
        const cpoDocs = flattenDriveDocs((cpo as any).driveDocuments);
        if (cpoDocs.length > 0) {
          cpoDocs[0].docName = `${(cpo as any).VBSerialNumber || "CPO"} (Customer PO)`;
          grouped[poId].documents.push(...cpoDocs);
        }
      }

      // Shipping-level documents
      for (const ship of ships) {
        const vbNumberRef = (ship as any).VBNumber?.toString() || "";
        const poLabel = poNameMap[vbNumberRef] || vbNumberRef;
        const poId = vbNumberRef || (ship as any)._id.toString();
        ensureGroup(poId, poLabel);
        const shipDocs = flattenDriveDocs((ship as any).driveDocuments);
        if (shipDocs.length > 0) {
          shipDocs[0].docName = `${(ship as any).VBShipmentNumber || (ship as any).svbid || "Shipment"} (Shipping)`;
          grouped[poId].documents.push(...shipDocs);
        }
      }

      // Convert to array and sort by entityName
      const result = Object.values(grouped).sort((a, b) =>
        a.entityName.localeCompare(b.entityName)
      );

      return NextResponse.json(result);
    }

    // For other categories, return empty for now (extensible)
    return NextResponse.json([]);
  } catch (error: any) {
    console.error("Documents box error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
