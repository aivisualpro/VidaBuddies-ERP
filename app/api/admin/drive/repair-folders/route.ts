import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import mongoose from "mongoose";
import { ensureFolderPath, moveFile, getParentFolderId } from "@/lib/google-drive";

const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDERID!;

/**
 * POST /api/admin/drive/repair-folders
 * Body: { vbNumber: "VB504" }
 *
 * For every record under a PO (PO, its Customer POs, its Shipments), resolves
 * the CORRECT flat Drive folder (VBPO / {PO} / {record display id}) and moves
 * any of that record's driveDocuments files/folders that are currently sitting
 * somewhere else into it. Idempotent — files already in the right place are
 * left untouched.
 */
export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const { vbNumber } = await req.json();
    if (!vbNumber) {
      return NextResponse.json({ error: "vbNumber is required" }, { status: 400 });
    }

    const db = mongoose.connection.db!;
    const vidapos = db.collection("vidapos");
    const vbcustomerpos = db.collection("vbcustomerpos");
    const vbshippings = db.collection("vbshippings");

    // Resolve the PO
    const poFilter: any[] = [{ VBNumber: vbNumber }];
    if (/^[a-fA-F0-9]{24}$/.test(vbNumber)) poFilter.push({ _id: new mongoose.Types.ObjectId(vbNumber) });
    const po = await vidapos.findOne({ $or: poFilter }, { projection: { VBNumber: 1, driveDocuments: 1 } });
    if (!po) return NextResponse.json({ error: "PO not found" }, { status: 404 });

    const poDisplay = po.VBNumber;
    const variants: any[] = [vbNumber];
    if (po._id) variants.push(po._id.toString());
    const variantMatch = variants.map((v) =>
      /^[a-fA-F0-9]{24}$/.test(v) ? new mongoose.Types.ObjectId(v) : v
    );

    const cpos = await vbcustomerpos
      .find({ VBNumber: { $in: variantMatch } }, { projection: { VBSerialNumber: 1, poNo: 1, driveDocuments: 1 } })
      .toArray();
    const ships = await vbshippings
      .find({ VBNumber: { $in: variantMatch } }, { projection: { VBShipmentNumber: 1, svbid: 1, driveDocuments: 1 } })
      .toArray();

    // Records to repair: { folderName, docs[] }
    const records: { folderName: string; docs: any[] }[] = [];
    // PO root goes straight under VBPO/{PO}
    records.push({ folderName: "", docs: po.driveDocuments || [] });
    for (const c of cpos) {
      records.push({ folderName: (c as any).VBSerialNumber || (c as any).poNo || "", docs: (c as any).driveDocuments || [] });
    }
    for (const s of ships) {
      records.push({ folderName: (s as any).svbid || (s as any).VBShipmentNumber || "", docs: (s as any).driveDocuments || [] });
    }

    let moved = 0;
    let skipped = 0;
    const errors: string[] = [];
    // Cache resolved target folders
    const targetCache = new Map<string, string>();

    for (const rec of records) {
      if (!rec.docs.length) continue;
      // Resolve target folder (flat: VBPO/{PO}/{folderName}, or the PO root)
      const cacheKey = rec.folderName || "__ROOT__";
      let targetId = targetCache.get(cacheKey);
      if (!targetId) {
        targetId = rec.folderName
          ? await ensureFolderPath(ROOT_FOLDER_ID, poDisplay, rec.folderName)
          : await ensureFolderPath(ROOT_FOLDER_ID, poDisplay);
        targetCache.set(cacheKey, targetId);
      }

      for (const doc of rec.docs) {
        const fileId = doc?.driveFileId;
        if (!fileId) continue;
        try {
          const currentParent = await getParentFolderId(fileId);
          if (currentParent === targetId) { skipped++; continue; }
          await moveFile(fileId, targetId);
          moved++;
        } catch (e: any) {
          errors.push(`${doc?.documentName || fileId}: ${e.message}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      vbNumber: poDisplay,
      moved,
      skipped,
      errors: errors.length ? errors : undefined,
    });
  } catch (error: any) {
    console.error("[repair-folders] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
