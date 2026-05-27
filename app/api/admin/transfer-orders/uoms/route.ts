import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaTransferOrder from "@/lib/models/VidaTransferOrder";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/transfer-orders/uoms
 * Returns distinct, non-empty UOM values from vidaTransferOrders
 */
export async function GET() {
  try {
    await connectToDatabase();
    const values: string[] = await VidaTransferOrder.distinct("uom");
    // Filter out empty/null and sort alphabetically
    const cleaned = values.filter((v) => v && v.trim()).sort((a, b) => a.localeCompare(b));
    return NextResponse.json(cleaned);
  } catch (error: any) {
    console.error("Transfer Orders UOMs Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
