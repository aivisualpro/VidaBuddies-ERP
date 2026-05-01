/**
 * Migration endpoint: Copies nested customerPO[] and shipping[] arrays
 * from vidapos documents into standalone VBcustomerPO and VBshipping collections.
 *
 * - Safe to re-run: skips records whose _originalCpoId / _originalShipId already exist.
 * - Does NOT delete the original nested data.
 *
 * POST /api/admin/migrate-collections
 */
import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaPO from "@/lib/models/VidaPO";
import VBcustomerPO from "@/lib/models/VBcustomerPO";
import VBshipping from "@/lib/models/VBshipping";

export async function POST() {
  try {
    await connectToDatabase();

    const allPOs = await VidaPO.find({}).lean();

    let cpoCreated = 0;
    let cpoSkipped = 0;
    let shipCreated = 0;
    let shipSkipped = 0;

    for (const po of allPOs) {
      if (!po.customerPO || po.customerPO.length === 0) continue;

      for (const cpo of po.customerPO) {
        const cpoIdStr = cpo._id?.toString();
        if (!cpoIdStr) continue;

        // Check if already migrated
        const existing = await VBcustomerPO.findOne({ _originalCpoId: cpoIdStr });
        let newCpoId: string;

        if (existing) {
          cpoSkipped++;
          newCpoId = existing._id.toString();
        } else {
          // Create standalone customerPO
          const newCpo = await VBcustomerPO.create({
            vidaPOId: po._id,
            vbpoNo: po.vbpoNo || "",
            poNo: cpo.poNo,
            customer: cpo.customer,
            customerLocation: cpo.customerLocation,
            customerPONo: cpo.customerPONo,
            customerPODate: cpo.customerPODate,
            requestedDeliveryDate: cpo.requestedDeliveryDate,
            qtyOrdered: cpo.qtyOrdered,
            qtyReceived: cpo.qtyReceived,
            UOM: cpo.UOM,
            warehouse: cpo.warehouse,
            _originalCpoId: cpoIdStr,
          });
          newCpoId = newCpo._id.toString();
          cpoCreated++;
        }

        // Now migrate shipping records under this customerPO
        // @ts-ignore — lean() returns plain objects
        const shippings: any[] = cpo.shipping || [];
        for (const ship of shippings) {
          const shipIdStr = ship._id?.toString();
          if (!shipIdStr) continue;

          const existingShip = await VBshipping.findOne({ _originalShipId: shipIdStr });
          if (existingShip) {
            shipSkipped++;
            continue;
          }

          // Build a clean object stripping _id (let Mongo generate a new one)
          const shipData: any = { ...ship };
          delete shipData._id;

          await VBshipping.create({
            ...shipData,
            customerPOId: newCpoId,
            poNo: cpo.poNo || "",
            _originalShipId: shipIdStr,
          });
          shipCreated++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Migration complete",
      stats: {
        totalPOs: allPOs.length,
        customerPO: { created: cpoCreated, skipped: cpoSkipped },
        shipping: { created: shipCreated, skipped: shipSkipped },
      },
    });
  } catch (error: any) {
    console.error("Migration failed:", error);
    return NextResponse.json(
      { error: "Migration failed", details: error.message },
      { status: 500 }
    );
  }
}
