import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaPO from "@/lib/models/VidaPO";
import {
  findFolder,
  findOrCreateFolder,
  moveFile,
} from "@/lib/google-drive";

const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDERID!;
const FOLDER_MIME = "application/vnd.google-apps.folder";

/** Sorted, hyphen-joined group key from VBNumbers → e.g. "VB523-VB524" */
function makeGroupKey(members: string[]): string {
  const uniq = [...new Set(members.map((m) => m.trim()).filter(Boolean))];
  uniq.sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
  );
  return uniq.join("-");
}

/**
 * POST /api/admin/purchase-orders/link-folders
 * Body: { vbNumbers: string[] }  (2+ VBNumbers to link as siblings)
 *
 * Links the given POs so they share ONE attachments folder tree. Merges any
 * existing per-PO folders' contents into the shared group folder (VBPO/{key}),
 * then stamps folderGroupKey / folderGroupMembers on every member PO.
 *
 * Idempotent: linking already-grouped POs (or adding one to an existing group)
 * re-computes the combined key and re-points everyone at it.
 */
export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const { vbNumbers } = await req.json();
    if (!Array.isArray(vbNumbers) || vbNumbers.length < 2) {
      return NextResponse.json({ error: "Provide at least 2 VBNumbers to link" }, { status: 400 });
    }

    // Load all POs (accept display names or ObjectIds)
    const pos = await VidaPO.find(
      { $or: [{ VBNumber: { $in: vbNumbers } }] },
      { VBNumber: 1, folderGroupKey: 1, folderGroupMembers: 1 }
    ).lean();

    if (pos.length < 2) {
      return NextResponse.json({ error: "Could not find 2 matching POs" }, { status: 404 });
    }

    // Expand to include any POs already grouped with the selected ones,
    // so linking A+B where B is already grouped with C yields A+B+C.
    const allMembers = new Set<string>();
    for (const po of pos) {
      allMembers.add(po.VBNumber);
      (po.folderGroupMembers || []).forEach((m: string) => allMembers.add(m));
    }
    // Pull in any other POs already sharing those members' existing keys
    const existingKeys = [...new Set(pos.map((p) => p.folderGroupKey).filter(Boolean))] as string[];
    if (existingKeys.length) {
      const linked = await VidaPO.find(
        { folderGroupKey: { $in: existingKeys } },
        { VBNumber: 1 }
      ).lean();
      linked.forEach((p) => allMembers.add(p.VBNumber));
    }

    const members = [...allMembers];
    const groupKey = makeGroupKey(members);

    // ── Merge existing per-PO Drive folders into the shared group folder ──
    const vbpoFolderId = await findOrCreateFolder(ROOT_FOLDER_ID, "VBPO");
    const groupFolderId = await findOrCreateFolder(vbpoFolderId, groupKey);

    let movedItems = 0;
    const { getDrive } = await import("@/lib/google-drive");
    const drive = getDrive();

    for (const vb of members) {
      if (vb === groupKey) continue;
      // The member's old individual folder (VBPO/{vb}) — if it exists
      const memberFolderId = await findFolder(vbpoFolderId, vb);
      if (!memberFolderId || memberFolderId === groupFolderId) continue;

      // Move every child of the member folder into the group folder
      let pageToken: string | undefined;
      do {
        const res = await drive.files.list({
          q: `'${memberFolderId}' in parents and trashed=false`,
          fields: "nextPageToken, files(id, name, mimeType)",
          pageSize: 200,
          pageToken,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
          corpora: "allDrives",
        });
        for (const f of res.data.files || []) {
          try { await moveFile(f.id!, groupFolderId); movedItems++; } catch { /* skip */ }
        }
        pageToken = res.data.nextPageToken || undefined;
      } while (pageToken);

      // Trash the now-empty member folder
      try {
        await drive.files.update({ fileId: memberFolderId, requestBody: { trashed: true }, supportsAllDrives: true });
      } catch { /* leave it */ }
    }

    // ── Stamp the group on every member PO ──
    await VidaPO.updateMany(
      { VBNumber: { $in: members } },
      { $set: { folderGroupKey: groupKey, folderGroupMembers: members } }
    );

    return NextResponse.json({
      success: true,
      groupKey,
      members,
      movedItems,
    });
  } catch (error: any) {
    console.error("[link-folders] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/purchase-orders/link-folders
 * Body: { vbNumber: string }  — unlink a PO from its sibling group.
 * (Files are left in the shared folder; the PO reverts to its own folder for
 *  future uploads.)
 */
export async function DELETE(req: NextRequest) {
  try {
    await connectToDatabase();
    const { vbNumber } = await req.json();
    if (!vbNumber) return NextResponse.json({ error: "vbNumber is required" }, { status: 400 });

    const po = await VidaPO.findOne({ VBNumber: vbNumber }, { folderGroupKey: 1, folderGroupMembers: 1 }).lean() as any;
    if (!po?.folderGroupKey) {
      return NextResponse.json({ error: "This record isn't linked" }, { status: 400 });
    }

    const remaining = (po.folderGroupMembers || []).filter((m: string) => m !== vbNumber);

    // Remove the group from this PO
    await VidaPO.updateOne({ VBNumber: vbNumber }, { $unset: { folderGroupKey: "", folderGroupMembers: "" } });

    if (remaining.length >= 2) {
      // Re-key the remaining members (their combined name may change)
      const newKey = makeGroupKey(remaining);
      await VidaPO.updateMany(
        { VBNumber: { $in: remaining } },
        { $set: { folderGroupKey: newKey, folderGroupMembers: remaining } }
      );
    } else {
      // Only one member left → dissolve the group entirely
      await VidaPO.updateMany(
        { VBNumber: { $in: remaining } },
        { $unset: { folderGroupKey: "", folderGroupMembers: "" } }
      );
    }

    return NextResponse.json({ success: true, unlinked: vbNumber, remaining });
  } catch (error: any) {
    console.error("[link-folders] DELETE Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
