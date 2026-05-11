/**
 * Migration script: Scan Google Drive VBPO folder tree and persist
 * document references into the CORRECT standalone collections:
 *   - vidapos        → driveDocuments (matched by VBNumber / vbpoNo)
 *   - vbcustomerpos  → driveDocuments (matched by VBSerialNumber / poNo)
 *   - vbshippings    → driveDocuments (matched by VBShipmentNumber / svbid)
 *
 * Drive folder structure:
 *   VBPO / {VBNumber} / Internal|External  → PO-level docs
 *   VBPO / {VBNumber} / {VBSerialNumber} / Internal|External → CPO-level docs
 *   VBPO / {VBNumber} / {VBSerialNumber} / {VBShipmentNumber} / Internal|External → Shipping-level docs
 *
 * Usage:  npx -y tsx scripts/migrate-drive-documents.ts
 */

process.loadEnvFile(".env");

import mongoose from "mongoose";
import { getDrive } from "../lib/google-drive";

const MONGO_URI = process.env.MONGODB_URI!;
const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDERID!;

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  createdTime: string;
  webViewLink: string;
}

interface DocRecord {
  documentName: string;
  documentLink: string;
  documentType: "Internal" | "External";
  driveFileId: string;
  mimeType: string;
  size: string;
  createdBy: string;
  createdAt: Date;
}

// ── Google Drive helpers ────────────────────────────

async function listChildren(parentId: string) {
  const drive = getDrive();
  const res = await drive.files.list({
    q: `'${parentId}' in parents and trashed=false`,
    fields: "files(id, name, mimeType, size, createdTime, webViewLink)",
    orderBy: "createdTime desc",
    pageSize: 1000,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    corpora: "drive",
    driveId: ROOT_FOLDER_ID,
  });
  return (res.data.files || []) as DriveFile[];
}

async function collectDocsFromFolder(folderId: string): Promise<{
  internalDocs: DocRecord[];
  externalDocs: DocRecord[];
  subFolders: { name: string; id: string }[];
}> {
  const children = await listChildren(folderId);
  const SYSTEM_FOLDERS = ["Internal", "External", "Emails"];

  const internalFolder = children.find(
    (f) => f.name === "Internal" && f.mimeType === "application/vnd.google-apps.folder"
  );
  const externalFolder = children.find(
    (f) => f.name === "External" && f.mimeType === "application/vnd.google-apps.folder"
  );

  let internalDocs: DocRecord[] = [];
  let externalDocs: DocRecord[] = [];

  if (internalFolder) {
    internalDocs = await listFilesRecursive(internalFolder.id, "Internal");
  }
  if (externalFolder) {
    externalDocs = await listFilesRecursive(externalFolder.id, "External");
  }

  // Also pick up loose files directly in the folder
  const looseFiles = children.filter(
    (f) => f.mimeType !== "application/vnd.google-apps.folder"
  );
  for (const lf of looseFiles) {
    internalDocs.push({
      documentName: lf.name,
      documentLink: lf.webViewLink || "",
      documentType: "Internal",
      driveFileId: lf.id,
      mimeType: lf.mimeType || "",
      size: lf.size || "0",
      createdBy: "System (Migration)",
      createdAt: lf.createdTime ? new Date(lf.createdTime) : new Date(),
    });
  }

  // Sub-folders that are NOT Internal/External/Emails
  const subFolders = children
    .filter(
      (f) =>
        f.mimeType === "application/vnd.google-apps.folder" &&
        !SYSTEM_FOLDERS.includes(f.name)
    )
    .map((f) => ({ name: f.name, id: f.id }));

  return { internalDocs, externalDocs, subFolders };
}

async function listFilesRecursive(
  folderId: string,
  docType: "Internal" | "External"
): Promise<DocRecord[]> {
  const children = await listChildren(folderId);
  const docs: DocRecord[] = [];

  for (const child of children) {
    if (child.mimeType === "application/vnd.google-apps.folder") {
      const nested = await listFilesRecursive(child.id, docType);
      docs.push(...nested);
    } else {
      docs.push({
        documentName: child.name,
        documentLink: child.webViewLink || "",
        documentType: docType,
        driveFileId: child.id,
        mimeType: child.mimeType || "",
        size: child.size || "0",
        createdBy: "System (Migration)",
        createdAt: child.createdTime ? new Date(child.createdTime) : new Date(),
      });
    }
  }

  return docs;
}

// ── Main migration ──────────────────────────────────

async function main() {
  console.log("🔌 Connecting to MongoDB...");
  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected\n");

  const vidapos = mongoose.connection.collection("vidapos");
  const vbcustomerpos = mongoose.connection.collection("vbcustomerpos");
  const vbshippings = mongoose.connection.collection("vbshippings");

  // Build lookup maps from the standalone collections
  console.log("📊 Building lookup maps...");

  // Map VBNumber/vbpoNo → _id for vidapos
  const poMap = new Map<string, any>();
  const allPOs = await vidapos.find({}).project({ vbpoNo: 1, VBNumber: 1 }).toArray();
  for (const po of allPOs) {
    if (po.vbpoNo) poMap.set(po.vbpoNo, po._id);
    if (po.VBNumber) poMap.set(po.VBNumber, po._id);
  }
  console.log(`  POs: ${poMap.size} entries`);

  // Map VBSerialNumber/poNo → _id for vbcustomerpos
  const cpoMap = new Map<string, any>();
  const allCPOs = await vbcustomerpos.find({}).project({ poNo: 1, VBSerialNumber: 1 }).toArray();
  for (const cpo of allCPOs) {
    if (cpo.poNo) cpoMap.set(cpo.poNo, cpo._id);
    if (cpo.VBSerialNumber) cpoMap.set(cpo.VBSerialNumber, cpo._id);
  }
  console.log(`  CPOs: ${cpoMap.size} entries`);

  // Map VBShipmentNumber/svbid → _id for vbshippings
  const shipMap = new Map<string, any>();
  const allShips = await vbshippings.find({}).project({ svbid: 1, VBShipmentNumber: 1 }).toArray();
  for (const ship of allShips) {
    if (ship.svbid) shipMap.set(ship.svbid, ship._id);
    if (ship.VBShipmentNumber) shipMap.set(ship.VBShipmentNumber, ship._id);
  }
  console.log(`  Shippings: ${shipMap.size} entries\n`);

  // Clear previous migration data
  console.log("🧹 Clearing previous driveDocuments...");
  await vidapos.updateMany({}, { $unset: { driveDocuments: "" } });
  await vbcustomerpos.updateMany({}, { $unset: { driveDocuments: "" } });
  await vbshippings.updateMany({}, { $unset: { driveDocuments: "" } });
  console.log("✅ Cleared\n");

  // Load per-file visibility overrides from the FileVisibility collection
  console.log("👁️  Loading file visibility overrides...");
  const visibilityMap = new Map<string, "Internal" | "External">();
  const fileVisibilities = mongoose.connection.collection("filevisibilities");
  const allVis = await fileVisibilities.find({}).toArray();
  for (const v of allVis) {
    const vis = (v.visibility || "").toLowerCase();
    if (vis === "external") visibilityMap.set(v.driveFileId, "External");
    else if (vis === "internal") visibilityMap.set(v.driveFileId, "Internal");
  }
  console.log(`  ${visibilityMap.size} visibility overrides loaded\n`);

  // Helper: apply visibility overrides to doc arrays
  function applyVisibility(docs: DocRecord[]): DocRecord[] {
    return docs.map((d) => {
      const override = visibilityMap.get(d.driveFileId);
      if (override) return { ...d, documentType: override };
      return d;
    });
  }

  // Step 1: Find the VBPO root folder
  const rootChildren = await listChildren(ROOT_FOLDER_ID);
  const vbpoFolder = rootChildren.find(
    (f) => f.name === "VBPO" && f.mimeType === "application/vnd.google-apps.folder"
  );
  if (!vbpoFolder) {
    console.log("❌ No VBPO folder found in root. Exiting.");
    process.exit(1);
  }
  console.log(`📂 Found VBPO root folder: ${vbpoFolder.id}\n`);

  // Step 2: List all PO folders inside VBPO
  const poFolders = await listChildren(vbpoFolder.id);
  const poFoldersOnly = poFolders.filter(
    (f) => f.mimeType === "application/vnd.google-apps.folder"
  );
  console.log(`📊 Found ${poFoldersOnly.length} PO folders\n`);

  let stats = { pos: 0, cpos: 0, ships: 0, totalDocs: 0, unmatched: 0 };

  for (const poFolder of poFoldersOnly) {
    const poName = poFolder.name; // e.g. "VB300-8"
    console.log(`\n── PO Folder: ${poName} ──`);

    // Collect docs at PO level
    const { internalDocs, externalDocs, subFolders } = await collectDocsFromFolder(poFolder.id);
    const poLevelDocs = applyVisibility([...internalDocs, ...externalDocs]);

    // Save PO-level docs
    if (poLevelDocs.length > 0) {
      const poId = poMap.get(poName);
      if (poId) {
        await vidapos.updateOne({ _id: poId }, { $set: { driveDocuments: poLevelDocs } });
        stats.pos++;
        stats.totalDocs += poLevelDocs.length;
        console.log(`  ✅ PO "${poName}": ${poLevelDocs.length} docs → vidapos`);
      } else {
        console.log(`  ⚠️  PO "${poName}" not found in vidapos. ${poLevelDocs.length} docs orphaned.`);
        stats.unmatched += poLevelDocs.length;
      }
    }

    // Process sub-folders (Level 2 = CPO / VBSerialNumber)
    for (const sub of subFolders) {
      const subName = sub.name; // e.g. "VB300-8-1"
      console.log(`  📂 Sub: ${subName}`);

      const subResult = await collectDocsFromFolder(sub.id);
      const subDocs = applyVisibility([...subResult.internalDocs, ...subResult.externalDocs]);

      // Try to match as CPO
      if (subDocs.length > 0) {
        const cpoId = cpoMap.get(subName);
        if (cpoId) {
          await vbcustomerpos.updateOne({ _id: cpoId }, { $set: { driveDocuments: subDocs } });
          stats.cpos++;
          stats.totalDocs += subDocs.length;
          console.log(`    ✅ CPO "${subName}": ${subDocs.length} docs → vbcustomerpos`);
        } else {
          // Try as shipping
          const shipId = shipMap.get(subName);
          if (shipId) {
            await vbshippings.updateOne({ _id: shipId }, { $set: { driveDocuments: subDocs } });
            stats.ships++;
            stats.totalDocs += subDocs.length;
            console.log(`    ✅ Ship "${subName}": ${subDocs.length} docs → vbshippings`);
          } else {
            console.log(`    ⚠️  "${subName}" not found in CPOs or Shippings. ${subDocs.length} docs orphaned.`);
            stats.unmatched += subDocs.length;
          }
        }
      }

      // Process deeper sub-folders (Level 3 = Shipping / VBShipmentNumber)
      for (const deep of subResult.subFolders) {
        const deepName = deep.name; // e.g. "VB300-8-1-1"
        console.log(`    📂 Deep: ${deepName}`);

        const deepResult = await collectDocsFromFolder(deep.id);
        const deepDocs = applyVisibility([...deepResult.internalDocs, ...deepResult.externalDocs]);

        if (deepDocs.length > 0) {
          const shipId = shipMap.get(deepName);
          if (shipId) {
            await vbshippings.updateOne({ _id: shipId }, { $set: { driveDocuments: deepDocs } });
            stats.ships++;
            stats.totalDocs += deepDocs.length;
            console.log(`      ✅ Ship "${deepName}": ${deepDocs.length} docs → vbshippings`);
          } else {
            // Could also be a CPO at this level
            const cpoId = cpoMap.get(deepName);
            if (cpoId) {
              await vbcustomerpos.updateOne({ _id: cpoId }, { $set: { driveDocuments: deepDocs } });
              stats.cpos++;
              stats.totalDocs += deepDocs.length;
              console.log(`      ✅ CPO "${deepName}": ${deepDocs.length} docs → vbcustomerpos`);
            } else {
              console.log(`      ⚠️  "${deepName}" not found. ${deepDocs.length} docs orphaned.`);
              stats.unmatched += deepDocs.length;
            }
          }
        }

        // Even deeper nesting (Level 4 — rare but just in case)
        for (const deeper of deepResult.subFolders) {
          const deeperName = deeper.name;
          const deeperResult = await collectDocsFromFolder(deeper.id);
          const deeperDocs = applyVisibility([...deeperResult.internalDocs, ...deeperResult.externalDocs]);

          if (deeperDocs.length > 0) {
            const sid = shipMap.get(deeperName);
            if (sid) {
              await vbshippings.updateOne({ _id: sid }, { $set: { driveDocuments: deeperDocs } });
              stats.ships++;
              stats.totalDocs += deeperDocs.length;
              console.log(`        ✅ Ship "${deeperName}": ${deeperDocs.length} docs → vbshippings`);
            } else {
              console.log(`        ⚠️  "${deeperName}" not found. ${deeperDocs.length} docs orphaned.`);
              stats.unmatched += deeperDocs.length;
            }
          }
        }
      }
    }
  }

  console.log(`\n${"═".repeat(50)}`);
  console.log(`✅ Migration complete!`);
  console.log(`   📦 POs updated:        ${stats.pos}`);
  console.log(`   📋 CPOs updated:       ${stats.cpos}`);
  console.log(`   🚢 Shippings updated:  ${stats.ships}`);
  console.log(`   📄 Total docs indexed: ${stats.totalDocs}`);
  if (stats.unmatched > 0) {
    console.log(`   ⚠️  Orphaned docs:     ${stats.unmatched}`);
  }
  console.log(`${"═".repeat(50)}\n`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Migration error:", err);
  process.exit(1);
});
