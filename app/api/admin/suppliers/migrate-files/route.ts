import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import mongoose from "mongoose";

// ONE-TIME migration using raw MongoDB ops to bypass Mongoose model caching.
// Moves legacy doc-level fileId/fileLink into the new `files[]` sub-array.
export async function POST() {
  try {
    await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) return NextResponse.json({ error: "DB not connected" }, { status: 500 });

    const collection = db.collection("vidasuppliers");
    const suppliers = await collection.find({ "documents.0": { $exists: true } }).toArray();

    let migratedDocs = 0;
    let migratedSuppliers = 0;

    for (const supplier of suppliers) {
      let changed = false;

      for (let i = 0; i < (supplier.documents || []).length; i++) {
        const doc = supplier.documents[i];

        // Skip if files array already has entries (already migrated)
        if (doc.files && doc.files.length > 0) continue;
        // Skip if no file was ever uploaded at doc level
        if (!doc.fileId || !doc.fileLink) continue;

        // Find the most recent "Uploaded" log to get creator info & filename
        const uploadLogs = (doc.logs || [])
          .filter((l: any) => l.action?.startsWith('Uploaded'))
          .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const latestLog = uploadLogs[0];
        const fileName = latestLog
          ? latestLog.action.replace('Uploaded ', '')
          : 'Unknown File';
        const createdBy = latestLog?.by || 'System';
        const createdAt = latestLog?.date || new Date();
        const isVerified = doc.isVerified || false;

        // Create the single file entry from the doc-level data
        const fileEntry = {
          _id: new mongoose.Types.ObjectId(),
          fileName,
          fileId: doc.fileId,
          fileLink: doc.fileLink,
          isVerified,
          createdBy,
          createdAt,
          products: []
        };

        // Use raw $set to push this file entry
        await collection.updateOne(
          { _id: supplier._id },
          { $set: { [`documents.${i}.files`]: [fileEntry] } }
        );

        migratedDocs++;
        changed = true;
      }

      if (changed) {
        migratedSuppliers++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Migrated ${migratedDocs} documents across ${migratedSuppliers} suppliers.`,
    });
  } catch (error) {
    console.error("Migration error:", error);
    return NextResponse.json({ error: "Migration failed", details: String(error) }, { status: 500 });
  }
}
