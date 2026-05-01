import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import mongoose from "mongoose";

/**
 * GET /api/admin/emails/counts
 * Returns email and invoice counts for ALL vbpoNos in a single aggregation query.
 * Replaces the N+1 per-PO fetch pattern on the list page.
 *
 * Response: { counts: { [vbpoNo]: { total: number, invoices: number } } }
 */
export async function GET() {
  try {
    await connectToDatabase();
    const db = mongoose.connection.db;

    const pipeline = [
      {
        $group: {
          _id: "$vbpoNo",
          total: { $sum: 1 },
          invoices: {
            $sum: { $cond: [{ $eq: ["$type", "Invoice"] }, 1, 0] },
          },
        },
      },
    ];

    const results = await db!
      .collection("emailrecords")
      .aggregate(pipeline)
      .toArray();

    const counts: Record<string, { total: number; invoices: number }> = {};
    for (const r of results) {
      if (r._id) {
        counts[r._id] = { total: r.total, invoices: r.invoices };
      }
    }

    return NextResponse.json({ counts });
  } catch (error: any) {
    console.error("Email counts failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
