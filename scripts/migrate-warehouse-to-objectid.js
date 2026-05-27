/**
 * Migration Script: Convert vbcustomerpos.warehouse from name (String) to ObjectId
 *
 * Matches vbcustomerpos.warehouse (name string) → vidawarehouses.name
 * Then replaces the value with vidawarehouses._id (ObjectId).
 *
 * Usage: node scripts/migrate-warehouse-to-objectid.js
 */

const fs = require('fs');
const path = require('path');

// Load .env file manually (no dotenv dependency)
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    const val = match[2].trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in .env');
  process.exit(1);
}

async function migrate() {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db(); // uses the DB from the URI

    // 1. Fetch all warehouses → build name→_id map
    const warehouses = await db.collection('vidawarehouses').find({}).toArray();
    console.log(`📦 Found ${warehouses.length} warehouses:`);
    
    const warehouseMap = new Map();
    for (const w of warehouses) {
      console.log(`   • "${w.name}" → ${w._id}`);
      warehouseMap.set(w.name, w._id);
      // Also map lowercase for case-insensitive matching
      warehouseMap.set(w.name.toLowerCase(), w._id);
    }

    // 2. Fetch all CPOs that have a string warehouse value
    const cpos = await db.collection('vbcustomerpos').find({
      warehouse: { $exists: true, $ne: null, $ne: '' }
    }).toArray();

    console.log(`\n📋 Found ${cpos.length} customer POs with warehouse values`);

    let updated = 0;
    let skipped = 0;
    let alreadyObjectId = 0;
    let notFound = 0;

    for (const cpo of cpos) {
      const currentVal = cpo.warehouse;

      // Skip if already an ObjectId
      if (currentVal instanceof ObjectId) {
        alreadyObjectId++;
        continue;
      }

      // Skip if it looks like an ObjectId string (24-char hex)
      if (typeof currentVal === 'string' && /^[a-fA-F0-9]{24}$/.test(currentVal)) {
        // Convert string ObjectId to actual ObjectId
        await db.collection('vbcustomerpos').updateOne(
          { _id: cpo._id },
          { $set: { warehouse: new ObjectId(currentVal) } }
        );
        updated++;
        console.log(`   🔄 ${cpo.VBSerialNumber || cpo._id}: Converted string ObjectId "${currentVal}" → ObjectId`);
        continue;
      }

      // Match by name
      const warehouseId = warehouseMap.get(currentVal) || warehouseMap.get(currentVal?.toLowerCase?.());
      
      if (warehouseId) {
        await db.collection('vbcustomerpos').updateOne(
          { _id: cpo._id },
          { $set: { warehouse: warehouseId } }
        );
        updated++;
        console.log(`   ✅ ${cpo.VBSerialNumber || cpo._id}: "${currentVal}" → ObjectId(${warehouseId})`);
      } else {
        notFound++;
        console.log(`   ⚠️  ${cpo.VBSerialNumber || cpo._id}: "${currentVal}" — NO MATCHING WAREHOUSE FOUND (skipped)`);
      }
    }

    console.log(`\n═══════════════════════════════════════`);
    console.log(`✅ Updated:          ${updated}`);
    console.log(`⏭️  Already ObjectId: ${alreadyObjectId}`);
    console.log(`⚠️  Not found:       ${notFound}`);
    console.log(`📊 Total processed:  ${cpos.length}`);
    console.log(`═══════════════════════════════════════`);

  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

migrate();
