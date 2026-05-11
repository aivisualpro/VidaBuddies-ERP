/**
 * Migration: Convert VBshipping fields to ObjectId references
 *
 * Fields converted:
 *   VBNumber        — string → ObjectId (ref: vidapos._id)
 *   VBSerialNumber  — string → ObjectId (ref: vbcustomerpos._id)
 *   supplier        — string → ObjectId (ref: vidasuppliers._id)
 *   supplierLocation— vbId string → ObjectId (ref: vidasuppliers.location[]._id)
 *   products[]      — string[] → ObjectId[] (ref: vidaproducts._id)
 *
 * Safety:
 *   - Backs up original string values into _backup_* fields
 *   - Skips docs that are already ObjectId
 *   - Reports unresolved values
 *
 * Usage: node scripts/migrate-shipping-to-objectid.js
 */

const { MongoClient, ObjectId } = require("mongodb");

const MONGODB_URI =
  "mongodb+srv://admin:hbgsYPMDLe-8p-@bookingx.qni27fu.mongodb.net/vidaBuddies?retryWrites=true&w=majority";

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  console.log('✅ Connected to MongoDB\n');

  const db = client.db();
  const shippings = db.collection('vbshippings');
  const vidapos = db.collection('vidapos');
  const cpos = db.collection('vbcustomerpos');
  const suppliers = db.collection('vidasuppliers');
  const products = db.collection('vidaproducts');

  // ─── Build lookup maps ───
  console.log('📋 Building lookup maps...');

  // 1. VidaPO: _id → _id (for VBNumber — current value is already _id as string)
  const poMap = new Map();
  const allPOs = await vidapos.find({}, { projection: { _id: 1, VBNumber: 1, vbpoNo: 1 } }).toArray();
  allPOs.forEach(po => {
    const idStr = po._id.toString();
    poMap.set(idStr, po._id);
    if (po.VBNumber) poMap.set(po.VBNumber, po._id);
    if (po.vbpoNo) poMap.set(po.vbpoNo, po._id);
  });
  console.log(`   VidaPO map: ${poMap.size} entries`);

  // 2. VBcustomerPO: _id → _id (for VBSerialNumber — current value is already _id as string)
  const cpoMap = new Map();
  const allCPOs = await cpos.find({}, { projection: { _id: 1, VBSerialNumber: 1, poNo: 1 } }).toArray();
  allCPOs.forEach(cpo => {
    const idStr = cpo._id.toString();
    cpoMap.set(idStr, cpo._id);
    if (cpo.VBSerialNumber) cpoMap.set(cpo.VBSerialNumber, cpo._id);
    if (cpo.poNo) cpoMap.set(cpo.poNo, cpo._id);
  });
  console.log(`   CPO map: ${cpoMap.size} entries`);

  // 3. Suppliers: _id string → _id, vbId → _id
  const supMap = new Map();
  const supLocMap = new Map(); // vbId → location subdoc _id
  const allSups = await suppliers.find({}, { projection: { _id: 1, vbId: 1, location: 1 } }).toArray();
  allSups.forEach(sup => {
    const idStr = sup._id.toString();
    supMap.set(idStr, sup._id);
    if (sup.vbId) supMap.set(sup.vbId, sup._id);
    // Location map: vbId → subdoc _id, also _id string → _id
    (sup.location || []).forEach(loc => {
      if (loc.vbId && loc._id) supLocMap.set(loc.vbId, loc._id);
      if (loc._id) supLocMap.set(loc._id.toString(), loc._id);
    });
  });
  console.log(`   Supplier map: ${supMap.size} entries, location map: ${supLocMap.size} entries`);

  // 4. Products: _id string → _id, vbId → _id
  const prodMap = new Map();
  const allProds = await products.find({}, { projection: { _id: 1, vbId: 1 } }).toArray();
  allProds.forEach(p => {
    const idStr = p._id.toString();
    prodMap.set(idStr, p._id);
    if (p.vbId) prodMap.set(p.vbId, p._id);
  });
  console.log(`   Product map: ${prodMap.size} entries\n`);

  // ─── Process all shipping docs ───
  const allShips = await shippings.find({}).toArray();
  console.log(`📋 Processing ${allShips.length} shipping documents...\n`);

  let updated = 0;
  let skipped = 0;
  const unresolved = { VBNumber: 0, VBSerialNumber: 0, supplier: 0, supplierLocation: 0, products: 0 };

  for (const ship of allShips) {
    const $set = {};
    const backups = {};
    let needsUpdate = false;

    // ── VBNumber ──
    if (ship.VBNumber && typeof ship.VBNumber === 'string') {
      const resolved = poMap.get(ship.VBNumber);
      if (resolved) {
        backups._backup_VBNumber = ship.VBNumber;
        $set.VBNumber = resolved;
        needsUpdate = true;
      } else {
        unresolved.VBNumber++;
      }
    }

    // ── VBSerialNumber ──
    if (ship.VBSerialNumber && typeof ship.VBSerialNumber === 'string') {
      const resolved = cpoMap.get(ship.VBSerialNumber);
      if (resolved) {
        backups._backup_VBSerialNumber = ship.VBSerialNumber;
        $set.VBSerialNumber = resolved;
        needsUpdate = true;
      } else {
        unresolved.VBSerialNumber++;
      }
    }

    // ── supplier ──
    if (ship.supplier && typeof ship.supplier === 'string') {
      const resolved = supMap.get(ship.supplier);
      if (resolved) {
        backups._backup_supplier = ship.supplier;
        $set.supplier = resolved;
        needsUpdate = true;
      } else {
        unresolved.supplier++;
      }
    }

    // ── supplierLocation ──
    if (ship.supplierLocation && typeof ship.supplierLocation === 'string') {
      const resolved = supLocMap.get(ship.supplierLocation);
      if (resolved) {
        backups._backup_supplierLocation = ship.supplierLocation;
        $set.supplierLocation = resolved;
        needsUpdate = true;
      } else {
        unresolved.supplierLocation++;
      }
    }

    // ── products[] ──
    if (ship.products && Array.isArray(ship.products) && ship.products.length > 0) {
      // Check if any are still strings (not already ObjectId)
      const hasStrings = ship.products.some(p => typeof p === 'string');
      if (hasStrings) {
        const resolved = [];
        let allResolved = true;
        for (const pid of ship.products) {
          if (typeof pid !== 'string') {
            resolved.push(pid); // already ObjectId
            continue;
          }
          const oid = prodMap.get(pid);
          if (oid) {
            resolved.push(oid);
          } else {
            allResolved = false;
            unresolved.products++;
          }
        }
        if (allResolved && resolved.length > 0) {
          backups._backup_products = ship.products;
          $set.products = resolved;
          needsUpdate = true;
        }
      }
    }

    if (needsUpdate) {
      await shippings.updateOne(
        { _id: ship._id },
        { $set: { ...backups, ...$set } }
      );
      updated++;
    } else {
      skipped++;
    }
  }

  console.log(`── Migration Complete ──`);
  console.log(`  Updated:  ${updated}`);
  console.log(`  Skipped:  ${skipped} (already ObjectId or empty)`);
  console.log(`  Unresolved VBNumber:        ${unresolved.VBNumber}`);
  console.log(`  Unresolved VBSerialNumber:  ${unresolved.VBSerialNumber}`);
  console.log(`  Unresolved supplier:        ${unresolved.supplier}`);
  console.log(`  Unresolved supplierLocation:${unresolved.supplierLocation}`);
  console.log(`  Unresolved products:        ${unresolved.products}`);

  await client.close();
  console.log('\n🔌 Disconnected');
}

main().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
