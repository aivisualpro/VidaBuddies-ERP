/**
 * Migration: Convert `customer` and `customerLocation` from vbId strings
 *            to ObjectId references in the vbcustomerpos collection.
 *
 *  customer        (e.g. "VB00001")   → vidacustomers._id
 *  customerLocation (e.g. "VB00001-1") → vidacustomers.location[]._id
 *
 * Safe: Only updates docs where the field is currently a non-empty string.
 *       Skips docs where the lookup fails (logs a warning instead).
 *
 * Usage:  node scripts/migrate-customer-fields-to-objectid.js
 */

const { MongoClient, ObjectId } = require("mongodb");

const MONGODB_URI =
  "mongodb+srv://admin:hbgsYPMDLe-8p-@bookingx.qni27fu.mongodb.net/vidaBuddies?retryWrites=true&w=majority";

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  console.log("✅ Connected to MongoDB\n");

  const db = client.db();
  const cpoColl = db.collection("vbcustomerpos");
  const custColl = db.collection("vidacustomers");

  // ────────────────────────────────────────────
  // 1. Build lookup maps from vidacustomers
  // ────────────────────────────────────────────
  const allCustomers = await custColl.find({}).toArray();
  console.log(`📦 Loaded ${allCustomers.length} customers from vidacustomers`);

  // vbId string → customer _id (ObjectId)
  const customerMap = new Map();
  // location vbId string → location subdoc _id (ObjectId)
  const locationMap = new Map();

  for (const cust of allCustomers) {
    if (cust.vbId) {
      customerMap.set(cust.vbId, cust._id);
    }
    if (Array.isArray(cust.location)) {
      for (const loc of cust.location) {
        if (loc.vbId && loc._id) {
          locationMap.set(loc.vbId, loc._id);
        }
      }
    }
  }

  console.log(`🗺️  Customer map: ${customerMap.size} entries`);
  console.log(`🗺️  Location map: ${locationMap.size} entries\n`);

  // ────────────────────────────────────────────
  // 2. Find CPO docs that need conversion
  // ────────────────────────────────────────────
  // Get docs where customer OR customerLocation is a non-empty string
  // that is NOT already a valid ObjectId (24-char hex)
  const docs = await cpoColl
    .find({
      $or: [
        { customer: { $type: "string", $ne: "" } },
        { customerLocation: { $type: "string", $ne: "" } },
      ],
    })
    .toArray();

  console.log(`Found ${docs.length} CPO docs to process\n`);

  let customerConverted = 0;
  let customerSkipped = 0;
  let locationConverted = 0;
  let locationSkipped = 0;
  let errors = 0;

  for (const doc of docs) {
    const update = {};

    // ── customer field ──
    const custVal = doc.customer;
    if (typeof custVal === "string" && custVal.length > 0) {
      // Skip if it's already an ObjectId-shaped string (already converted)
      if (/^[a-fA-F0-9]{24}$/.test(custVal)) {
        // Already looks like an ObjectId string — convert directly
        update.customer = new ObjectId(custVal);
        customerConverted++;
      } else {
        // It's a vbId like "VB00001" — look up the customer _id
        const custObjectId = customerMap.get(custVal);
        if (custObjectId) {
          update.customer = custObjectId;
          customerConverted++;
        } else {
          console.log(
            `⚠️  Doc ${doc._id}: customer "${custVal}" not found in vidacustomers — skipping`
          );
          customerSkipped++;
        }
      }
    }

    // ── customerLocation field ──
    const locVal = doc.customerLocation;
    if (typeof locVal === "string" && locVal.length > 0) {
      if (/^[a-fA-F0-9]{24}$/.test(locVal)) {
        // Already an ObjectId string — convert directly
        update.customerLocation = new ObjectId(locVal);
        locationConverted++;
      } else {
        // It's a vbId like "VB00001-1" — look up the location subdoc _id
        const locObjectId = locationMap.get(locVal);
        if (locObjectId) {
          update.customerLocation = locObjectId;
          locationConverted++;
        } else {
          console.log(
            `⚠️  Doc ${doc._id}: customerLocation "${locVal}" not found in vidacustomers.location — skipping`
          );
          locationSkipped++;
        }
      }
    }

    // ── Apply update if anything changed ──
    if (Object.keys(update).length > 0) {
      try {
        await cpoColl.updateOne({ _id: doc._id }, { $set: update });
      } catch (err) {
        console.error(`❌ Error updating doc ${doc._id}: ${err.message}`);
        errors++;
      }
    }
  }

  console.log("\n── Migration Complete ──");
  console.log(`  customer       → converted: ${customerConverted}, skipped: ${customerSkipped}`);
  console.log(`  customerLocation → converted: ${locationConverted}, skipped: ${locationSkipped}`);
  console.log(`  errors: ${errors}`);

  await client.close();
  console.log("🔌 Disconnected");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
