#!/usr/bin/env node
/**
 * Adds broadcastMutation() calls to admin API route files.
 * This script is idempotent — it skips files that already have the import.
 *
 * Run: node scripts/add-pusher-broadcast.mjs
 */

import { readFileSync, writeFileSync } from "fs";

const BASE = process.cwd() + "/app/api/admin";

// [file, resource-key] pairs
// List routes contain POST (create), detail routes contain PUT/DELETE
const ROUTES = [
  // ── List routes (POST = create) ──
  [`${BASE}/products/route.ts`,           "products"],
  [`${BASE}/customers/route.ts`,          "customers"],
  [`${BASE}/suppliers/route.ts`,          "suppliers"],
  [`${BASE}/categories/route.ts`,         "categories"],
  [`${BASE}/carriers/route.ts`,           "carriers"],
  [`${BASE}/warehouse/route.ts`,          "warehouses"],
  [`${BASE}/users/route.ts`,              "users"],
  [`${BASE}/vb-shipping/route.ts`,        "vb-shipping"],
  [`${BASE}/vb-customer-po/route.ts`,     "vb-customer-po"],
  [`${BASE}/release-requests/route.ts`,   "release-requests"],
  // ── Detail routes (PUT = update, DELETE = delete) ──
  [`${BASE}/products/[id]/route.ts`,          "products"],
  [`${BASE}/customers/[id]/route.ts`,         "customers"],
  [`${BASE}/suppliers/[id]/route.ts`,         "suppliers"],
  [`${BASE}/categories/[id]/route.ts`,        "categories"],
  [`${BASE}/warehouse/[id]/route.ts`,         "warehouses"],
  [`${BASE}/users/[id]/route.ts`,             "users"],
  [`${BASE}/vb-shipping/[id]/route.ts`,       "vb-shipping"],
  [`${BASE}/vb-customer-po/[id]/route.ts`,    "vb-customer-po"],
  [`${BASE}/release-requests/[id]/route.ts`,  "release-requests"],
];

let updated = 0;
let skipped = 0;

for (const [filePath, resource] of ROUTES) {
  let content;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    console.log(`⏭  SKIP (not found): ${filePath}`);
    skipped++;
    continue;
  }

  if (content.includes("broadcastMutation")) {
    console.log(`⏭  SKIP (already has broadcast): ${filePath}`);
    skipped++;
    continue;
  }

  // 1. Add import after the last existing import
  const lastImportIdx = content.lastIndexOf("\nimport ");
  if (lastImportIdx === -1) {
    console.log(`⚠️  SKIP (no imports found): ${filePath}`);
    skipped++;
    continue;
  }
  const endOfImportLine = content.indexOf("\n", lastImportIdx + 1);
  const importLine = `\nimport { broadcastMutation } from "@/lib/pusher/broadcast";`;
  content = content.slice(0, endOfImportLine) + importLine + content.slice(endOfImportLine);

  // 2. Add broadcast after successful create (POST)
  // Pattern: NextResponse.json(newItem) or NextResponse.json(newItem, { status: 201 })
  content = content.replace(
    /(const newItem = await \w+\.create\([^)]*\);)\n/g,
    `$1\n    broadcastMutation("${resource}", "create", newItem._id?.toString());\n`
  );

  // 3. Add broadcast after successful update (PUT)
  // Pattern: return NextResponse.json(updatedItem);
  content = content.replace(
    /(\s+)(return NextResponse\.json\(updatedItem\);)/g,
    `$1broadcastMutation("${resource}", "update", id);\n$1$2`
  );
  // Also: return NextResponse.json(updated);
  content = content.replace(
    /(\s+)(return NextResponse\.json\(updated\);)/g,
    `$1broadcastMutation("${resource}", "update", id);\n$1$2`
  );

  // 4. Add broadcast after successful delete (DELETE)
  // Pattern: return NextResponse.json({ message: "..." deleted..." });
  content = content.replace(
    /(\s+)(return NextResponse\.json\(\{[^}]*deleted[^}]*\}\);)/gi,
    `$1broadcastMutation("${resource}", "delete", id);\n$1$2`
  );
  // Also: return NextResponse.json({ success: true });
  content = content.replace(
    /(\s+)(return NextResponse\.json\(\{ success: true \}\);)/g,
    `$1broadcastMutation("${resource}", "delete", id);\n$1$2`
  );

  writeFileSync(filePath, content, "utf-8");
  console.log(`✅ Updated: ${filePath}`);
  updated++;
}

console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}`);
