/**
 * Cleanup: Remove obsolete/backup fields from vbshippings
 *
 * Fields removed:
 *   poNo, svbid, customerPOId,
 *   _backup_VBNumber, _backup_VBSerialNumber, _backup_products,
 *   _backup_supplier, _backup_supplierLocation
 *
 * Usage: node scripts/cleanup-shipping-fields.js
 */

const { MongoClient } = require("mongodb");

const MONGODB_URI =
  "mongodb+srv://admin:hbgsYPMDLe-8p-@bookingx.qni27fu.mongodb.net/vidaBuddies?retryWrites=true&w=majority";

const FIELDS_TO_REMOVE = [
  "poNo",
  "svbid",
  "customerPOId",
  "_backup_VBNumber",
  "_backup_VBSerialNumber",
  "_backup_products",
  "_backup_supplier",
  "_backup_supplierLocation",
];

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  console.log("✅ Connected to MongoDB\n");

  const db = client.db();
  const col = db.collection("vbshippings");

  // Build $unset object
  const $unset = {};
  FIELDS_TO_REMOVE.forEach((f) => ($unset[f] = ""));

  console.log("📋 Fields to remove:", FIELDS_TO_REMOVE.join(", "));

  const result = await col.updateMany({}, { $unset });

  console.log(`\n── Cleanup Complete ──`);
  console.log(`  Matched:  ${result.matchedCount}`);
  console.log(`  Modified: ${result.modifiedCount}`);

  // Drop any indexes on removed fields
  console.log("\n📋 Checking indexes...");
  const indexes = await col.indexes();
  for (const idx of indexes) {
    const keys = Object.keys(idx.key);
    if (keys.some((k) => FIELDS_TO_REMOVE.includes(k))) {
      console.log(`   Dropping index: ${idx.name}`);
      try {
        await col.dropIndex(idx.name);
      } catch (e) {
        console.log(`   ⚠️  Could not drop ${idx.name}: ${e.message}`);
      }
    }
  }

  await client.close();
  console.log("\n🔌 Disconnected");
}

main().catch((err) => {
  console.error("❌ Failed:", err);
  process.exit(1);
});
