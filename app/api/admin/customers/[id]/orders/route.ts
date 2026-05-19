import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VBcustomerPO from "@/lib/models/VBcustomerPO";
import VBshipping from "@/lib/models/VBshipping";
import mongoose from "mongoose";

/**
 * GET /api/admin/customers/[id]/orders
 *
 * Returns:
 *   { cpos: VBcustomerPO[], shippings: VBshipping[] }
 *
 * - cpos:      all VBcustomerPO records where customer === id
 * - shippings: all VBshipping records where VBSerialNumber is in the cpo._id set
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "Invalid customer id" }, { status: 400 });
    }

    await connectToDatabase();

    const customerId = new mongoose.Types.ObjectId(id);

    // Step 1: fetch all CPOs for this customer (fast – indexed on customer field)
    const cpos = await VBcustomerPO.find(
      { customer: customerId },
      { driveDocuments: 0 }          // exclude heavy embedded docs
    )
      .sort({ createdAt: -1 })
      .lean();

    if (cpos.length === 0) {
      return NextResponse.json({ cpos: [], shippings: [] });
    }

    // Step 2: collect the CPO _ids
    const cpoIds = cpos.map((c: any) => c._id);

    // Step 3: fetch shippings where VBSerialNumber is one of those CPO _ids
    const shippings = await VBshipping.find(
      { VBSerialNumber: { $in: cpoIds } },
      { shippingTrackingRecords: 0, driveDocuments: 0 } // exclude heavy fields
    )
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ cpos, shippings });
  } catch (error) {
    console.error("[customer orders] failed:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
