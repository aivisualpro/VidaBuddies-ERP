/**
 * Migration: Convert VBNumber from String → ObjectId in vbcustomerpos collection
 *
 * Usage:  node scripts/migrate-vbnumber-to-objectid.js
 */

const { MongoClient, ObjectId } = require("mongodb");

const MONGODB_URI =
  "mongodb+srv://admin:hbgsYPMDLe-8p-@bookingx.qni27fu.mongodb.net/vidaBuddies?retryWrites=true&w=majority";

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  console.log("✅ Connected to MongoDB");

  const db = client.db(); // uses the DB from the URI (vidaBuddies)
  const coll = db.collection("vbcustomerpos");

  // Find all docs where VBNumber is a non-empty string (24-char hex ObjectId string)
  const docs = await coll
    .find({
      VBNumber: { $type: "string", $ne: "" },
    })
    .toArray();

  console.log(`Found ${docs.length} docs with string VBNumber to convert`);

  let converted = 0;
  let skipped = 0;
  let errors = 0;

  for (const doc of docs) {
    const raw = doc.VBNumber;

    // Validate it's a valid 24-char hex ObjectId
    if (typeof raw === "string" && /^[a-fA-F0-9]{24}$/.test(raw)) {
      try {
        await coll.updateOne(
          { _id: doc._id },
          { $set: { VBNumber: new ObjectId(raw) } }
        );
        converted++;
      } catch (err) {
        console.error(`❌ Error converting doc ${doc._id}: ${err.message}`);
        errors++;
      }
    } else {
      console.log(
        `⚠️  Skipping doc ${doc._id} — VBNumber "${raw}" is not a valid ObjectId string`
      );
      skipped++;
    }
  }

  console.log("\n── Migration Complete ──");
  console.log(`  Converted: ${converted}`);
  console.log(`  Skipped:   ${skipped}`);
  console.log(`  Errors:    ${errors}`);

  await client.close();
  console.log("🔌 Disconnected");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
