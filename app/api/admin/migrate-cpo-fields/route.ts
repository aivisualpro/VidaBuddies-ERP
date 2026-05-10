import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VBcustomerPO from "@/lib/models/VBcustomerPO";

/**
 * SAFE MIGRATION: Populate VBNumber and VBSerialNumber on vbcustomerpos
 *
 * VBNumber    = vidaPOId._id as string (already stored on record)
 * VBSerialNumber = poNo value (copy existing poNo to new field name)
 *
 * This is ADDITIVE only — old fields (poNo, vidaPOId) are never deleted.
 * Run via POST /api/admin/migrate-cpo-fields
 *
 * ?dryRun=true  → preview changes without saving
 * ?dryRun=false → apply changes
 */
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get("dryRun") !== "false";

    const allCPOs = await VBcustomerPO.find({}).lean();

    const report = {
      total: allCPOs.length,
      updated: 0,
      skipped: 0,
      errors: 0,
      preview: [] as any[],
    };

    for (const cpo of allCPOs) {
      const id = (cpo as any)._id.toString();
      const vidaPOId = (cpo as any).vidaPOId?.toString() || "";
      const oldPoNo = (cpo as any).poNo || "";

      // VBNumber = vidaPOId as string
      const VBNumber = vidaPOId;

      // VBSerialNumber = same value as poNo (renaming)
      const VBSerialNumber = oldPoNo;

      const changes = {
        _id: id,
        before: { vidaPOId, poNo: oldPoNo },
        after: { VBNumber, VBSerialNumber },
      };

      if (dryRun) {
        report.preview.push(changes);
      } else {
        try {
          await VBcustomerPO.updateOne(
            { _id: id },
            {
              $set: {
                VBNumber,
                VBSerialNumber,
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
    const total = await VBcustomerPO.countDocuments();
    const migrated = await VBcustomerPO.countDocuments({
      VBNumber: { $exists: true, $ne: "" },
    });
    const unmigrated = total - migrated;
    return NextResponse.json({ total, migrated, unmigrated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
