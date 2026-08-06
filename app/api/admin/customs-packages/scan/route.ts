import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import CustomsPackage from "@/lib/models/CustomsPackage";
import VBshipping from "@/lib/models/VBshipping";
import { listFiles } from "@/lib/google-drive";
import { classifyFileName, folderScanPolicy, defaultDocState, requiredDocsFor, type CustomsRoute, type DocType } from "@/lib/customs/rules";

/**
 * POST /api/admin/customs-packages/scan
 * { packageId, folderId }  → folderId is the shipment's Drive folder.
 *
 * Scans the shipment folder (one level of subfolders — matches the standard
 * directory structure), classifies files deterministically by name, matches
 * them to the route's document requirements, and returns the updated package.
 *
 * Folder policy (spec §4): EXPENSES excluded by default, Customer/Supplier PO
 * folders reference-only, Generated Customs Packages never re-ingested.
 * Also auto-updates the shipment's existing document toggles (Appendix C).
 */

const FOLDER_MIME = "application/vnd.google-apps.folder";

interface ScannedFile {
  id: string;
  name: string;
  webViewLink?: string;
  folderName: string;
  policy: "INCLUDE" | "REFERENCE" | "EXCLUDE";
  docType: DocType;
}

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const { packageId, folderId } = await req.json();
    if (!packageId || !folderId) {
      return NextResponse.json({ error: "packageId and folderId required" }, { status: 400 });
    }

    const pkg: any = await CustomsPackage.findById(packageId);
    if (!pkg) return NextResponse.json({ error: "Package not found" }, { status: 404 });

    // ── Collect files: root + one level of subfolders ──
    const scanned: ScannedFile[] = [];
    const rootFiles: any[] = await listFiles(folderId);
    const subFolders = rootFiles.filter((f) => f.mimeType === FOLDER_MIME);

    for (const f of rootFiles) {
      if (f.mimeType === FOLDER_MIME) continue;
      scanned.push({
        id: f.id,
        name: f.name,
        webViewLink: f.webViewLink,
        folderName: "",
        policy: "INCLUDE",
        docType: classifyFileName(f.name),
      });
    }
    const subLists = await Promise.all(
      subFolders.map(async (sf) => ({ folder: sf, files: (await listFiles(sf.id).catch(() => [])) as any[] }))
    );
    for (const { folder, files } of subLists) {
      const policy = folderScanPolicy(folder.name);
      if (policy === "EXCLUDE") continue;
      for (const f of files) {
        if (f.mimeType === FOLDER_MIME) continue; // depth 1 is enough for the standard structure
        scanned.push({
          id: f.id,
          name: f.name,
          webViewLink: f.webViewLink,
          folderName: folder.name,
          policy,
          docType: classifyFileName(f.name),
        });
      }
    }

    // ── Match against requirements (first match per requirement wins; newest name sorting keeps it stable) ──
    const route: CustomsRoute = pkg.route;
    const reqs = requiredDocsFor(route);
    const used = new Set<string>();
    pkg.documents = reqs.map((r) => {
      const match = scanned.find((s) => s.docType === r.docType && s.policy === "INCLUDE" && !used.has(s.id));
      if (match) {
        used.add(match.id);
        return {
          docType: r.docType,
          label: r.label,
          readiness: r.readiness,
          state: "RECEIVED",
          included: true,
          fileId: match.id,
          fileName: match.name,
          webViewLink: match.webViewLink,
          folderName: match.folderName,
          matchedAt: new Date(),
          note: r.note,
        };
      }
      return {
        docType: r.docType,
        label: r.label,
        readiness: r.readiness,
        state: defaultDocState(r, route.stage),
        included: true,
        note: r.note,
      };
    });

    // Remaining files → extras (REFERENCE files excluded from package by default)
    pkg.extraFiles = scanned
      .filter((s) => !used.has(s.id))
      .map((s) => ({
        fileId: s.id,
        fileName: s.name,
        webViewLink: s.webViewLink,
        docType: s.docType,
        folderName: s.folderName,
        included: false,
      }));

    pkg.audit.push({
      at: new Date(),
      action: "DOCUMENTS_SCANNED",
      detail: `${scanned.length} files scanned, ${used.size} matched`,
    });
    await pkg.save();

    // ── Write back the shipment's existing toggles (Appendix C) — best effort ──
    const has = (t: DocType) => pkg.documents.some((d: any) => d.docType === t && d.state === "RECEIVED");
    VBshipping.updateOne(
      { _id: pkg.shipmentId },
      {
        $set: {
          isSupplierInvoice: has("COMMERCIAL_INVOICE"),
          isPackingList: has("PACKING_LIST"),
          IsBillOfLading: has("BOL"),
          isCertificateOfOrigin: has("CERT_ORIGIN"),
          isCertificateOfAnalysis: has("COA"),
          isArrivalNotice: has("ARRIVAL_NOTICE"),
        },
      }
    ).catch(() => {});

    return NextResponse.json({ package: pkg, scannedCount: scanned.length, matchedCount: used.size });
  } catch (e: any) {
    console.error("[customs-packages/scan]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
