
import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaPO from "@/lib/models/VidaPO";
import { getSession } from "@/lib/auth";
import { broadcastMutation } from "@/lib/pusher/broadcast";

export async function GET() {
  try {
    await connectToDatabase();
    const items = await VidaPO.find({});
    return NextResponse.json(items);
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
