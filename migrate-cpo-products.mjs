/**
 * migrate-cpo-products.mjs
 *
 * One-time migration: copies `products` (ObjectId[]) from each VBshipping
 * into its matching VBcustomerPO, where:
 *
 *   VBshipping.VBSerialNumber  ===  VBcustomerPO._id
 *
 * Safe to re-run – uses $addToSet so IDs are never duplicated.
 *
 * Usage:
 *   node migrate-cpo-products.mjs
 */

import { MongoClient, ObjectId } from 'mongodb';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envFile   = readFileSync(join(__dirname, '.env'), 'utf-8');
const match     = envFile.match(/MONGODB_URI="?([^"\n]+)"?/);
const MONGO_URI = match?.[1];
if (!MONGO_URI) { console.error('❌  MONGODB_URI not found in .env. Aborting.'); process.exit(1); }

async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  console.log('✅  Connected to MongoDB');

  const db         = client.db();                          // uses DB from URI
  const shippings  = db.collection('vbshippings');
  const customerPOs = db.collection('vbcustomerpos');

  // ── Fetch shippings that have products + a VBSerialNumber ──────────────────
  console.log('\n🔄  Fetching VBshipping records that have products and a VBSerialNumber…');

  const docs = await shippings.find(
    {
      VBSerialNumber: { $ne: null, $exists: true },
      products:       { $exists: true, $not: { $size: 0 } },
    },
    { projection: { VBSerialNumber: 1, products: 1 } }
  ).toArray();

  console.log(`📦  Found ${docs.length} VBshipping record(s) with products.\n`);

  let updated  = 0;
  let skipped  = 0;
  let notFound = 0;

  for (const ship of docs) {
    const cpoId   = ship.VBSerialNumber;  // already an ObjectId
    const products = ship.products ?? [];

    if (!products.length) { skipped++; continue; }

    const result = await customerPOs.updateOne(
      { _id: cpoId },
      { $addToSet: { products: { $each: products } } }
    );

    if (result.matchedCount === 0) {
      console.warn(`  ⚠️  No VBcustomerPO found for _id ${cpoId} (shipping _id: ${ship._id})`);
      notFound++;
    } else if (result.modifiedCount > 0) {
      console.log(`  ✔  Updated VBcustomerPO ${cpoId} — added ${products.length} product(s)`);
      updated++;
    } else {
      console.log(`  ─  VBcustomerPO ${cpoId} already had all products (no change)`);
      skipped++;
    }
  }

  console.log('\n── Summary ──────────────────────────────────────────────────────────');
  console.log(`  Updated  : ${updated}`);
  console.log(`  Skipped  : ${skipped}`);
  console.log(`  Not found: ${notFound}`);
  console.log('─────────────────────────────────────────────────────────────────────\n');

  await client.close();
  console.log('🔌  Disconnected. Done. 🎉');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
