import { NextRequest, NextResponse } from "next/server";
import { getDrive } from "@/lib/google-drive";

const FOLDER_MIME = "application/vnd.google-apps.folder";

/**
 * GET /api/admin/drive/all-files?folderId=XYZ
 * Recursively lists every FILE (not folders) under the given folder, with the
 * relative folder path each lives in. Used by the "All Files" tab so files
 * across subfolders can be seen together and merged.
 */
export async function GET(req: NextRequest) {
  try {
    const folderId = req.nextUrl.searchParams.get("folderId");
    if (!folderId) {
      return NextResponse.json({ error: "folderId is required" }, { status: 400 });
    }

    const drive = getDrive();
    const out: any[] = [];

    // BFS through the folder tree (cap depth/size to stay safe)
    const queue: { id: string; path: string }[] = [{ id: folderId, path: "" }];
    let visited = 0;
    const MAX_FOLDERS = 300;

    while (queue.length > 0 && visited < MAX_FOLDERS) {
      const { id, path } = queue.shift()!;
      visited++;

      let pageToken: string | undefined;
      do {
        const res = await drive.files.list({
          q: `'${id}' in parents and trashed=false`,
          fields: "nextPageToken, files(id, name, mimeType, size, createdTime, webViewLink)",
          pageSize: 200,
          pageToken,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
          corpora: "allDrives",
          orderBy: "name",
        });
        for (const f of res.data.files || []) {
          if (f.mimeType === FOLDER_MIME) {
            queue.push({ id: f.id!, path: path ? `${path}/${f.name}` : f.name! });
          } else {
            out.push({
              id: f.id,
              name: f.name,
              mimeType: f.mimeType || "",
              size: f.size || "0",
              createdTime: f.createdTime || "",
              webViewLink: f.webViewLink || "",
              folderPath: path || "(root)",
            });
          }
        }
        pageToken = res.data.nextPageToken || undefined;
      } while (pageToken);
    }

    return NextResponse.json({ files: out, count: out.length });
  } catch (error: any) {
    console.error("[Drive all-files] Error:", error?.message);
    return NextResponse.json({ error: error?.message || "Failed to list files" }, { status: 500 });
  }
}
