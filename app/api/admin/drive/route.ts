import { NextRequest, NextResponse } from "next/server";
import {
  ensureFolderPath,
  ensureSubFolderPath,
  uploadFile,
  listFiles,
  deleteFiles,
} from "@/lib/google-drive";

const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDERID!;

/**
 * GET — List files
 * Query params:
 *   - folderId (optional): list files directly in this folder ID
 *   - poNumber + spoNumber (optional): resolve path then list
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const directFolderId = searchParams.get("folderId");
    const poNumber = searchParams.get("poNumber");
    const spoNumber = searchParams.get("spoNumber") || undefined;
    const shipNumber = searchParams.get("shipNumber") || undefined;
    const type = searchParams.get("type");

    let folderId: string;

    if (type === "root") {
      // List contents of the root folder (VBPO level)
      folderId = ROOT_FOLDER_ID;
    } else if (directFolderId) {
      // Direct folder ID — list contents of any folder
      folderId = directFolderId;
    } else if (poNumber) {
      folderId = await ensureFolderPath(ROOT_FOLDER_ID, poNumber, spoNumber, shipNumber);
    } else {
      return NextResponse.json(
        { error: "poNumber or folderId is required" },
        { status: 400 }
      );
    }

    const files = await listFiles(folderId);
    return NextResponse.json({ files, folderId });
  } catch (error: any) {
    console.error("[Drive API] List error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to list files" },
      { status: 500 }
    );
  }
}

/**
 * POST — Upload a single file
 * Form data:
 *   - poNumber (required)
 *   - spoNumber (optional)
 *   - file (required)
 *   - folderId (optional): skip path resolution if provided
 *   - subFolder (optional): create subfolder(s) within target, e.g. "myFolder/sub"
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const poNumber = formData.get("poNumber") as string;
    const spoNumber = (formData.get("spoNumber") as string) || undefined;
    const shipNumber = (formData.get("shipNumber") as string) || undefined;
    const file = formData.get("file") as File | null;
    let folderId = formData.get("folderId") as string | null;
    const subFolder = (formData.get("subFolder") as string) || undefined;

    if (!poNumber) {
      return NextResponse.json(
        { error: "poNumber is required" },
        { status: 400 }
      );
    }

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Resolve base folder
    if (!folderId) {
      folderId = await ensureFolderPath(ROOT_FOLDER_ID, poNumber, spoNumber, shipNumber);
    }

    // Create subfolder(s) if specified
    let targetFolderId = folderId;
    if (subFolder) {
      targetFolderId = await ensureSubFolderPath(folderId, subFolder);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadFile(
      targetFolderId,
      file.name,
      file.type || "application/octet-stream",
      buffer
    );

    return NextResponse.json({ uploaded: result, folderId });
  } catch (error: any) {
    console.error("[Drive API] Upload error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to upload file" },
      { status: 500 }
    );
  }
}

/**
 * DELETE — Delete files from Google Drive
 * Body: { fileIds: string[] }
 */
export async function DELETE(request: NextRequest) {
  try {
    const { fileIds } = await request.json();

    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return NextResponse.json(
        { error: "fileIds array is required" },
        { status: 400 }
      );
    }

    const deleted = await deleteFiles(fileIds);

    return NextResponse.json({ deleted });
  } catch (error: any) {
    console.error("[Drive API] Delete error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete files" },
      { status: 500 }
    );
  }
}
