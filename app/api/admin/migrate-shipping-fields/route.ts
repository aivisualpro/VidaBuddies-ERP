import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VBshipping from "@/lib/models/VBshipping";
import VBcustomerPO from "@/lib/models/VBcustomerPO";
import VidaPO from "@/lib/models/VidaPO";

/**
 * SAFE MIGRATION: Populate VBNumber, VBSerialNumber, VBShipmentNumber
 * from legacy poNo, customerPOId, svbid fields.
 *
 * This is ADDITIVE only — old fields are never deleted.
 * Run via POST /api/admin/migrate-shipping-fields
 *
 * ?dryRun=true  → preview changes without saving
 * ?dryRun=false → apply changes
 */
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get("dryRun") !== "false";

    // 1. Build lookup maps
    // Map vbpoNo → vidapos._id (as string)
    const allPOs = await VidaPO.find({}, "_id vbpoNo").lean();
    const vbpoNoToId = new Map<string, string>();
    allPOs.forEach((po: any) => {
      if (po.vbpoNo) vbpoNoToId.set(po.vbpoNo, po._id.toString());
    });

    // Map vbcustomerpos._id → its vbpoNo (to help resolve VBNumber from CPO)
    const allCPOs = await VBcustomerPO.find({}, "_id poNo vbpoNo vidaPOId").lean();
    const cpoMap = new Map<string, { poNo: string; vbpoNo: string; vidaPOId: string }>();
    allCPOs.forEach((cpo: any) => {
      cpoMap.set(cpo._id.toString(), {
        poNo: cpo.poNo || "",
        vbpoNo: cpo.vbpoNo || "",
        vidaPOId: cpo.vidaPOId?.toString() || "",
      });
    });

    // 2. Fetch all shipping records
    const allShipping = await VBshipping.find({}).lean();

    const report = {
      total: allShipping.length,
      updated: 0,
      skipped: 0,
      errors: 0,
      preview: [] as any[],
    };

    for (const ship of allShipping) {
      const id = (ship as any)._id.toString();
      const oldPoNo = (ship as any).poNo || "";
      const oldCustomerPOId = (ship as any).customerPOId?.toString() || "";
      const oldSvbid = (ship as any).svbid || "";

      // VBNumber = vidapos._id as string
      // Resolve: poNo (which is vbpoNo like "VB1") → look up vidapos._id
      let VBNumber = "";
      if (oldPoNo && vbpoNoToId.has(oldPoNo)) {
        VBNumber = vbpoNoToId.get(oldPoNo)!;
      } else if (oldCustomerPOId && cpoMap.has(oldCustomerPOId)) {
        // Fallback: get vbpoNo from the linked CPO, then resolve to vidapos._id
        const cpo = cpoMap.get(oldCustomerPOId)!;
        if (cpo.vidaPOId) {
          VBNumber = cpo.vidaPOId;
        } else if (cpo.vbpoNo && vbpoNoToId.has(cpo.vbpoNo)) {
          VBNumber = vbpoNoToId.get(cpo.vbpoNo)!;
        }
      }

      // VBSerialNumber = vbcustomerpos._id as string (same as customerPOId)
      const VBSerialNumber = oldCustomerPOId;

      // VBShipmentNumber: use existing svbid
      const VBShipmentNumber = oldSvbid;

      const changes = {
        _id: id,
        before: { poNo: oldPoNo, customerPOId: oldCustomerPOId, svbid: oldSvbid },
        after: { VBNumber, VBSerialNumber, VBShipmentNumber },
      };

      if (dryRun) {
        report.preview.push(changes);
      } else {
        try {
          await VBshipping.updateOne(
            { _id: id },
            {
              $set: {
                VBNumber,
                VBSerialNumber,
                VBShipmentNumber,
              },
            }
          );
          report.updated++;
        } catch (err) {
          report.errors++;
        }
      }
    }

    if (dryRun) {
      report.updated = report.preview.length;
    }

    return NextResponse.json({
      success: true,
      dryRun,
      message: dryRun
        ? `DRY RUN: ${report.updated} records would be updated, ${report.skipped} skipped. No data was changed.`
        : `APPLIED: ${report.updated} records updated, ${report.skipped} skipped, ${report.errors} errors.`,
      report,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** GET: Check current migration status */
export async function GET() {
  try {
    await connectToDatabase();
    const total = await VBshipping.countDocuments();
    const migrated = await VBshipping.countDocuments({
      VBNumber: { $exists: true, $ne: "" },
    });
    const unmigrated = total - migrated;
    return NextResponse.json({ total, migrated, unmigrated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
