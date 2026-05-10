import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import mongoose from "mongoose";

/**
 * GET /api/admin/migrate-timeline-fields
 * One-time migration: rename timeline fields
 *   vbpoNo → VBNumber
 *   poNo   → VBSerialNumber
 *   svbid  → VBShipmentNumber
 */
export async function GET() {
  try {
    await connectToDatabase();
    const db = mongoose.connection.db!;
    const col = db.collection("vidatimelines");

    const totalDocs = await col.countDocuments();
    const results: string[] = [`Total docs: ${totalDocs}`];

    // Rename vbpoNo → VBNumber
    const r1 = await col.updateMany(
      { vbpoNo: { $exists: true } },
      { $rename: { vbpoNo: "VBNumber" } }
    );
    results.push(`vbpoNo → VBNumber: ${r1.modifiedCount} docs`);

    // Rename poNo → VBSerialNumber
    const r2 = await col.updateMany(
      { poNo: { $exists: true } },
      { $rename: { poNo: "VBSerialNumber" } }
    );
    results.push(`poNo → VBSerialNumber: ${r2.modifiedCount} docs`);

    // Rename svbid → VBShipmentNumber
    const r3 = await col.updateMany(
      { svbid: { $exists: true } },
      { $rename: { svbid: "VBShipmentNumber" } }
    );
    results.push(`svbid → VBShipmentNumber: ${r3.modifiedCount} docs`);

    // Update indexes
    try { await col.dropIndex("vbpoNo_1_timestamp_-1"); } catch {}
    try { await col.dropIndex("poNo_1_timestamp_-1"); } catch {}
    try { await col.dropIndex("svbid_1_timestamp_-1"); } catch {}

    await col.createIndex({ VBNumber: 1, timestamp: -1 });
    await col.createIndex({ VBSerialNumber: 1, timestamp: -1 });
    await col.createIndex({ VBShipmentNumber: 1, timestamp: -1 });
    results.push("Indexes updated");

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error("Migration failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
