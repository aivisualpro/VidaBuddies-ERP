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

    // 1. Get the PO
    const po = await vidapos.findOne(
      { $or: [{ vbpoNo: vbNumber }, { VBNumber: vbNumber }] },
      { projection: { vbpoNo: 1, VBNumber: 1, driveDocuments: 1 } }
    );

    // Build list of possible VBNumber values used across collections
    // (some records store the ObjectId string, others the vbpoNo string)
    const vbNumberVariants: string[] = [vbNumber];
    if (po?._id) vbNumberVariants.push(po._id.toString());
    if (po?.vbpoNo && !vbNumberVariants.includes(po.vbpoNo)) vbNumberVariants.push(po.vbpoNo);

    // 2. Get all CPOs for this VBNumber (also try vidaPOId for ObjectId ref)
    const cpoQuery: any = {
      $or: [
        { VBNumber: { $in: vbNumberVariants } },
        ...(po?._id ? [{ vidaPOId: po._id }, { vidaPOId: po._id.toString() }] : []),
      ],
    };
    const cpos = await vbcustomerpos
      .find(cpoQuery, { projection: { poNo: 1, VBSerialNumber: 1, driveDocuments: 1 } })
      .toArray();

    // 3. Get all Shippings for this VBNumber
    const shipQuery: any = {
      $or: [
        { VBNumber: { $in: vbNumberVariants } },
        { poNo: { $in: vbNumberVariants } },
      ],
    };
    const ships = await vbshippings
      .find(shipQuery, { projection: { svbid: 1, VBShipmentNumber: 1, VBSerialNumber: 1, driveDocuments: 1 } })
      .toArray();

    return NextResponse.json({
      po: po ? {
        _id: po._id,
        VBNumber: po.VBNumber || po.vbpoNo,
        driveDocuments: po.driveDocuments || [],
      } : null,
      cpos: cpos.map((c: any) => ({
        _id: c._id,
        VBSerialNumber: c.VBSerialNumber || c.poNo,
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
