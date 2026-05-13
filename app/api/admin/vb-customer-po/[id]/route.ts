import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VBcustomerPO from "@/lib/models/VBcustomerPO";
import { broadcastMutation } from "@/lib/pusher/broadcast";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/vb-customer-po/[id]
 */
export async function GET(req: Request, { params }: RouteParams) {
  try {
    await connectToDatabase();
    const { id } = await params;
    const item = await VBcustomerPO.findById(id);
    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(item);
  } catch (error) {
    console.error("Failed to fetch VBcustomerPO:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

/**
 * PUT /api/admin/vb-customer-po/[id]
 */
export async function PUT(req: Request, { params }: RouteParams) {
  try {
    await connectToDatabase();
    const { id } = await params;
    const data = await req.json();

    // ObjectId fields: empty strings → null so Mongoose doesn't choke
    const OID_FIELDS = ['VBNumber', 'customer', 'customerLocation'];
    for (const f of OID_FIELDS) {
      if (f in data && !data[f]) {
        data[f] = null;
      }
    }

    // Strip internal fields
    delete data._id;
    delete data.__v;

    const updated = await VBcustomerPO.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    broadcastMutation("vb-customer-po", "update", id);

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update VBcustomerPO:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/vb-customer-po/[id]
 */
export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    await connectToDatabase();
    const { id } = await params;
    const deleted = await VBcustomerPO.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    broadcastMutation("vb-customer-po", "delete", id);

    return NextResponse.json({ message: "Deleted successfully" });
  } catch (error) {
    console.error("Failed to delete VBcustomerPO:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
