import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import VidaSupplier from "@/lib/models/VidaSupplier";
import { findOrCreateFolder, createResumableUpload } from "@/lib/google-drive";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const { fileName, mimeType, docName } = body;

    if (!fileName || !docName || !mimeType) {
      return NextResponse.json({ error: "fileName, mimeType, and docName are required" }, { status: 400 });
    }

    await connectToDatabase();
    const supplier = await VidaSupplier.findById(id);
    if (!supplier) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });

    const rootId = process.env.GOOGLE_DRIVE_FOLDERID || "";
    if (!rootId) return NextResponse.json({ error: "Google Drive disabled" }, { status: 500 });

    const folderName = `${supplier.name} (${supplier.vbId || supplier._id.toString().substring(0, 6)})`;
    const folderId = await findOrCreateFolder(rootId, folderName);

    const origin = req.headers.get("origin") || req.nextUrl.origin || "http://localhost:3000";
    const uploadUrl = await createResumableUpload(folderId, fileName, mimeType, origin);

    return NextResponse.json({ uploadUrl });
  } catch (error) {
    console.error("Init upload error:", error);
    return NextResponse.json({ error: "Failed to initialize upload" }, { status: 500 });
  }
}
