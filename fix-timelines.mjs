import { readFileSync } from "fs";
import { MongoClient, ObjectId } from "mongodb";

// Parse .env file manually
const envContent = readFileSync(".env", "utf-8");
const envVars = {};
envContent.split("\n").forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) envVars[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
});

const uri = envVars.MONGODB_URI;
if (!uri) { console.error("Missing MONGODB_URI in .env"); process.exit(1); }

async function run() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log("Connected to MongoDB.");

    const db = client.db(); // uses DB from connection string

    // Build lookup maps: display name → ObjectId string
    const pos = await db.collection("vidapos").find({}, { projection: { _id: 1, VBNumber: 1, vbpoNo: 1 } }).toArray();
    const cpos = await db.collection("vbcustomerpos").find({}, { projection: { _id: 1, VBSerialNumber: 1, poNo: 1 } }).toArray();
    const ships = await db.collection("vbshippings").find({}, { projection: { _id: 1, VBShipmentNumber: 1, svbid: 1 } }).toArray();

    // Map: display string → ObjectId string
    const poMap = {};
    pos.forEach(p => {
      if (p.VBNumber) poMap[p.VBNumber] = p._id.toString();
      if (p.vbpoNo) poMap[p.vbpoNo] = p._id.toString();
    });

    const cpoMap = {};
    cpos.forEach(c => {
      if (c.VBSerialNumber) cpoMap[c.VBSerialNumber] = c._id.toString();
      if (c.poNo) cpoMap[c.poNo] = c._id.toString();
    });

    const shipMap = {};
    ships.forEach(s => {
      if (s.VBShipmentNumber) shipMap[s.VBShipmentNumber] = s._id.toString();
      if (s.svbid) shipMap[s.svbid] = s._id.toString();
    });

    console.log(`Lookup maps: ${Object.keys(poMap).length} POs, ${Object.keys(cpoMap).length} CPOs, ${Object.keys(shipMap).length} Ships`);

    // Get all timelines
    const timelines = await db.collection("vidatimelines").find({}).toArray();
    console.log(`Found ${timelines.length} total timeline entries.`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const entry of timelines) {
      const updates = {};
      let needsUpdate = false;

      // Check if value is NOT a valid ObjectId (i.e. it's a display string that needs fixing)
      const isNotObjectId = (val) => {
        if (!val || typeof val !== "string") return false;
        return !/^[a-f0-9]{24}$/i.test(val);
      };

      // Check if value is a valid hex string but stored as String type (not ObjectId)
      const isStringObjectId = (val) => {
        if (!val || typeof val !== "string") return false;
        return /^[a-f0-9]{24}$/i.test(val);
      };

      // 1. Fix VBNumber
      if (isNotObjectId(entry.VBNumber)) {
        const resolved = poMap[entry.VBNumber];
        if (resolved) {
          updates.VBNumber = new ObjectId(resolved);
          needsUpdate = true;
        } else {
          console.log(`  ⚠ Could not resolve VBNumber "${entry.VBNumber}" for timeline ${entry._id}`);
        }
      }

      // 2. Fix VBSerialNumber
      if (isNotObjectId(entry.VBSerialNumber)) {
        const resolved = cpoMap[entry.VBSerialNumber];
        if (resolved) {
          updates.VBSerialNumber = new ObjectId(resolved);
          needsUpdate = true;
        } else {
          console.log(`  ⚠ Could not resolve VBSerialNumber "${entry.VBSerialNumber}" for timeline ${entry._id}`);
        }
      }

      // 3. Fix VBShipmentNumber
      if (isNotObjectId(entry.VBShipmentNumber)) {
        const resolved = shipMap[entry.VBShipmentNumber];
        if (resolved) {
          updates.VBShipmentNumber = new ObjectId(resolved);
          needsUpdate = true;
        } else {
          console.log(`  ⚠ Could not resolve VBShipmentNumber "${entry.VBShipmentNumber}" for timeline ${entry._id}`);
        }
      }

      // Second pass: fix values that are valid hex but stored as String type (from previous run)
      if (!updates.VBNumber && isStringObjectId(entry.VBNumber)) {
        updates.VBNumber = new ObjectId(entry.VBNumber);
        needsUpdate = true;
      }
      if (!updates.VBSerialNumber && isStringObjectId(entry.VBSerialNumber)) {
        updates.VBSerialNumber = new ObjectId(entry.VBSerialNumber);
        needsUpdate = true;
      }
      if (!updates.VBShipmentNumber && isStringObjectId(entry.VBShipmentNumber)) {
        updates.VBShipmentNumber = new ObjectId(entry.VBShipmentNumber);
        needsUpdate = true;
      }

      if (needsUpdate) {
        await db.collection("vidatimelines").updateOne(
          { _id: entry._id },
          { $set: updates }
        );
        console.log(`✅ Fixed timeline ${entry._id} →`, updates);
        updatedCount++;
      } else {
        skippedCount++;
      }
    }

    console.log(`\n━━━ Migration Complete ━━━`);
    console.log(`  Fixed:   ${updatedCount}`);
    console.log(`  Skipped: ${skippedCount} (already correct)`);
    console.log(`  Total:   ${timelines.length}`);
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.close();
    process.exit(0);
  }
}

run();
