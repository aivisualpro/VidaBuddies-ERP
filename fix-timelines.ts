import mongoose from "mongoose";
import fs from "fs";
import path from "path";

// Load environment variables natively (Node 20+)
try {
  process.loadEnvFile(".env");
} catch (e) {
  console.log("Could not load .env.local natively, trying fallback...");
}

async function run() {
  if (!process.env.MONGODB_URI) {
    console.error("Missing MONGODB_URI in .env.local");
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB.");

    const db = mongoose.connection.db;
    if (!db) throw new Error("DB connection failed");

    // Get all timelines that might need fixing
    const timelines = await db.collection("vidatimelines").find({}).toArray();
    console.log(`Found ${timelines.length} total timeline entries.`);

    let updatedCount = 0;

    for (const entry of timelines) {
      const updates: any = {};
      let needsUpdate = false;

      // 1. Fix VBNumber (PO)
      if (entry.VBNumber && typeof entry.VBNumber === "string" && !mongoose.isValidObjectId(entry.VBNumber)) {
        const po = await db.collection("vidapos").findOne({ 
          $or: [{ VBNumber: entry.VBNumber }, { vbpoNo: entry.VBNumber }] 
        });
        if (po) {
          updates.VBNumber = po._id.toString();
          needsUpdate = true;
        }
      }

      // 2. Fix VBSerialNumber (CPO)
      if (entry.VBSerialNumber && typeof entry.VBSerialNumber === "string" && !mongoose.isValidObjectId(entry.VBSerialNumber)) {
        // Try standalone first
        const cpo = await db.collection("vbcustomerpos").findOne({ 
          $or: [{ VBSerialNumber: entry.VBSerialNumber }, { poNo: entry.VBSerialNumber }] 
        });
        
        if (cpo) {
          updates.VBSerialNumber = cpo._id.toString();
          needsUpdate = true;
        } else {
          // Try embedded fallback
          const poWithCPO = await db.collection("vidapos").findOne({
            "customerPO": { 
              $elemMatch: { 
                $or: [{ VBSerialNumber: entry.VBSerialNumber }, { poNo: entry.VBSerialNumber }] 
              } 
            }
          });
          if (poWithCPO && poWithCPO.customerPO) {
            const embeddedCPO = poWithCPO.customerPO.find((c: any) => 
              c.VBSerialNumber === entry.VBSerialNumber || c.poNo === entry.VBSerialNumber
            );
            if (embeddedCPO && embeddedCPO._id) {
              updates.VBSerialNumber = embeddedCPO._id.toString();
              needsUpdate = true;
            }
          }
        }
      }

      // 3. Fix VBShipmentNumber (Shipping)
      if (entry.VBShipmentNumber && typeof entry.VBShipmentNumber === "string" && !mongoose.isValidObjectId(entry.VBShipmentNumber)) {
        // Try standalone first
        const ship = await db.collection("vbshippings").findOne({ 
          $or: [{ VBShipmentNumber: entry.VBShipmentNumber }, { svbid: entry.VBShipmentNumber }] 
        });
        
        if (ship) {
          updates.VBShipmentNumber = ship._id.toString();
          needsUpdate = true;
        } else {
          // Try embedded fallback
          const poWithShip = await db.collection("vidapos").findOne({
            "customerPO.shipping": { 
              $elemMatch: { 
                $or: [{ VBShipmentNumber: entry.VBShipmentNumber }, { svbid: entry.VBShipmentNumber }] 
              } 
            }
          });
          
          if (poWithShip && poWithShip.customerPO) {
            for (const cpo of poWithShip.customerPO) {
              if (cpo.shipping) {
                const embeddedShip = cpo.shipping.find((s: any) => 
                  s.VBShipmentNumber === entry.VBShipmentNumber || s.svbid === entry.VBShipmentNumber
                );
                if (embeddedShip && embeddedShip._id) {
                  updates.VBShipmentNumber = embeddedShip._id.toString();
                  needsUpdate = true;
                  break;
                }
              }
            }
          }
        }
      }

      // Apply updates if any valid object IDs were found
      if (needsUpdate) {
        await db.collection("vidatimelines").updateOne(
          { _id: entry._id },
          { $set: updates }
        );
        console.log(`Updated timeline ${entry._id} ->`, updates);
        updatedCount++;
      }
    }

    console.log(`\nMigration complete. Fixed ${updatedCount} timeline entries.`);
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
