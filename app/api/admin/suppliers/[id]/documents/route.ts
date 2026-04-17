import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import VidaSupplier from "@/lib/models/VidaSupplier";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const { docName, expiryDate, supplierNotes, adminNotes, isVerified, isNA, logAction, logId, logIsVerified, logProducts } = await req.json();

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

      if (logId) {
        const logIndex = doc.logs.findIndex((l: any) => l._id?.toString() === logId);
        if (logIndex !== -1) {
          if (logIsVerified !== undefined) doc.logs[logIndex].isVerified = logIsVerified;
          if (logProducts !== undefined) doc.logs[logIndex].products = logProducts;
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
    const { docName, logId } = await req.json();

    if (!docName || !logId) {
      return NextResponse.json({ error: "Missing docName or logId" }, { status: 400 });
    }

    await connectToDatabase();
    const supplier = await VidaSupplier.findById(id);
    if (!supplier) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });

    if (!supplier.documents) supplier.documents = [];

    const docIndex = supplier.documents.findIndex((d: any) => d.name === docName);
    if (docIndex !== -1) {
      const doc = supplier.documents[docIndex];
      const logIndex = doc.logs.findIndex((l: any) => l._id?.toString() === logId);
      
      if (logIndex !== -1) {
        const removedLog = doc.logs.splice(logIndex, 1)[0];
        
        if (doc.fileId === removedLog.fileId) {
          const previousUpload = [...doc.logs]
            .reverse()
            .find(l => l.fileId && l.action.startsWith('Uploaded'));
            
          if (previousUpload) {
            doc.fileId = previousUpload.fileId;
            doc.fileLink = previousUpload.fileLink;
          } else {
            doc.fileId = undefined;
            doc.fileLink = undefined;
          }
        }
        
        doc.logs.push({
           action: `Deleted file: ${removedLog.action.replace('Uploaded ', '')}`,
           by: session.name || session.email || 'System',
           date: new Date()
        });
      }
    }

    await supplier.save();
    return NextResponse.json(supplier.documents);
  } catch (error) {
    console.error("Error deleting document log:", error);
    return NextResponse.json({ error: "Failed to delete log" }, { status: 500 });
  }
}
