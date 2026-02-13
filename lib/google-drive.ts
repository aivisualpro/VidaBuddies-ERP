import { google } from "googleapis";
import path from "path";
import fs from "fs";

const SCOPES = ["https://www.googleapis.com/auth/drive"];
const SHARED_DRIVE_ID = process.env.GOOGLE_DRIVE_FOLDERID || "";

function getAuth() {
  const keyFilePath = path.join(process.cwd(), "google-service-account.json");
  const keyFile = JSON.parse(fs.readFileSync(keyFilePath, "utf8"));
  
  const impersonateEmail = process.env.GOOGLE_IMPERSONATE_EMAIL;

  if (impersonateEmail) {
    // Use JWT with domain-wide delegation (impersonation)
    // Files are created as the impersonated user → their quota is used
    const jwtClient = new google.auth.JWT({
      email: keyFile.client_email,
      key: keyFile.private_key,
      scopes: SCOPES,
      subject: impersonateEmail,
    });
    return jwtClient;
  }

  // Fallback: direct service account auth
  const auth = new google.auth.GoogleAuth({
    keyFile: keyFilePath,
    scopes: SCOPES,
  });
  return auth;
}

export function getDrive() {
  const auth = getAuth();
  return google.drive({ version: "v3", auth });
}

/**
 * Find or create a folder inside a parent folder by name.
 * Returns the folder ID.
 */
export async function findOrCreateFolder(
  parentId: string,
  folderName: string
): Promise<string> {
  const drive = getDrive();

  // Search for existing folder
  const res = await drive.files.list({
    q: `'${parentId}' in parents and name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id, name)",
    spaces: "drive",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    corpora: "drive",
    driveId: SHARED_DRIVE_ID,
  });

  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id!;
  }

  // Create new folder
  const folder = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id",
    supportsAllDrives: true,
  });

  return folder.data.id!;
}

/**
 * Ensure the full folder path exists:
 * VBPO / {poNumber} — if spoNumber is omitted
 * VBPO / {poNumber} / {spoNumber} — if spoNumber is provided
 * Returns the deepest folder ID.
 */
export async function ensureFolderPath(
  rootFolderId: string,
  poNumber: string,
  spoNumber?: string
): Promise<string> {
  const vbpoFolderId = await findOrCreateFolder(rootFolderId, "VBPO");
  const poFolderId = await findOrCreateFolder(vbpoFolderId, poNumber);
  if (!spoNumber) return poFolderId;
  const spoFolderId = await findOrCreateFolder(poFolderId, spoNumber);
  return spoFolderId;
}

/**
 * Ensure nested subfolders exist within a parent folder.
 * subPath is like "folder1/folder2" — creates each level.
 * Returns the deepest folder ID.
 */
export async function ensureSubFolderPath(
  parentFolderId: string,
  subPath: string
): Promise<string> {
  const parts = subPath.split("/").filter(Boolean);
  let currentId = parentFolderId;
  for (const part of parts) {
    currentId = await findOrCreateFolder(currentId, part);
  }
  return currentId;
}

/**
 * Upload a single file buffer to Google Drive.
 */
export async function uploadFile(
  folderId: string,
  fileName: string,
  mimeType: string,
  buffer: Buffer
): Promise<{ id: string; name: string; webViewLink: string; mimeType: string; size: string }> {
  const drive = getDrive();
  const { Readable } = await import("stream");

  const file = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: Readable.from(buffer),
    },
    fields: "id, name, webViewLink, webContentLink, mimeType, size",
    supportsAllDrives: true,
  });

  // Make the file accessible via link
  await drive.permissions.create({
    fileId: file.data.id!,
    requestBody: {
      role: "reader",
      type: "anyone",
    },
    supportsAllDrives: true,
  });

  return {
    id: file.data.id!,
    name: file.data.name!,
    webViewLink: file.data.webViewLink || "",
    mimeType: file.data.mimeType || mimeType,
    size: file.data.size || "0",
  };
}

/**
 * List all files in a folder.
 */
export async function listFiles(
  folderId: string
): Promise<
  Array<{
    id: string;
    name: string;
    mimeType: string;
    size: string;
    createdTime: string;
    webViewLink: string;
    iconLink: string;
    thumbnailLink: string;
  }>
> {
  const drive = getDrive();

  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    fields:
      "files(id, name, mimeType, size, createdTime, webViewLink, iconLink, thumbnailLink)",
    orderBy: "createdTime desc",
    pageSize: 100,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    corpora: "drive",
    driveId: SHARED_DRIVE_ID,
  });

  return (res.data.files || []).map((f) => ({
    id: f.id!,
    name: f.name!,
    mimeType: f.mimeType || "",
    size: f.size || "0",
    createdTime: f.createdTime || "",
    webViewLink: f.webViewLink || "",
    iconLink: f.iconLink || "",
    thumbnailLink: f.thumbnailLink || "",
  }));
}

/**
 * Delete files/folders from Google Drive by ID.
 * Uses "trash" approach first (works with lower Shared Drive permissions),
 * falls back to permanent delete.
 * Returns the number of successfully deleted items.
 */
export async function deleteFiles(fileIds: string[]): Promise<number> {
  const drive = getDrive();
  let deleted = 0;

  const results = await Promise.allSettled(
    fileIds.map(async (id) => {
      try {
        // Try trashing first — works with Contributor+ role on Shared Drives
        await drive.files.update({
          fileId: id,
          requestBody: { trashed: true },
          supportsAllDrives: true,
        });
      } catch (trashErr: any) {
        // Fallback: try permanent delete
        await drive.files.delete({ fileId: id, supportsAllDrives: true });
      }
    })
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      deleted++;
    } else {
      const err = result.reason as any;
      console.error("[Drive] Delete error:", err?.code, err?.message || err);
    }
  }

  return deleted;
}
