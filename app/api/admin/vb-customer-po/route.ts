import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VBcustomerPO from "@/lib/models/VBcustomerPO";
import { broadcastMutation } from "@/lib/pusher/broadcast";

/**
 * GET /api/admin/vb-customer-po
 * Query params:
 *   - vidaPOId (legacy alias) or VBNumber: filter by parent VidaPO ObjectId
 *   - all (no params): return all
 */
export async function GET(req: Request) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    // Support both legacy "vidaPOId" param and new "VBNumber" param
    const vbNumber = searchParams.get("VBNumber") || searchParams.get("vidaPOId");
    const customer = searchParams.get("customer");

    const mongoose = (await import("mongoose")).default;
    const filter: any = {};
    if (vbNumber) {
      // Expand to all sibling-group members so linked records show combined CPOs
      const { resolveGroupPoIds } = await import("@/lib/folder-group");
      const groupIds = await resolveGroupPoIds(vbNumber);
      // Match both ObjectId and string storage of VBNumber
      const variants: any[] = [];
      for (const id of groupIds) {
        variants.push(id);
        if (/^[a-fA-F0-9]{24}$/.test(id)) variants.push(new mongoose.Types.ObjectId(id));
      }
      filter.VBNumber = { $in: variants };
    }
    if (customer && /^[a-fA-F0-9]{24}$/.test(customer)) {
      filter.customer = new mongoose.Types.ObjectId(customer);
    }

    const items = await VBcustomerPO.find(filter).sort({ createdAt: -1 });
    return NextResponse.json(items);
  } catch (error) {
    console.error("Failed to fetch VBcustomerPOs:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

/**
 * POST /api/admin/vb-customer-po
 * Create a new standalone customerPO record.
 */
export async function POST(req: Request) {
  try {
    await connectToDatabase();
    const data = await req.json();

    // ObjectId fields: empty strings → null so Mongoose doesn't choke
    const OID_FIELDS = ['VBNumber', 'customer', 'customerLocation', 'warehouse'];
    for (const f of OID_FIELDS) {
      if (f in data && !data[f]) {
        data[f] = null;
      }
    }

    const newItem = await VBcustomerPO.create(data);
    broadcastMutation("vb-customer-po", "create", newItem._id?.toString());
    return NextResponse.json(newItem, { status: 201 });
  } catch (error) {
    console.error("Failed to create VBcustomerPO:", error);
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
}
