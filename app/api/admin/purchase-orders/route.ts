
import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaPO from "@/lib/models/VidaPO";
import VBshipping from "@/lib/models/VBshipping";
import { getSession } from "@/lib/auth";
import { broadcastMutation } from "@/lib/pusher/broadcast";

export async function GET() {
  try {
    await connectToDatabase();
    const [items, shipments] = await Promise.all([
      VidaPO.find({}).lean(),
      VBshipping.find({}, { VBNumber: 1, status: 1 }).lean(),
    ]);

    // Build a map of PO ObjectId → array of shipping statuses
    const shipStatusMap: Record<string, string[]> = {};
    for (const s of shipments) {
      if (!s.VBNumber) continue;
      const key = s.VBNumber.toString();
      if (!shipStatusMap[key]) shipStatusMap[key] = [];
      if (s.status) shipStatusMap[key].push(s.status);
    }

    // Attach live shipping statuses to each PO
    const enriched = items.map((po: any) => ({
      ...po,
      _shipStatuses: shipStatusMap[po._id.toString()] || [],
    }));

    return NextResponse.json(enriched);
  } catch (error) {
    console.error("Failed to fetch purchase orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch purchase orders" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    await connectToDatabase();
    const data = await req.json();

    // vbpoNo is deprecated — never store it on new documents
    delete data.vbpoNo;

    // Auto-set createdBy from session
    const session = await getSession();
    if (session?.email) {
      data.createdBy = session.email;
    }

    const newItem = await VidaPO.create(data);
    broadcastMutation("purchase-orders", "create", newItem._id?.toString());
    return NextResponse.json(newItem, { status: 201 });
  } catch (error) {
    console.error("Failed to create purchase order:", error);
    return NextResponse.json(
      { error: "Failed to create purchase order" },
      { status: 500 }
    );
  }
}
