import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import mongoose from "mongoose";

/**
 * GET /api/admin/emails/counts
 * Returns email and invoice counts for ALL VBNumbers in a single aggregation query.
 *
 * Response: { counts: { [VBNumber_as_string]: { total: number, invoices: number } } }
 */
export async function GET() {
  try {
    await connectToDatabase();
    const db = mongoose.connection.db;

    const pipeline = [
      {
        $group: {
          _id: "$VBNumber",
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
        // Key by the string representation so frontend can match by PO _id
        const key = r._id.toString();
        counts[key] = { total: r.total, invoices: r.invoices };
      }
    }

    return NextResponse.json({ counts });
  } catch (error: any) {
    console.error("Email counts failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
