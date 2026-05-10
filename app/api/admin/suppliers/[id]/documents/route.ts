import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import VidaSupplier from "@/lib/models/VidaSupplier";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const { 
      docName, expiryDate, supplierNotes, adminNotes, isVerified, isNA, logAction, 
      fileId: targetFileId, fileIsVerified, fileProducts, fileExpiryDate,
      verifyAll  // new: set all files' isVerified to true
    } = await req.json();

    await connectToDatabase();
    const supplier = await VidaSupplier.findById(id);
    if (!supplier) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });

    if (!supplier.documents) supplier.documents = [];
    
    const docIndex = supplier.documents.findIndex((d: any) => d.name === docName);

    if (docIndex === -1) {
      supplier.documents.push({
        name: docName,
        expiryDate,
        supplierNotes,
        adminNotes,
        isVerified,
        isNA,
        files: [],
        logs: logAction ? [{ action: logAction, by: session.name || session.email || 'System', date: new Date() }] : []
      });
    } else {
      const doc = supplier.documents[docIndex];
      if (expiryDate !== undefined) doc.expiryDate = expiryDate;
      if (supplierNotes !== undefined) doc.supplierNotes = supplierNotes;
      if (adminNotes !== undefined) doc.adminNotes = adminNotes;
      if (isVerified !== undefined) doc.isVerified = isVerified;
      if (isNA !== undefined) doc.isNA = isNA;

      if (logAction) {
        doc.logs.push({
          action: logAction,
          by: session.name || session.email || 'System',
          date: new Date()
        });
      }

      // Bulk verify all files
      if (verifyAll && doc.files) {
        doc.files.forEach((f: any) => { f.isVerified = true; });
        doc.isVerified = true;
        doc.logs.push({
          action: 'Verified all documents',
          by: session.name || session.email || 'System',
          date: new Date()
        });
      }

      // Update a specific file entry (verification toggle, products update, expiry date)
      if (targetFileId) {
        if (!doc.files) doc.files = [];
        const fileIndex = doc.files.findIndex((f: any) => f._id?.toString() === targetFileId);
        if (fileIndex !== -1) {
          if (fileIsVerified !== undefined) doc.files[fileIndex].isVerified = fileIsVerified;
          if (fileProducts !== undefined) doc.files[fileIndex].products = fileProducts;
          if (fileExpiryDate !== undefined) doc.files[fileIndex].expiryDate = fileExpiryDate || null;
        }
      }
    }

    await supplier.save();

    return NextResponse.json(supplier.documents);
  } catch (error) {
    console.error("Error updating document:", error);
    return NextResponse.json({ error: "Failed to update document" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const { docName, fileId } = await req.json();

    if (!docName || !fileId) {
      return NextResponse.json({ error: "Missing docName or fileId" }, { status: 400 });
    }

    await connectToDatabase();
    const supplier = await VidaSupplier.findById(id);
    if (!supplier) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });

    if (!supplier.documents) supplier.documents = [];

    const docIndex = supplier.documents.findIndex((d: any) => d.name === docName);
    if (docIndex !== -1) {
      const doc = supplier.documents[docIndex];
      if (!doc.files) doc.files = [];
      
      const fileIndex = doc.files.findIndex((f: any) => f._id?.toString() === fileId);
      
      if (fileIndex !== -1) {
        const removedFile = doc.files.splice(fileIndex, 1)[0];
        
        // Update doc-level pointer to latest remaining file
        if (doc.files.length > 0) {
          const latest = doc.files[doc.files.length - 1];
          doc.fileId = latest.fileId;
          doc.fileLink = latest.fileLink;
        } else {
          doc.fileId = undefined;
          doc.fileLink = undefined;
        }
        
        // Log the deletion
        doc.logs.push({
           action: `Deleted file: ${removedFile.fileName}`,
           by: session.name || session.email || 'System',
           date: new Date()
        });
      }
    }

    await supplier.save();
    return NextResponse.json(supplier.documents);
  } catch (error) {
    console.error("Error deleting document file:", error);
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
  }
}
