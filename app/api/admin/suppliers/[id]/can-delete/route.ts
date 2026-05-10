import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaSupplier from "@/lib/models/VidaSupplier";
import mongoose from "mongoose";

/**
 * GET /api/admin/suppliers/[id]/can-delete
 *
 * Checks whether a supplier can be safely deleted.
 * Returns { canDelete: boolean, reasons: string[] }
 *
 * A supplier CANNOT be deleted if:
 *  - It has documents with uploaded files
 *  - It has survey responses
 *  - It is referenced by VidaPO, VBshipping, VidaQuote (by name), or VidaSupplierSpec (by _id)
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    await connectToDatabase();
    const supplier = await VidaSupplier.findById(id).lean();
    if (!supplier) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const reasons: string[] = [];
    const db = mongoose.connection.db;
    if (!db) throw new Error("DB not connected");

    // 1. Check own documents
    const hasFiles = (supplier.documents || []).some(
      (d: any) => d.files && d.files.length > 0
    );
    if (hasFiles) reasons.push("Has uploaded documents");

    // 2. Check survey responses
    if (supplier.surveyResponses && supplier.surveyResponses.length > 0) {
      reasons.push("Has survey responses");
    }

    // 3. Check VidaSupplierSpec
    const specCount = await db
      .collection("vidasupplierspecs")
      .countDocuments({ supplierId: new mongoose.Types.ObjectId(id) });
    if (specCount > 0) reasons.push(`Referenced by ${specCount} spec(s)`);

    // 4. Check VidaPO (supplier field stores the supplier name)
    const supplierName = supplier.name;
    if (supplierName) {
      const poCount = await db
        .collection("vidapos")
        .countDocuments({ supplier: supplierName });
      if (poCount > 0) reasons.push(`Referenced by ${poCount} Purchase Order(s)`);

      // 5. Check VBshipping
      const shipCount = await db
        .collection("vbshippings")
        .countDocuments({ supplier: supplierName });
      if (shipCount > 0) reasons.push(`Referenced by ${shipCount} Shipment(s)`);

      // 6. Check VidaQuote
      const quoteCount = await db
        .collection("vidaquotes")
        .countDocuments({ supplier: supplierName });
      if (quoteCount > 0) reasons.push(`Referenced by ${quoteCount} Quote(s)`);
    }

    return NextResponse.json({
      canDelete: reasons.length === 0,
      reasons,
    });
  } catch (error: any) {
    console.error("can-delete check failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
