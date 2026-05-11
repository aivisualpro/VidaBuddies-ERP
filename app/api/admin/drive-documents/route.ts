import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import mongoose from "mongoose";

/**
 * GET /api/admin/drive-documents?vbNumber=VB300-8
 * 
 * Returns driveDocuments from all 3 collections (vidapos, vbcustomerpos, vbshippings)
 * for the given VBNumber hierarchy.
 * 
 * Response: {
 *   po:   { VBNumber, driveDocuments[] },
 *   cpos: [{ VBSerialNumber, driveDocuments[] }],
 *   ships:[{ VBShipmentNumber, driveDocuments[] }]
 * }
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const vbNumber = searchParams.get("vbNumber");

    if (!vbNumber) {
      return NextResponse.json({ error: "vbNumber is required" }, { status: 400 });
    }

    const vidapos = mongoose.connection.collection("vidapos");
    const vbcustomerpos = mongoose.connection.collection("vbcustomerpos");
    const vbshippings = mongoose.connection.collection("vbshippings");

    // 1. Get the PO — try by VBNumber string, or by _id if it's a valid ObjectId
    const poFilter: any[] = [{ VBNumber: vbNumber }];
    if (/^[a-fA-F0-9]{24}$/.test(vbNumber)) {
      poFilter.push({ _id: new mongoose.Types.ObjectId(vbNumber) });
    }
    const po = await vidapos.findOne(
      { $or: poFilter },
      { projection: { VBNumber: 1, driveDocuments: 1 } }
    );

    // Build list of possible VBNumber values used across collections
    const vbNumberVariants: string[] = [vbNumber];
    if (po?._id) vbNumberVariants.push(po._id.toString());

    // 2. Get all CPOs for this VBNumber (ObjectId reference)
    const cpoQuery: any = {
      VBNumber: { $in: vbNumberVariants.map(v => v.length === 24 ? new mongoose.Types.ObjectId(v) : v) },
    };
    const cpos = await vbcustomerpos
      .find(cpoQuery, { projection: { VBSerialNumber: 1, driveDocuments: 1 } })
      .toArray();

    // 3. Get all Shippings for this VBNumber
    const shipQuery: any = {
      VBNumber: { $in: vbNumberVariants },
    };
    const ships = await vbshippings
      .find(shipQuery, { projection: { svbid: 1, VBShipmentNumber: 1, VBSerialNumber: 1, driveDocuments: 1 } })
      .toArray();

    return NextResponse.json({
      po: po ? {
        _id: po._id,
        VBNumber: po.VBNumber,
        driveDocuments: po.driveDocuments || [],
      } : null,
      cpos: cpos.map((c: any) => ({
        _id: c._id,
        VBSerialNumber: c.VBSerialNumber,
        driveDocuments: c.driveDocuments || [],
      })),
      ships: ships.map((s: any) => ({
        _id: s._id,
        VBShipmentNumber: s.VBShipmentNumber || s.svbid,
        VBSerialNumber: s.VBSerialNumber,
        driveDocuments: s.driveDocuments || [],
      })),
    });
  } catch (error: any) {
    console.error("[drive-documents] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
