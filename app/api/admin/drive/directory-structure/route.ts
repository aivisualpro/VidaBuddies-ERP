import { NextRequest, NextResponse } from "next/server";
import { ensureFolderPath, findOrCreateFolder } from "@/lib/google-drive";
import { SHIPMENT_STANDARD_FOLDERS } from "@/lib/shipment-folders";

const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDERID!;

/**
 * POST /api/admin/drive/directory-structure
 * Ensures the standard set of shipment subfolders exists inside a shipment's
 * Drive folder. Idempotent — existing folders are left untouched.
 *
 * Body (one of):
 *   { poNumber, spoNumber, shipNumber }  → resolves/creates the folder path
 *   { folderId }                          → uses an existing folder directly
 */
export async function POST(req: NextRequest) {
  try {
    const { poNumber, spoNumber, shipNumber, folderId } = await req.json();

    let targetFolderId: string | null = folderId || null;
    if (!targetFolderId) {
      if (!poNumber) {
        return NextResponse.json(
          { error: "poNumber (with optional spoNumber/shipNumber) or folderId is required" },
          { status: 400 }
        );
      }
      targetFolderId = await ensureFolderPath(ROOT_FOLDER_ID, poNumber, spoNumber, shipNumber);
    }

    if (!targetFolderId) {
      return NextResponse.json({ error: "Could not resolve target folder" }, { status: 404 });
    }

    // Create each standard folder (idempotent — reuses existing ones)
    const created = await Promise.all(
      SHIPMENT_STANDARD_FOLDERS.map(async (name) => {
        const id = await findOrCreateFolder(targetFolderId!, name);
        return { name, id };
      })
    );

    return NextResponse.json({
      success: true,
      folderId: targetFolderId,
      folders: created,
    });
  } catch (error: any) {
    console.error("[directory-structure] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to create folders" }, { status: 500 });
  }
}
