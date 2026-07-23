import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import mongoose from "mongoose";
import { getSession } from "@/lib/auth";

/**
 * GET /api/admin/drive-documents?vbNumber=VB300-8
 * 
 * Returns driveDocuments from all 3 collections (vidapos, vbcustomerpos, vbshippings)
 * for the given VBNumber hierarchy.
 * 
 * Response: {
 *   po:   { VBNumber, driveDocuments[] },
 *   cpos: [{ VBSerialNumber, driveDocuments[] }],
 *   ships:[{ VBShipmentNumber, driveDocuments[] }]
 * }
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const vbNumber = searchParams.get("vbNumber");

    if (!vbNumber) {
      return NextResponse.json({ error: "vbNumber is required" }, { status: 400 });
    }

    const vidapos = mongoose.connection.collection("vidapos");
    const vbcustomerpos = mongoose.connection.collection("vbcustomerpos");
    const vbshippings = mongoose.connection.collection("vbshippings");

    // 1. Get the PO — try by VBNumber string, or by _id if it's a valid ObjectId
    const poFilter: any[] = [{ VBNumber: vbNumber }];
    if (/^[a-fA-F0-9]{24}$/.test(vbNumber)) {
      poFilter.push({ _id: new mongoose.Types.ObjectId(vbNumber) });
    }
    const po = await vidapos.findOne(
      { $or: poFilter },
      { projection: { VBNumber: 1, driveDocuments: 1, folderGroupKey: 1, folderGroupMembers: 1 } }
    );

    // ── Sibling group support ──
    // If this PO is linked to siblings, gather ALL member POs so opening any of
    // them shows the same combined set of records, and use the shared folder key
    // as the Drive folder name.
    const groupKey: string | undefined = po?.folderGroupKey;
    let groupPOs: any[] = po ? [po] : [];
    if (groupKey) {
      groupPOs = await vidapos
        .find({ folderGroupKey: groupKey }, { projection: { VBNumber: 1, driveDocuments: 1 } })
        .toArray();
    }

    // Build the list of possible VBNumber values (display + _id) across all members
    const vbNumberVariants: string[] = [];
    for (const p of groupPOs) {
      vbNumberVariants.push(p.VBNumber);
      if (p._id) vbNumberVariants.push(p._id.toString());
    }
    if (vbNumberVariants.length === 0) vbNumberVariants.push(vbNumber);

    // 2. Get all CPOs for these VBNumbers (ObjectId reference)
    const cpoQuery: any = {
      VBNumber: { $in: vbNumberVariants.map(v => v.length === 24 ? new mongoose.Types.ObjectId(v) : v) },
    };
    const cpos = await vbcustomerpos
      .find(cpoQuery, { projection: { VBSerialNumber: 1, poNo: 1, driveDocuments: 1 } })
      .toArray();

    // 3. Get all Shippings for these VBNumbers
    const shipQuery: any = {
      VBNumber: { $in: vbNumberVariants.map(v => /^[a-fA-F0-9]{24}$/.test(v) ? new mongoose.Types.ObjectId(v) : v) },
    };
    const ships = await vbshippings
      .find(shipQuery, { projection: { VBShipmentNumber: 1, svbid: 1, VBSerialNumber: 1, driveDocuments: 1 } })
      .toArray();

    // Folder name = the shared group key when linked, else the PO's own number.
    const poDisplay = groupKey || po?.VBNumber || vbNumber;

    // FLAT Drive structure — every record's folder sits DIRECTLY under the PO,
    // named by its own display id:
    //   VBPO / {poDisplay}                 (PO root)
    //   VBPO / {poDisplay} / {VBSerialNumber}  (Customer PO)
    //   VBPO / {poDisplay} / {svbid}           (Shipment)
    // We encode this by putting the record's own folder name in `spoNumber`
    // (a single sub-level under the PO), leaving shipNumber unused.
    // PO-level docs: merge across all group members when linked
    const poDocs = groupPOs.flatMap((p: any) => p.driveDocuments || []);
    // Use the current PO as the record identity (uploads write to it), but the
    // folder + doc list reflect the whole group.
    const poLabel = groupKey || po?.VBNumber || vbNumber;

    return NextResponse.json({
      group: groupKey ? { key: groupKey, members: po?.folderGroupMembers || [] } : null,
      po: po ? {
        _id: po._id,
        VBNumber: poLabel,
        driveDocuments: poDocs,
        drivePath: { poNumber: poDisplay },
      } : null,
      cpos: cpos.map((c: any) => ({
        _id: c._id,
        VBSerialNumber: c.VBSerialNumber,
        poNo: c.poNo || "",
        driveDocuments: c.driveDocuments || [],
        drivePath: { poNumber: poDisplay, spoNumber: c.VBSerialNumber || c.poNo || "" },
      })),
      ships: ships.map((s: any) => ({
        _id: s._id,
        VBShipmentNumber: s.VBShipmentNumber || s.svbid,
        svbid: s.svbid || "",
        VBSerialNumber: s.VBSerialNumber,
        driveDocuments: s.driveDocuments || [],
        // Folder name = the shipment's own svbid/VBShipmentNumber, directly under the PO
        drivePath: { poNumber: poDisplay, spoNumber: s.svbid || s.VBShipmentNumber || "" },
      })),
    });
  } catch (error: any) {
    console.error("[drive-documents] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/admin/drive-documents
 * Push a driveDocument record to a specific collection/record.
 * Body: { collection: "vidapos"|"vbcustomerpos"|"vbshippings", recordId, document: {...} }
 */
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    const { collection, recordId, document } = await request.json();

    if (!collection || !recordId || !document) {
      return NextResponse.json({ error: "collection, recordId, and document are required" }, { status: 400 });
    }

    const validCollections = ["vidapos", "vbcustomerpos", "vbshippings"];
    if (!validCollections.includes(collection)) {
      return NextResponse.json({ error: "Invalid collection" }, { status: 400 });
    }

    // Auto-set createdBy from session
    const session = await getSession();
    if (session?.id) {
      document.createdBy = session.id;
    }

    const col = mongoose.connection.collection(collection);
    await col.updateOne(
      { _id: new mongoose.Types.ObjectId(recordId) },
      { $push: { driveDocuments: document } as any }
    );

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error: any) {
    console.error("[drive-documents] POST Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/drive-documents
 * Remove driveDocument entries from collection and delete from Google Drive.
 * Body: { collection, recordId, driveFileIds: string[] }
 */
export async function DELETE(request: NextRequest) {
  try {
    await connectToDatabase();
    const { collection, recordId, driveFileIds } = await request.json();

    if (!collection || !recordId || !driveFileIds?.length) {
      return NextResponse.json({ error: "collection, recordId, and driveFileIds are required" }, { status: 400 });
    }

    const validCollections = ["vidapos", "vbcustomerpos", "vbshippings"];
    if (!validCollections.includes(collection)) {
      return NextResponse.json({ error: "Invalid collection" }, { status: 400 });
    }

    // 1. Remove from collection's driveDocuments array
    const col = mongoose.connection.collection(collection);
    await col.updateOne(
      { _id: new mongoose.Types.ObjectId(recordId) },
      { $pull: { driveDocuments: { driveFileId: { $in: driveFileIds } } } as any }
    );

    // 2. Delete from Google Drive
    try {
      const { deleteFiles } = await import("@/lib/google-drive");
      await deleteFiles(driveFileIds);
    } catch (e) {
      console.error("[drive-documents] Drive delete error:", e);
    }

    return NextResponse.json({ deleted: driveFileIds.length });
  } catch (error: any) {
    console.error("[drive-documents] DELETE Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PUT /api/admin/drive-documents
 * Update a driveDocument field (e.g. documentType toggle).
 * Body: { collection, recordId, driveFileId, updates: { documentType: "Internal"|"External" } }
 */
export async function PUT(request: NextRequest) {
  try {
    await connectToDatabase();
    const { collection, recordId, driveFileId, updates } = await request.json();

    if (!collection || !recordId || !driveFileId || !updates) {
      return NextResponse.json({ error: "collection, recordId, driveFileId, and updates are required" }, { status: 400 });
    }

    const validCollections = ["vidapos", "vbcustomerpos", "vbshippings"];
    if (!validCollections.includes(collection)) {
      return NextResponse.json({ error: "Invalid collection" }, { status: 400 });
    }

    const col = mongoose.connection.collection(collection);

    // Build $set object for matching array element
    const setObj: any = {};
    for (const [key, val] of Object.entries(updates)) {
      setObj[`driveDocuments.$.${key}`] = val;
    }

    await col.updateOne(
      { _id: new mongoose.Types.ObjectId(recordId), "driveDocuments.driveFileId": driveFileId },
      { $set: setObj }
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[drive-documents] PUT Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/drive-documents
 * Move document(s) from one record to another.
 * Body: {
 *   sourceCollection, sourceRecordId,
 *   targetCollection, targetRecordId,
 *   driveFileIds: string[]
 * }
 */
export async function PATCH(request: NextRequest) {
  try {
    await connectToDatabase();
    const { sourceCollection, sourceRecordId, targetCollection, targetRecordId, driveFileIds } = await request.json();

    if (!sourceCollection || !sourceRecordId || !targetCollection || !targetRecordId || !driveFileIds?.length) {
      return NextResponse.json({ error: "sourceCollection, sourceRecordId, targetCollection, targetRecordId, and driveFileIds are required" }, { status: 400 });
    }

    const validCollections = ["vidapos", "vbcustomerpos", "vbshippings"];
    if (!validCollections.includes(sourceCollection) || !validCollections.includes(targetCollection)) {
      return NextResponse.json({ error: "Invalid collection" }, { status: 400 });
    }

    const srcCol = mongoose.connection.collection(sourceCollection);
    const tgtCol = mongoose.connection.collection(targetCollection);

    // 1. Get the source record's driveDocuments to find the docs being moved
    const srcRecord = await srcCol.findOne(
      { _id: new mongoose.Types.ObjectId(sourceRecordId) },
      { projection: { driveDocuments: 1 } }
    );
    const srcDocs = (srcRecord?.driveDocuments || []).filter((d: any) => driveFileIds.includes(d.driveFileId));

    if (srcDocs.length === 0) {
      return NextResponse.json({ error: "No matching documents found in source" }, { status: 404 });
    }

    // 2. Remove from source
    await srcCol.updateOne(
      { _id: new mongoose.Types.ObjectId(sourceRecordId) },
      { $pull: { driveDocuments: { driveFileId: { $in: driveFileIds } } } as any }
    );

    // 3. Add to target
    await tgtCol.updateOne(
      { _id: new mongoose.Types.ObjectId(targetRecordId) },
      { $push: { driveDocuments: { $each: srcDocs } } as any }
    );

    return NextResponse.json({ success: true, moved: srcDocs.length });
  } catch (error: any) {
    console.error("[drive-documents] PATCH Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
