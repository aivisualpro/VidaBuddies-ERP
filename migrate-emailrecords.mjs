/**
 * migrate-emailrecords.mjs
 * 
 * Migrates the `emailrecords` collection:
 *   1. Resolves each `vbpoNo` string (e.g. "VB439") to the matching VidaPO._id ObjectId
 *   2. Writes the ObjectId into a new `VBNumber` field
 *   3. Removes the old `vbpoNo` field
 *
 * Run:  node migrate-emailrecords.mjs
 */

import { MongoClient, ObjectId } from "mongodb";
import { readFileSync } from "fs";

// Read .env manually
const envContent = readFileSync(".env", "utf-8");
const match = envContent.match(/MONGODB_URI="?([^"\n]+)"?/);
const uri = match?.[1];
if (!uri) { console.error("❌ MONGODB_URI not found in .env"); process.exit(1); }

const client = new MongoClient(uri);

async function run() {
  await client.connect();
  const db = client.db();                       // uses DB from connection string
  const emailCol = db.collection("emailrecords");
  const posCol   = db.collection("vidapos");

  // ── Step 1: Build VBNumber → ObjectId lookup from vidapos ──
  const allPOs = await posCol.find({}, { projection: { _id: 1, VBNumber: 1 } }).toArray();
  const poMap = new Map();                       // "VB439" → ObjectId("…")
  allPOs.forEach(po => {
    if (po.VBNumber) poMap.set(po.VBNumber, po._id);
  });
  console.log(`📦 Loaded ${poMap.size} PO VBNumber→ObjectId mappings`);

  // ── Step 2: Fetch all email records that still have vbpoNo ──
  const emails = await emailCol.find({ vbpoNo: { $exists: true } }).toArray();
  console.log(`📧 Found ${emails.length} email records with vbpoNo field`);

  let resolved = 0;
  let unresolved = 0;
  let alreadyObjectId = 0;

  for (const email of emails) {
    const raw = email.vbpoNo;

    // If vbpoNo is already an ObjectId somehow, just rename it
    if (raw instanceof ObjectId) {
      await emailCol.updateOne(
        { _id: email._id },
        { $set: { VBNumber: raw }, $unset: { vbpoNo: "" } }
      );
      alreadyObjectId++;
      continue;
    }

    // Resolve the string to an ObjectId via the PO lookup
    const vbStr = String(raw).trim();
    const poId = poMap.get(vbStr);

    if (poId) {
      await emailCol.updateOne(
        { _id: email._id },
        { $set: { VBNumber: poId }, $unset: { vbpoNo: "" } }
      );
      resolved++;
    } else {
      // No matching PO found — still rename but keep as string so nothing is lost
      console.warn(`  ⚠️  No PO found for vbpoNo="${vbStr}" (email _id: ${email._id})`);
      await emailCol.updateOne(
        { _id: email._id },
        { $set: { VBNumber: vbStr }, $unset: { vbpoNo: "" } }
      );
      unresolved++;
    }
  }

  console.log("─────────────────────────────────");
  console.log(`✅ Resolved to ObjectId : ${resolved}`);
  console.log(`⚠️  Kept as string (no PO): ${unresolved}`);
  console.log(`🔄 Already ObjectId      : ${alreadyObjectId}`);
  console.log(`📧 Total processed       : ${emails.length}`);

  // ── Step 3: Drop old index on vbpoNo if it exists ──
  try {
    const indexes = await emailCol.indexes();
    const hasVbpoNoIndex = indexes.some(idx =>
      Object.keys(idx.key).includes("vbpoNo")
    );
    if (hasVbpoNoIndex) {
      await emailCol.dropIndex("vbpoNo_1");
      console.log("🗑️  Dropped index on vbpoNo");
    }
  } catch { /* index may not exist */ }

  // ── Step 4: Create index on new VBNumber field ──
  await emailCol.createIndex({ VBNumber: 1 });
  console.log("📇 Created index on VBNumber");

  // ── Verify ──
  const remaining = await emailCol.countDocuments({ vbpoNo: { $exists: true } });
  console.log(`\n🔍 Remaining docs with vbpoNo: ${remaining}`);
  if (remaining === 0) {
    console.log("🎉 Migration complete — vbpoNo fully removed from emailrecords!");
  }

  await client.close();
}

run().catch(err => { console.error("❌ Migration failed:", err); process.exit(1); });
