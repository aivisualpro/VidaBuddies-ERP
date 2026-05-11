import { NextRequest, NextResponse } from "next/server";
import { getDrive } from "@/lib/google-drive";

/**
 * GET /api/admin/drive/preview/:fileId
 * Proxies a Google Drive file for inline preview.
 * Bypasses Google's CSP frame-ancestors restrictions.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId } = await params;
    if (!fileId) {
      return NextResponse.json({ error: "fileId required" }, { status: 400 });
    }

    const drive = getDrive();

    // 1. Get file metadata for Content-Type
    const meta = await drive.files.get({
      fileId,
      fields: "mimeType,name,size",
      supportsAllDrives: true,
    });

    const mimeType = meta.data.mimeType || "application/octet-stream";
    const fileName = meta.data.name || "file";

    // 2. Download file content
    const fileRes = await drive.files.get(
      { fileId, alt: "media", supportsAllDrives: true },
      { responseType: "arraybuffer" }
    );

    const buffer = Buffer.from(fileRes.data as ArrayBuffer);

    // 3. Return with proper headers for inline display
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error: any) {
    console.error("[Drive Preview] Error:", error?.message);
    return NextResponse.json(
      { error: error?.message || "Failed to load preview" },
      { status: 500 }
    );
  }
}
