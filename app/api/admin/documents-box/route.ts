import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaSupplier from "@/lib/models/VidaSupplier";

export const dynamic = "force-dynamic";

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

    // For other categories, return empty for now (extensible)
    return NextResponse.json([]);
  } catch (error: any) {
    console.error("Documents box error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
