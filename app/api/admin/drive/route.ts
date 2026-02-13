import { NextRequest, NextResponse } from "next/server";
import {
  ensureFolderPath,
  uploadFile,
  listFiles,
  deleteFiles,
} from "@/lib/google-drive";

const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDERID!;

/**
 * GET  — List files for a PO path (optionally with SPO)
 * Query params: poNumber, spoNumber (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const poNumber = searchParams.get("poNumber");
    const spoNumber = searchParams.get("spoNumber") || undefined;

    if (!poNumber) {
      return NextResponse.json(
        { error: "poNumber is required" },
        { status: 400 }
      );
    }

    const folderId = await ensureFolderPath(ROOT_FOLDER_ID, poNumber, spoNumber);
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
 * Form data: poNumber, spoNumber (optional), file, folderId (optional)
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const poNumber = formData.get("poNumber") as string;
    const spoNumber = (formData.get("spoNumber") as string) || undefined;
    const file = formData.get("file") as File | null;
    let folderId = formData.get("folderId") as string | null;

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

    // If folderId not provided, ensure/create the folder structure
    if (!folderId) {
      folderId = await ensureFolderPath(ROOT_FOLDER_ID, poNumber, spoNumber);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadFile(
      folderId,
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

    await deleteFiles(fileIds);

    return NextResponse.json({ deleted: fileIds.length });
  } catch (error: any) {
    console.error("[Drive API] Delete error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete files" },
      { status: 500 }
    );
  }
}
