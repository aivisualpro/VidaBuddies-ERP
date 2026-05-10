import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import mongoose from "mongoose";

/**
 * GET /api/admin/cleanup-timeline-labels
 * Removes the backup label fields from vidatimelines after confirming migration success.
 */
export async function GET() {
  try {
    await connectToDatabase();
    const db = mongoose.connection.db!;
    const timelines = db.collection("vidatimelines");

    const result = await timelines.updateMany(
      {},
      {
        $unset: {
          _VBNumberLabel: "",
          _VBSerialNumberLabel: "",
          _VBShipmentNumberLabel: "",
        },
      }
    );

    return NextResponse.json({
      success: true,
      matched: result.matchedCount,
      modified: result.modifiedCount,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
