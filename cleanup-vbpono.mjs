/**
 * Cleanup script: Remove vbpoNo field from all vidapos documents.
 * 
 * Usage:  node cleanup-vbpono.mjs
 * 
 * This is safe because VBNumber is the canonical field and vbpoNo is fully deprecated.
 */

import { MongoClient } from "mongodb";
import { readFileSync } from "fs";

// Load MONGODB_URI from .env.local
import { fileURLToPath } from "url";
import { dirname, join } from "path";
const __dirname = dirname(fileURLToPath(import.meta.url));
const envFile = readFileSync(join(__dirname, ".env"), "utf-8");
const match = envFile.match(/MONGODB_URI="?([^"\n]+)"?/);
const MONGO_URI = match?.[1];
if (!MONGO_URI) { console.error("❌ MONGODB_URI not found in .env.local"); process.exit(1); }

async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db("vidaBuddies");

  console.log("=== Cleanup: Remove vbpoNo from vidapos ===\n");

  // 1. Check how many docs still have vbpoNo
  const countBefore = await db.collection("vidapos").countDocuments({ vbpoNo: { $exists: true } });
  console.log(`Documents with vbpoNo: ${countBefore}`);

  if (countBefore === 0) {
    console.log("\n✅ No documents have vbpoNo — nothing to do!");
    await client.close();
    return;
  }

  // 2. Safety check: make sure all docs with vbpoNo also have VBNumber
  const missingVBNumber = await db.collection("vidapos").countDocuments({
    vbpoNo: { $exists: true },
    $or: [{ VBNumber: { $exists: false } }, { VBNumber: "" }]
  });

  if (missingVBNumber > 0) {
    console.log(`\n⚠️  ${missingVBNumber} docs have vbpoNo but NO VBNumber!`);
    console.log("Copying vbpoNo → VBNumber for those docs first...\n");

    const copyResult = await db.collection("vidapos").updateMany(
      {
        vbpoNo: { $exists: true, $ne: "" },
        $or: [{ VBNumber: { $exists: false } }, { VBNumber: "" }]
      },
      [{ $set: { VBNumber: "$vbpoNo" } }]
    );
    console.log(`  Copied: ${copyResult.modifiedCount} docs`);
  }

  // 3. Drop the vbpoNo index FIRST (it blocks $unset because of unique constraint)
  try {
    await db.collection("vidapos").dropIndex("vbpoNo_1");
    console.log("✅ Dropped index: vbpoNo_1");
  } catch {
    console.log("ℹ️  No vbpoNo_1 index to drop");
  }

  // 4. Remove vbpoNo from all documents
  const result = await db.collection("vidapos").updateMany(
    { vbpoNo: { $exists: true } },
    { $unset: { vbpoNo: "" } }
  );
  console.log(`\n✅ Removed vbpoNo from ${result.modifiedCount} documents`);

  // 5. Verify
  const countAfter = await db.collection("vidapos").countDocuments({ vbpoNo: { $exists: true } });
  console.log(`\n📊 Verification: ${countAfter} docs still have vbpoNo (should be 0)`);

  await client.close();
  console.log("\nDone! 🎉");
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
