import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import mongoose from "mongoose";

const VALID = ["vidapos", "vbcustomerpos", "vbshippings"];

/**
 * POST /api/admin/drive-documents/detach
 * Body: { collection, recordId, driveFileIds: string[] }
 *
 * Removes documents from a record's driveDocuments list WITHOUT deleting the
 * underlying Drive files. Used after a drag-and-drop move INTO a folder: the
 * file physically moved in Drive, so it should no longer appear on the record's
 * flat list.
 */
export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const { collection, recordId, driveFileIds } = await req.json();

    if (!collection || !recordId || !Array.isArray(driveFileIds) || driveFileIds.length === 0) {
      return NextResponse.json({ error: "collection, recordId and driveFileIds[] are required" }, { status: 400 });
    }
    if (!VALID.includes(collection)) {
      return NextResponse.json({ error: "Invalid collection" }, { status: 400 });
    }

    const col = mongoose.connection.collection(collection);
    await col.updateOne(
      { _id: new mongoose.Types.ObjectId(recordId) },
      { $pull: { driveDocuments: { driveFileId: { $in: driveFileIds } } } as any }
    );

    return NextResponse.json({ success: true, detached: driveFileIds.length });
  } catch (error: any) {
    console.error("[drive-documents/detach] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
