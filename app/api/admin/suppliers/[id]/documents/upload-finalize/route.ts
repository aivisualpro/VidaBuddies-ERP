import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import VidaSupplier from "@/lib/models/VidaSupplier";
import { makeFilePublic, getDrive } from "@/lib/google-drive";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const { docName, fileName, fileId } = body;

    if (!docName || !fileName || !fileId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Make file public to get webViewLink
    await makeFilePublic(fileId);

    // Get webViewLink
    const drive = getDrive();
    const fileRes = await drive.files.get({ fileId, fields: "webViewLink", supportsAllDrives: true });
    const webViewLink = fileRes.data.webViewLink || "";

    await connectToDatabase();
    const supplier = await VidaSupplier.findById(id);
    if (!supplier) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });

    if (!supplier.documents) supplier.documents = [];

    const userName = session.name || session.email || 'System';
    const now = new Date();

    const fileEntry = {
      fileName,
      fileId,
      fileLink: webViewLink,
      isVerified: false,
      createdBy: userName,
      createdAt: now,
      products: []
    };

    const logEntry = {
      action: `Uploaded ${fileName}`,
      by: userName,
      date: now,
      fileId,
      fileLink: webViewLink
    };

    const docIndex = supplier.documents.findIndex((d: any) => d.name === docName);

    if (docIndex === -1) {
      supplier.documents.push({
        name: docName,
        fileId,
        fileLink: webViewLink,
        isVerified: false,
        files: [fileEntry],
        logs: [logEntry]
      });
    } else {
      const doc = supplier.documents[docIndex];
      doc.fileId = fileId;
      doc.fileLink = webViewLink;
      doc.isVerified = false;
      if (!doc.files) doc.files = [];
      doc.files.push(fileEntry);
      doc.logs.push(logEntry);
    }

    await supplier.save();

    return NextResponse.json(supplier.documents);
  } catch (error) {
    console.error("Finalize upload error:", error);
    return NextResponse.json({ error: "Failed to finalize upload" }, { status: 500 });
  }
}
