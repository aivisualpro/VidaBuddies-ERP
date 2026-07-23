import { NextRequest, NextResponse } from "next/server";
import { getDrive } from "@/lib/google-drive";
import { buildZip } from "@/lib/zip";

/**
 * POST /api/admin/drive/download
 * Body: { fileIds: string[], zipName?: string }
 *
 * Single file  → streams the file with an attachment disposition (direct download).
 * Multiple      → bundles them into a ZIP and streams that.
 * Folders among the selection are expanded (their direct files are included).
 */
export async function POST(req: NextRequest) {
  try {
    const { fileIds, zipName } = await req.json();
    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      return NextResponse.json({ error: "fileIds[] is required" }, { status: 400 });
    }

    const drive = getDrive();
    const FOLDER_MIME = "application/vnd.google-apps.folder";

    // Resolve the selection into concrete downloadable files (expand folders one level)
    const toFetch: { id: string; name: string }[] = [];
    for (const id of fileIds) {
      const meta = await drive.files.get({
        fileId: id,
        fields: "id, name, mimeType",
        supportsAllDrives: true,
      });
      if (meta.data.mimeType === FOLDER_MIME) {
        const kids = await drive.files.list({
          q: `'${id}' in parents and trashed=false and mimeType != '${FOLDER_MIME}'`,
          fields: "files(id, name)",
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
          corpora: "allDrives",
          pageSize: 200,
        });
        for (const k of kids.data.files || []) {
          if (k.id) toFetch.push({ id: k.id, name: `${meta.data.name}/${k.name}` });
        }
      } else if (meta.data.id) {
        toFetch.push({ id: meta.data.id, name: meta.data.name || "file" });
      }
    }

    if (toFetch.length === 0) {
      return NextResponse.json({ error: "Nothing to download" }, { status: 404 });
    }

    // Single file → stream directly
    if (toFetch.length === 1) {
      const only = toFetch[0];
      const metaRes = await drive.files.get({ fileId: only.id, fields: "mimeType, name", supportsAllDrives: true });
      const fileRes = await drive.files.get(
        { fileId: only.id, alt: "media", supportsAllDrives: true },
        { responseType: "arraybuffer" }
      );
      const buffer = Buffer.from(fileRes.data as ArrayBuffer);
      const name = metaRes.data.name || only.name || "file";
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": metaRes.data.mimeType || "application/octet-stream",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(name)}"`,
          "Content-Length": String(buffer.length),
        },
      });
    }

    // Multiple → build a ZIP
    const entries = await Promise.all(
      toFetch.map(async (f) => {
        const res = await drive.files.get(
          { fileId: f.id, alt: "media", supportsAllDrives: true },
          { responseType: "arraybuffer" }
        );
        return { name: f.name, data: Buffer.from(res.data as ArrayBuffer) };
      })
    );

    const zip = buildZip(entries);
    const outName = (zipName || "attachments").replace(/[^\w.-]+/g, "_") + ".zip";

    return new NextResponse(new Uint8Array(zip), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(outName)}"`,
        "Content-Length": String(zip.length),
      },
    });
  } catch (error: any) {
    console.error("[Drive Download] Error:", error?.message);
    return NextResponse.json({ error: error?.message || "Download failed" }, { status: 500 });
  }
}
