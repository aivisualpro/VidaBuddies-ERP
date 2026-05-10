import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import mongoose from "mongoose";

/**
 * GET /api/admin/migrate-timeline-to-ids
 *
 * Safe migration: Convert human-readable labels in vidatimelines
 * to ObjectID strings for referential integrity.
 *
 * Before:  VBNumber = "VB300-11"
 * After:   VBNumber = "683f..." (the _id of the VidaPO doc where vbpoNo = "VB300-11")
 *
 * Safety: Backs up original labels into _VBNumberLabel, _VBSerialNumberLabel, _VBShipmentNumberLabel
 */
export async function GET() {
  try {
    await connectToDatabase();
    const db = mongoose.connection.db!;
    const timelines = db.collection("vidatimelines");
    const vidapos = db.collection("vidapos");
    const vbcustomerpos = db.collection("vbcustomerpos");
    const vbshippings = db.collection("vbshippings");

    const results: string[] = [];

    // 1. Build lookup maps: label → _id (as string)
    //    VBNumber (label like "VB300-11") → VidaPO._id
    const poLookup: Record<string, string> = {};
    const poDocs = await vidapos.find({}, { projection: { _id: 1, vbpoNo: 1, VBNumber: 1 } }).toArray();
    poDocs.forEach((doc) => {
      const label = doc.vbpoNo || doc.VBNumber || "";
      if (label) poLookup[label] = doc._id.toString();
    });
    results.push(`PO lookup built: ${Object.keys(poLookup).length} entries`);

    //    VBSerialNumber (label like "VB300-11-1") → VBcustomerPO._id
    const cpoLookup: Record<string, string> = {};
    const cpoDocs = await vbcustomerpos
      .find({}, { projection: { _id: 1, VBSerialNumber: 1, poNo: 1 } })
      .toArray();
    cpoDocs.forEach((doc) => {
      const label = doc.VBSerialNumber || doc.poNo || "";
      if (label) cpoLookup[label] = doc._id.toString();
    });
    results.push(`CPO lookup built: ${Object.keys(cpoLookup).length} entries`);

    //    VBShipmentNumber (label like "VB300-11-1-1") → VBshipping._id
    const shipLookup: Record<string, string> = {};
    const shipDocs = await vbshippings
      .find({}, { projection: { _id: 1, VBShipmentNumber: 1, svbid: 1 } })
      .toArray();
    shipDocs.forEach((doc) => {
      const label = doc.VBShipmentNumber || doc.svbid || "";
      if (label) shipLookup[label] = doc._id.toString();
    });
    results.push(`Shipping lookup built: ${Object.keys(shipLookup).length} entries`);

    // 2. Iterate all timeline docs and update
    const allTimelines = await timelines.find({}).toArray();
    results.push(`Total timeline docs: ${allTimelines.length}`);

    let updated = 0;
    let skipped = 0;
    let unresolved: string[] = [];

    for (const doc of allTimelines) {
      const updates: Record<string, any> = {};
      const currentVBNum = doc.VBNumber || "";
      const currentVBSer = doc.VBSerialNumber || "";
      const currentVBShip = doc.VBShipmentNumber || "";

      // Skip if already looks like an ObjectID (24 hex chars)
      const isObjectId = (val: string) => /^[0-9a-fA-F]{24}$/.test(val);

      // VBNumber → resolve to PO _id
      if (currentVBNum && !isObjectId(currentVBNum)) {
        const resolvedId = poLookup[currentVBNum];
        if (resolvedId) {
          updates.VBNumber = resolvedId;
          updates._VBNumberLabel = currentVBNum; // backup
        } else {
          unresolved.push(`VBNumber "${currentVBNum}" not found in vidapos`);
        }
      }

      // VBSerialNumber → resolve to CPO _id
      if (currentVBSer && !isObjectId(currentVBSer)) {
        const resolvedId = cpoLookup[currentVBSer];
        if (resolvedId) {
          updates.VBSerialNumber = resolvedId;
          updates._VBSerialNumberLabel = currentVBSer; // backup
        } else {
          unresolved.push(`VBSerialNumber "${currentVBSer}" not found in vbcustomerpos`);
        }
      }

      // VBShipmentNumber → resolve to Shipping _id
      if (currentVBShip && !isObjectId(currentVBShip)) {
        const resolvedId = shipLookup[currentVBShip];
        if (resolvedId) {
          updates.VBShipmentNumber = resolvedId;
          updates._VBShipmentNumberLabel = currentVBShip; // backup
        } else {
          unresolved.push(`VBShipmentNumber "${currentVBShip}" not found in vbshippings`);
        }
      }

      if (Object.keys(updates).length > 0) {
        await timelines.updateOne({ _id: doc._id }, { $set: updates });
        updated++;
      } else {
        skipped++;
      }
    }

    results.push(`Updated: ${updated} docs`);
    results.push(`Skipped (already IDs or empty): ${skipped} docs`);
    if (unresolved.length > 0) {
      // Deduplicate
      const unique = [...new Set(unresolved)];
      results.push(`Unresolved (${unique.length}): ${unique.slice(0, 20).join("; ")}`);
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error("Migration failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
