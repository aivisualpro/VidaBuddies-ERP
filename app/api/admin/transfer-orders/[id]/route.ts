import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaTransferOrder from "@/lib/models/VidaTransferOrder";

export const dynamic = "force-dynamic";

/**
 * PUT /api/admin/transfer-orders/:id
 * Update a single transfer order document
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectToDatabase();
    const { id } = await params;
    const data = await req.json();

    // Sanitize ObjectId fields
    const OID_FIELDS = ["vbShipmentNumber", "warehouse", "product", "supplier", "createdBy"];
    for (const f of OID_FIELDS) {
      if (f in data && !data[f]) data[f] = null;
    }

    const updated = await VidaTransferOrder.findByIdAndUpdate(id, data, { new: true }).lean();
    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Transfer Order PUT Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/transfer-orders/:id
 * Delete a single transfer order document
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectToDatabase();
    const { id } = await params;
    const deleted = await VidaTransferOrder.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Transfer Order DELETE Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
