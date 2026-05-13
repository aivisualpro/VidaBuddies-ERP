import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VBshipping from "@/lib/models/VBshipping";
import { broadcastMutation } from "@/lib/pusher/broadcast";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/vb-shipping/[id]
 */
export async function GET(req: Request, { params }: RouteParams) {
  try {
    await connectToDatabase();
    const { id } = await params;
    const item = await VBshipping.findById(id);
    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(item);
  } catch (error) {
    console.error("Failed to fetch VBshipping:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

/**
 * PUT /api/admin/vb-shipping/[id]
 */
export async function PUT(req: Request, { params }: RouteParams) {
  try {
    await connectToDatabase();
    const { id } = await params;
    const data = await req.json();

    // Sanitize ObjectId fields — empty strings → null
    const oidFields = ['VBNumber', 'VBSerialNumber', 'supplier', 'supplierLocation'];
    for (const f of oidFields) {
      if (f in data && (data[f] === '' || data[f] === undefined)) data[f] = null;
    }
    if (Array.isArray(data.products)) {
      data.products = data.products.filter((p: any) => p && typeof p === 'string' && /^[a-fA-F0-9]{24}$/.test(p));
    }

    const updated = await VBshipping.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    broadcastMutation("vb-shipping", "update", id);

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update VBshipping:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/vb-shipping/[id]
 */
export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    await connectToDatabase();
    const { id } = await params;
    const deleted = await VBshipping.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    broadcastMutation("vb-shipping", "delete", id);

    return NextResponse.json({ message: "Deleted successfully" });
  } catch (error) {
    console.error("Failed to delete VBshipping:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
