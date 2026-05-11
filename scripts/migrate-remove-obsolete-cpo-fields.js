/**
 * Migration: Remove obsolete fields (vbpoNo, poNo, vidaPOId) from vbcustomerpos.
 *
 * Before removing vidaPOId, ensures VBNumber is populated from vidaPOId
 * so the link to vidapos is preserved through VBNumber.
 *
 * Steps:
 *   1. For any doc where VBNumber is empty/null but vidaPOId exists → copy vidaPOId to VBNumber
 *   2. $unset vbpoNo, poNo, vidaPOId from ALL docs
 *
 * Usage:  node scripts/migrate-remove-obsolete-cpo-fields.js
 */

const { MongoClient, ObjectId } = require("mongodb");

const MONGODB_URI =
  "mongodb+srv://admin:hbgsYPMDLe-8p-@bookingx.qni27fu.mongodb.net/vidaBuddies?retryWrites=true&w=majority";

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  console.log("✅ Connected to MongoDB\n");

  const db = client.db();
  const coll = db.collection("vbcustomerpos");

  // ────────────────────────────────────────────
  // Step 1: Backfill VBNumber from vidaPOId where VBNumber is missing
  // ────────────────────────────────────────────
  const docsNeedingBackfill = await coll
    .find({
      vidaPOId: { $exists: true, $ne: null },
      $or: [
        { VBNumber: { $exists: false } },
        { VBNumber: null },
        { VBNumber: "" },
      ],
    })
    .toArray();

  console.log(
    `📋 Step 1: ${docsNeedingBackfill.length} docs need VBNumber backfilled from vidaPOId`
  );

  let backfilled = 0;
  for (const doc of docsNeedingBackfill) {
    const vidaPOId = doc.vidaPOId;
    // Ensure it's stored as ObjectId
    const asObjectId =
      vidaPOId instanceof ObjectId
        ? vidaPOId
        : typeof vidaPOId === "string" && /^[a-fA-F0-9]{24}$/.test(vidaPOId)
        ? new ObjectId(vidaPOId)
        : null;

    if (asObjectId) {
      await coll.updateOne(
        { _id: doc._id },
        { $set: { VBNumber: asObjectId } }
      );
      backfilled++;
    } else {
      console.log(
        `⚠️  Doc ${doc._id}: vidaPOId "${vidaPOId}" is not a valid ObjectId — skipping backfill`
      );
    }
  }

  console.log(`   ✅ Backfilled VBNumber on ${backfilled} docs\n`);

  // ────────────────────────────────────────────
  // Step 2: Also copy poNo → VBSerialNumber where VBSerialNumber is empty
  // ────────────────────────────────────────────
  const docsNeedingSerial = await coll
    .find({
      poNo: { $exists: true, $ne: null, $ne: "" },
      $or: [
        { VBSerialNumber: { $exists: false } },
        { VBSerialNumber: null },
        { VBSerialNumber: "" },
      ],
    })
    .toArray();

  console.log(
    `📋 Step 2: ${docsNeedingSerial.length} docs need VBSerialNumber backfilled from poNo`
  );

  let serialBackfilled = 0;
  for (const doc of docsNeedingSerial) {
    if (doc.poNo) {
      await coll.updateOne(
        { _id: doc._id },
        { $set: { VBSerialNumber: doc.poNo } }
      );
      serialBackfilled++;
    }
  }

  console.log(`   ✅ Backfilled VBSerialNumber on ${serialBackfilled} docs\n`);

  // ────────────────────────────────────────────
  // Step 3: Remove obsolete fields from ALL docs
  // ────────────────────────────────────────────
  console.log("📋 Step 3: Removing obsolete fields (vbpoNo, poNo, vidaPOId)...");

  const result = await coll.updateMany(
    {},
    { $unset: { vbpoNo: "", poNo: "", vidaPOId: "" } }
  );

  console.log(
    `   ✅ Updated ${result.modifiedCount} docs (matched ${result.matchedCount})\n`
  );

  // ────────────────────────────────────────────
  // Step 4: Verify — count docs still missing VBNumber
  // ────────────────────────────────────────────
  const missingVBNumber = await coll.countDocuments({
    $or: [
      { VBNumber: { $exists: false } },
      { VBNumber: null },
    ],
  });

  console.log("── Migration Complete ──");
  console.log(`  Backfilled VBNumber:       ${backfilled}`);
  console.log(`  Backfilled VBSerialNumber: ${serialBackfilled}`);
  console.log(`  Docs cleaned:              ${result.modifiedCount}`);
  console.log(`  Docs still missing VBNumber: ${missingVBNumber}`);

  if (missingVBNumber > 0) {
    console.log(
      "\n⚠️  Some docs have no VBNumber — they were not linked to any VidaPO."
    );
  }

  // ────────────────────────────────────────────
  // Step 5: Drop obsolete indexes
  // ────────────────────────────────────────────
  console.log("\n📋 Step 5: Dropping obsolete indexes...");
  try {
    const indexes = await coll.indexes();
    const obsoleteIndexes = indexes.filter(
      (idx) =>
        idx.key &&
        (idx.key.vbpoNo !== undefined ||
          idx.key.poNo !== undefined ||
          idx.key.vidaPOId !== undefined)
    );

    for (const idx of obsoleteIndexes) {
      console.log(`   Dropping index: ${idx.name}`);
      await coll.dropIndex(idx.name);
    }

    if (obsoleteIndexes.length === 0) {
      console.log("   No obsolete indexes found.");
    } else {
      console.log(`   ✅ Dropped ${obsoleteIndexes.length} indexes`);
    }
  } catch (err) {
    console.log(`   ⚠️ Index cleanup error (non-fatal): ${err.message}`);
  }

  await client.close();
  console.log("\n🔌 Disconnected");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
