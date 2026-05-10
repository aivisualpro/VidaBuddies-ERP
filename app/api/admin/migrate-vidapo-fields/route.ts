import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaPO from "@/lib/models/VidaPO";

/**
 * SAFE MIGRATION: Copy vbpoNo → VBNumber on vidapos
 *
 * This is ADDITIVE only — vbpoNo is never deleted.
 * Run via POST /api/admin/migrate-vidapo-fields
 *
 * ?dryRun=true  → preview changes without saving
 * ?dryRun=false → apply changes
 */
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get("dryRun") !== "false";

    const allPOs = await VidaPO.find({}).lean();

    const report = {
      total: allPOs.length,
      updated: 0,
      skipped: 0,
      errors: 0,
      preview: [] as any[],
    };

    for (const po of allPOs) {
      const id = (po as any)._id.toString();
      const vbpoNo = (po as any).vbpoNo || "";

      // VBNumber = same value as vbpoNo
      const VBNumber = vbpoNo;

      const changes = {
        _id: id,
        before: { vbpoNo },
        after: { VBNumber },
      };

      if (dryRun) {
        report.preview.push(changes);
      } else {
        try {
          await VidaPO.updateOne(
            { _id: id },
            { $set: { VBNumber } }
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
    const total = await VidaPO.countDocuments();
    const migrated = await VidaPO.countDocuments({
      VBNumber: { $exists: true, $ne: "" },
    });
    const unmigrated = total - migrated;
    return NextResponse.json({ total, migrated, unmigrated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
