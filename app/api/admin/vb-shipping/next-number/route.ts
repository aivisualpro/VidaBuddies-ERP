import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VBshipping from "@/lib/models/VBshipping";
import VBcustomerPO from "@/lib/models/VBcustomerPO";

/**
 * GET /api/admin/vb-shipping/next-number?vbSerialNumber=<cpoId>
 *
 * Returns the next VBShipmentNumber for a given VBSerialNumber (CPO _id).
 * e.g. if CPO's VBSerialNumber is "VB1-1" and 2 shipments exist → returns "VB1-1-3"
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const vbSerialNumber = searchParams.get("vbSerialNumber");

    if (!vbSerialNumber) {
      return NextResponse.json({ error: "vbSerialNumber is required" }, { status: 400 });
    }

    // Resolve the display name from vbcustomerpos
    const cpo = await VBcustomerPO.findById(vbSerialNumber, "VBSerialNumber poNo").lean();
    const serialName = (cpo as any)?.VBSerialNumber || (cpo as any)?.poNo || "";

    if (!serialName) {
      return NextResponse.json({ nextNumber: "", serialName: "" });
    }

    // Count existing shipments with this VBSerialNumber
    const count = await VBshipping.countDocuments({ VBSerialNumber: vbSerialNumber });

    const nextNumber = `${serialName}-${count + 1}`;

    return NextResponse.json({ nextNumber, serialName, existingCount: count });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
