import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VBshipping from "@/lib/models/VBshipping";

/**
 * GET /api/admin/vb-shipping
 * Query params:
 *   - customerPOId: filter by parent customerPO
 *   - poNo: filter by poNo display string
 *   - containerNo: filter by container number
 *   - all (no params): return all
 */
export async function GET(req: Request) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const customerPOId = searchParams.get("customerPOId");
    const poNo = searchParams.get("poNo");
    const containerNo = searchParams.get("containerNo");

    const filter: any = {};
    if (customerPOId) filter.customerPOId = customerPOId;
    if (poNo) filter.poNo = poNo;
    if (containerNo) filter.containerNo = containerNo;

    const items = await VBshipping.find(filter).sort({ createdAt: -1 });
    return NextResponse.json(items);
  } catch (error) {
    console.error("Failed to fetch VBshipping:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

/**
 * POST /api/admin/vb-shipping
 * Create a new standalone shipping record.
 */
export async function POST(req: Request) {
  try {
    await connectToDatabase();
    const data = await req.json();
    const newItem = await VBshipping.create(data);
    return NextResponse.json(newItem, { status: 201 });
  } catch (error) {
    console.error("Failed to create VBshipping:", error);
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
}
