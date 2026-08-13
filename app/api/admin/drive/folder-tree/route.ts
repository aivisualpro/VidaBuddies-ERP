import { NextRequest, NextResponse } from "next/server";
import { getDrive } from "@/lib/google-drive";

/**
 * GET /api/admin/drive/folder-tree?folderId=<rootId>[&seeds=id1,id2]
 *
 * Returns every FOLDER under the given root (BFS, depth ≤ 6, ≤ 250 folders)
 * plus per-folder DIRECT file counts:
 *   { folders: [{ id, name, parentId, depth, fileCount }], rootFileCount }
 *
 * `seeds` — folder IDs the app already shows as cards for this record. Any
 * seed not discovered under the root (e.g. legacy folders whose physical
 * parent drifted) is fetched by ID, attached at depth 1 and BFS-ed too, so
 * the Move picker ALWAYS shows every folder the file manager shows.
 */

const FOLDER_MIME = "application/vnd.google-apps.folder";
const MAX_FOLDERS = 250;
const MAX_DEPTH = 6;

interface Node {
  id: string;
  name: string;
  parentId: string;
  depth: number;
  fileCount: number;
  /** true when only reachable via a seed id (physical parent drifted) */
  viaSeed?: boolean;
}

export async function GET(req: NextRequest) {
  try {
    const rootId = req.nextUrl.searchParams.get("folderId");
    if (!rootId) return NextResponse.json({ error: "folderId required" }, { status: 400 });
    const seeds = (req.nextUrl.searchParams.get("seeds") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const drive = getDrive();
    const folders: Node[] = [];
    const seen = new Set<string>([rootId]);
    let rootFileCount = 0;

    /** List ALL children of a folder; returns subfolders and counts files. */
    const listChildren = async (parentId: string): Promise<{ subFolders: { id: string; name: string }[]; fileCount: number }> => {
      const subFolders: { id: string; name: string }[] = [];
      let fileCount = 0;
      let pageToken: string | undefined;
      try {
        do {
          const res: any = await drive.files.list({
            q: `'${parentId}' in parents and trashed=false`,
            fields: "nextPageToken, files(id, name, mimeType)",
            pageSize: 1000,
            pageToken,
          });
          for (const f of res.data.files || []) {
            if (f.mimeType === FOLDER_MIME) subFolders.push({ id: f.id!, name: f.name! });
            else fileCount++;
          }
          pageToken = res.data.nextPageToken || undefined;
        } while (pageToken);
      } catch {
        /* unreadable folder — treat as empty */
      }
      subFolders.sort((a, b) => a.name.localeCompare(b.name));
      return { subFolders, fileCount };
    };

    // ── BFS from the root ──
    let frontier: { id: string; depth: number }[] = [{ id: rootId, depth: 0 }];
    while (frontier.length > 0 && folders.length < MAX_FOLDERS) {
      const next: { id: string; depth: number }[] = [];
      for (let i = 0; i < frontier.length; i += 8) {
        const batch = frontier.slice(i, i + 8);
        const results = await Promise.all(
          batch.map(async (p) => ({ parent: p, ...(p.depth >= MAX_DEPTH ? { subFolders: [], fileCount: 0 } : await listChildren(p.id)) }))
        );
        for (const { parent, subFolders, fileCount } of results) {
          if (parent.id === rootId) rootFileCount = fileCount;
          else {
            const node = folders.find((f) => f.id === parent.id);
            if (node) node.fileCount = fileCount;
          }
          for (const c of subFolders) {
            if (folders.length >= MAX_FOLDERS || seen.has(c.id)) continue;
            seen.add(c.id);
            folders.push({ id: c.id, name: c.name, parentId: parent.id, depth: parent.depth + 1, fileCount: 0 });
            next.push({ id: c.id, depth: parent.depth + 1 });
          }
        }
      }
      frontier = next;
    }

    // ── Seeds not reachable from the root: attach at depth 1 and BFS them ──
    const missingSeeds = seeds.filter((s) => !seen.has(s));
    for (const seedId of missingSeeds) {
      if (folders.length >= MAX_FOLDERS) break;
      try {
        const meta: any = await drive.files.get({ fileId: seedId, fields: "id, name, mimeType, trashed" });
        if (meta.data.trashed || meta.data.mimeType !== FOLDER_MIME) continue;
        seen.add(seedId);
        folders.push({ id: seedId, name: meta.data.name || "Folder", parentId: rootId, depth: 1, fileCount: 0, viaSeed: true });
        // BFS inside the seed
        let sf: { id: string; depth: number }[] = [{ id: seedId, depth: 1 }];
        while (sf.length > 0 && folders.length < MAX_FOLDERS) {
          const nx: { id: string; depth: number }[] = [];
          for (const p of sf) {
            const { subFolders, fileCount } = p.depth >= MAX_DEPTH ? { subFolders: [], fileCount: 0 } : await listChildren(p.id);
            const node = folders.find((f) => f.id === p.id);
            if (node) node.fileCount = fileCount;
            for (const c of subFolders) {
              if (folders.length >= MAX_FOLDERS || seen.has(c.id)) continue;
              seen.add(c.id);
              folders.push({ id: c.id, name: c.name, parentId: p.id, depth: p.depth + 1, fileCount: 0 });
              nx.push({ id: c.id, depth: p.depth + 1 });
            }
          }
          sf = nx;
        }
      } catch {
        /* seed no longer exists */
      }
    }

    return NextResponse.json({ folders, rootId, rootFileCount });
  } catch (e: any) {
    console.error("[drive/folder-tree]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
