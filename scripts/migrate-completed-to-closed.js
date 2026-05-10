/**
 * Migration: Rename all "Completed" statuses to "Closed" in VidaTimeline.
 *
 * Run: node scripts/migrate-completed-to-closed.js
 *
 * After this, only 3 statuses exist: "Open", "In Progress", "Closed"
 */

const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

// Load .env manually (no dotenv dependency needed)
const envPath = path.resolve(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("❌ MONGODB_URI not set in .env");
    process.exit(1);
  }

  console.log("🔗 Connecting to MongoDB...");
  await mongoose.connect(uri);

  const db = mongoose.connection.db;
  const collection = db.collection("vidatimelines");

  // Count how many "Completed" exist before
  const beforeCount = await collection.countDocuments({ status: "Completed" });
  console.log(`📊 Found ${beforeCount} timeline entries with status "Completed"`);

  if (beforeCount === 0) {
    console.log("✅ No entries to migrate — already clean!");
    await mongoose.disconnect();
    return;
  }

  // Rename Completed → Closed
  const result = await collection.updateMany(
    { status: "Completed" },
    { $set: { status: "Closed" } }
  );

  console.log(`✅ Migrated ${result.modifiedCount} entries: "Completed" → "Closed"`);

  // Verify
  const afterCount = await collection.countDocuments({ status: "Completed" });
  console.log(`🔍 Remaining "Completed" entries: ${afterCount}`);

  // Show final status distribution
  const stats = await collection.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]).toArray();

  console.log("\n📈 Final status distribution:");
  for (const s of stats) {
    console.log(`   ${s._id || "(null)"}: ${s.count}`);
  }

  await mongoose.disconnect();
  console.log("\n🔌 Done. Disconnected.");
}

main().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
