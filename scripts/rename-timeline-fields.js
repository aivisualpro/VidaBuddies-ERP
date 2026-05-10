/**
 * Migration: Rename fields in vidatimelines collection
 *   vbpoNo  → VBNumber
 *   poNo    → VBSerialNumber
 *   svbid   → VBShipmentNumber
 *
 * Run: node scripts/rename-timeline-fields.js
 */
const { MongoClient } = require("mongodb");

const MONGODB_URI =
  "mongodb+srv://admin:hbgsYPMDLe-8p-@bookingx.qni27fu.mongodb.net/vidaBuddies?retryWrites=true&w=majority";

async function run() {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db("vidaBuddies");
    const col = db.collection("vidatimelines");

    const totalDocs = await col.countDocuments();
    console.log(`Total documents in vidatimelines: ${totalDocs}`);

    // Rename vbpoNo → VBNumber
    const r1 = await col.updateMany(
      { vbpoNo: { $exists: true } },
      { $rename: { vbpoNo: "VBNumber" } }
    );
    console.log(`Renamed vbpoNo → VBNumber: ${r1.modifiedCount} docs`);

    // Rename poNo → VBSerialNumber
    const r2 = await col.updateMany(
      { poNo: { $exists: true } },
      { $rename: { poNo: "VBSerialNumber" } }
    );
    console.log(`Renamed poNo → VBSerialNumber: ${r2.modifiedCount} docs`);

    // Rename svbid → VBShipmentNumber
    const r3 = await col.updateMany(
      { svbid: { $exists: true } },
      { $rename: { svbid: "VBShipmentNumber" } }
    );
    console.log(`Renamed svbid → VBShipmentNumber: ${r3.modifiedCount} docs`);

    // Drop old indexes (if they exist) and create new ones
    try { await col.dropIndex("vbpoNo_1_timestamp_-1"); } catch {}
    try { await col.dropIndex("poNo_1_timestamp_-1"); } catch {}
    try { await col.dropIndex("svbid_1_timestamp_-1"); } catch {}

    await col.createIndex({ VBNumber: 1, timestamp: -1 });
    await col.createIndex({ VBSerialNumber: 1, timestamp: -1 });
    await col.createIndex({ VBShipmentNumber: 1, timestamp: -1 });
    console.log("Indexes updated successfully.");

    console.log("\n✅ Migration complete!");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

run();
