/**
 * Cleanup script: Remove _originalCpoId field from all vbcustomerpos documents.
 * 
 * Usage:  node cleanup-originalcpoid.mjs
 */

import { MongoClient } from "mongodb";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envFile = readFileSync(join(__dirname, ".env"), "utf-8");
const match = envFile.match(/MONGODB_URI="?([^"\n]+)"?/);
const MONGO_URI = match?.[1];
if (!MONGO_URI) { console.error("❌ MONGODB_URI not found in .env"); process.exit(1); }

async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db("vidaBuddies");
  const col = db.collection("vbcustomerpos");

  console.log("=== Cleanup: Remove _originalCpoId from vbcustomerpos ===\n");

  const countBefore = await col.countDocuments({ _originalCpoId: { $exists: true } });
  console.log(`Documents with _originalCpoId: ${countBefore}`);

  if (countBefore === 0) {
    console.log("\n✅ No documents have _originalCpoId — nothing to do!");
    await client.close();
    return;
  }

  // Drop any index on _originalCpoId first (in case unique index exists)
  try {
    await col.dropIndex("_originalCpoId_1");
    console.log("✅ Dropped index: _originalCpoId_1");
  } catch {
    console.log("ℹ️  No _originalCpoId_1 index to drop");
  }

  // Remove _originalCpoId from all documents
  const result = await col.updateMany(
    { _originalCpoId: { $exists: true } },
    { $unset: { _originalCpoId: "" } }
  );
  console.log(`\n✅ Removed _originalCpoId from ${result.modifiedCount} documents`);

  // Verify
  const countAfter = await col.countDocuments({ _originalCpoId: { $exists: true } });
  console.log(`\n📊 Verification: ${countAfter} docs still have _originalCpoId (should be 0)`);

  await client.close();
  console.log("\nDone! 🎉");
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
