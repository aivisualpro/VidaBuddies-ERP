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

    let cpoId = "";
    let serialName = "";

    const mongoose = (await import("mongoose")).default;
    if (mongoose.Types.ObjectId.isValid(vbSerialNumber)) {
      cpoId = vbSerialNumber;
      const cpo = await VBcustomerPO.findById(cpoId, "VBSerialNumber poNo").lean();
      if (cpo) {
        serialName = (cpo as any).VBSerialNumber || (cpo as any).poNo || "";
      }
    } else {
      // Fallback: search by VBSerialNumber string directly (legacy support)
      const cpo = await VBcustomerPO.findOne({ VBSerialNumber: vbSerialNumber }).lean();
      if (cpo) {
        cpoId = cpo._id.toString();
        serialName = cpo.VBSerialNumber || "";
      } else {
        serialName = vbSerialNumber; // fallback if it is a plain serial string
      }
    }

    if (!serialName) {
      return NextResponse.json({ nextNumber: "", serialName: "" });
    }

    // Count existing shipments with this VBSerialNumber
    let count = 0;
    if (mongoose.Types.ObjectId.isValid(cpoId)) {
      count = await VBshipping.countDocuments({ VBSerialNumber: new mongoose.Types.ObjectId(cpoId) });
    } else {
      count = await VBshipping.countDocuments({ VBSerialNumber: cpoId });
    }

    const nextNumber = `${serialName}-${count + 1}`;

    return NextResponse.json({ nextNumber, serialName, existingCount: count });
  } catch (error: any) {
    console.error("[next-number] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
