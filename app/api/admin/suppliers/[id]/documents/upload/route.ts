import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import VidaSupplier from "@/lib/models/VidaSupplier";
import { uploadFile, findOrCreateFolder } from "@/lib/google-drive";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const docName = formData.get("docName") as string;

    if (!file || !docName) {
      return NextResponse.json({ error: "File and docName are required" }, { status: 400 });
    }

    await connectToDatabase();
    const supplier = await VidaSupplier.findById(id);
    if (!supplier) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });

    // Ensure Supplier Folder in given Google Drive Root exists
    const rootId = process.env.GOOGLE_DRIVE_FOLDERID || "";
    if (!rootId) return NextResponse.json({ error: "Google Drive integration disabled - missing GOOGLE_DRIVE_FOLDERID" }, { status: 500 });

    // Include vbId or _id in folder name for uniqueness
    const folderName = `${supplier.name} (${supplier.vbId || supplier._id.toString().substring(0, 6)})`;
    const folderId = await findOrCreateFolder(rootId, folderName);

    // Upload file
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const uploadedFile = await uploadFile(folderId, file.name, file.type, buffer);

    if (!supplier.documents) supplier.documents = [];

    const docIndex = supplier.documents.findIndex((d: any) => d.name === docName);
    const logEntry = {
      action: `Uploaded ${file.name}`,
      by: session.name || session.email || 'System',
      date: new Date(),
      fileId: uploadedFile.id,
      fileLink: uploadedFile.webViewLink
    };

    if (docIndex === -1) {
      supplier.documents.push({
        name: docName,
        fileId: uploadedFile.id,
        fileLink: uploadedFile.webViewLink,
        isVerified: false,
        logs: [logEntry]
      });
    } else {
      const doc = supplier.documents[docIndex];
      doc.fileId = uploadedFile.id;
      doc.fileLink = uploadedFile.webViewLink;
      doc.isVerified = false; // Reset verification on new document upload
      doc.logs.push(logEntry);
    }

    await supplier.save();

    return NextResponse.json(supplier.documents);
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Failed to upload document" }, { status: 500 });
  }
}
