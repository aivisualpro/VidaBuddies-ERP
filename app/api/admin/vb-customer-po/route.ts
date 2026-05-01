import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VBcustomerPO from "@/lib/models/VBcustomerPO";

/**
 * GET /api/admin/vb-customer-po
 * Query params:
 *   - vidaPOId: filter by parent PO
 *   - vbpoNo: filter by vbpoNo string
 *   - all (no params): return all
 */
export async function GET(req: Request) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const vidaPOId = searchParams.get("vidaPOId");
    const vbpoNo = searchParams.get("vbpoNo");

    const filter: any = {};
    if (vidaPOId) filter.vidaPOId = vidaPOId;
    if (vbpoNo) filter.vbpoNo = vbpoNo;

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
    const newItem = await VBcustomerPO.create(data);
    return NextResponse.json(newItem, { status: 201 });
  } catch (error) {
    console.error("Failed to create VBcustomerPO:", error);
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
}
