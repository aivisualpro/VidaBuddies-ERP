/**
 * Cleanup script: Remove _originalShipId and product (singular) from vbshippings.
 * 
 * The "product" field is replaced by "products" (array).
 * Before deleting, migrates any singular product values into the products array.
 * 
 * Usage:  node cleanup-vbshippings.mjs
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
  const col = db.collection("vbshippings");

  console.log("=== Cleanup: vbshippings fields ===\n");

  // ── 1. Migrate product → products ──
  // Find docs that have singular `product` but empty/missing `products` array
  const needsMigration = await col.countDocuments({
    product: { $exists: true, $ne: "" },
    $or: [
      { products: { $exists: false } },
      { products: { $size: 0 } }
    ]
  });

  if (needsMigration > 0) {
    console.log(`⚠️  ${needsMigration} docs have 'product' but empty 'products' — migrating...`);
    
    // Use aggregation pipeline to push singular product into products array
    const migrateResult = await col.updateMany(
      {
        product: { $exists: true, $ne: "" },
        $or: [
          { products: { $exists: false } },
          { products: { $size: 0 } }
        ]
      },
      [{ $set: { products: ["$product"] } }]
    );
    console.log(`✅ Migrated: ${migrateResult.modifiedCount} docs (product → products[])\n`);
  } else {
    console.log("ℹ️  No docs need product → products migration\n");
  }

  // ── 2. Drop indexes if they exist ──
  for (const idx of ["_originalShipId_1", "product_1"]) {
    try {
      await col.dropIndex(idx);
      console.log(`✅ Dropped index: ${idx}`);
    } catch {
      console.log(`ℹ️  No ${idx} index to drop`);
    }
  }

  // ── 3. Remove _originalShipId ──
  const origCount = await col.countDocuments({ _originalShipId: { $exists: true } });
  console.log(`\nDocuments with _originalShipId: ${origCount}`);
  if (origCount > 0) {
    const r1 = await col.updateMany(
      { _originalShipId: { $exists: true } },
      { $unset: { _originalShipId: "" } }
    );
    console.log(`✅ Removed _originalShipId from ${r1.modifiedCount} documents`);
  }

  // ── 4. Remove product (singular) ──
  const prodCount = await col.countDocuments({ product: { $exists: true } });
  console.log(`\nDocuments with product (singular): ${prodCount}`);
  if (prodCount > 0) {
    const r2 = await col.updateMany(
      { product: { $exists: true } },
      { $unset: { product: "" } }
    );
    console.log(`✅ Removed product from ${r2.modifiedCount} documents`);
  }

  // ── 5. Verify ──
  const leftOrig = await col.countDocuments({ _originalShipId: { $exists: true } });
  const leftProd = await col.countDocuments({ product: { $exists: true } });
  console.log(`\n📊 Verification:`);
  console.log(`   _originalShipId remaining: ${leftOrig} (should be 0)`);
  console.log(`   product remaining: ${leftProd} (should be 0)`);

  await client.close();
  console.log("\nDone! 🎉");
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
