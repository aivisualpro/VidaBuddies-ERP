import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import VidaSupplier from "@/lib/models/VidaSupplier";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const { docName, expiryDate, supplierNotes, adminNotes, isVerified, logAction } = await req.json();

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
        logs: logAction ? [{ action: logAction, by: session.name || session.email || 'System', date: new Date() }] : []
      });
    } else {
      const doc = supplier.documents[docIndex];
      if (expiryDate !== undefined) doc.expiryDate = expiryDate;
      if (supplierNotes !== undefined) doc.supplierNotes = supplierNotes;
      if (adminNotes !== undefined) doc.adminNotes = adminNotes;
      if (isVerified !== undefined) doc.isVerified = isVerified;

      if (logAction) {
        doc.logs.push({
          action: logAction,
          by: session.name || session.email || 'System',
          date: new Date()
        });
      }
    }

    await supplier.save();

    return NextResponse.json(supplier.documents);
  } catch (error) {
    console.error("Error updating document:", error);
    return NextResponse.json({ error: "Failed to update document" }, { status: 500 });
  }
}
