/**
 * scripts/chat-migrate.ts
 *
 * One-time migration to back-fill new VidaConversation fields
 * on existing documents so they match the upgraded schema.
 *
 * What it does:
 *   1. Sets kind = "dm" on all conversations missing the field.
 *   2. Sets createdBy = participants[0] where createdBy is unset.
 *   3. Initialises empty arrays for admins, refs, pinned, mutedBy, archivedBy.
 *   4. Renames lastSender → lastMessageBy if present.
 *   5. Leaves VidaMessage documents untouched — new fields are all optional.
 *
 * Run:
 *   npx tsx scripts/chat-migrate.ts
 *
 * Safe to run multiple times — every update is guarded by { $exists: false }
 * or equivalent filters so re-runs are no-ops.
 */

import mongoose from 'mongoose';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Manually load .env.local (Next.js handles this at runtime, but scripts need it)
try {
  const envPath = resolve(process.cwd(), '.env.local');
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  // .env.local not found — fall through to MONGODB_URI check below
}

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || '';

async function main() {
  if (!MONGO_URI) {
    console.error('❌  No MONGODB_URI found in .env.local');
    process.exit(1);
  }

  console.log('🔌  Connecting to MongoDB…');
  await mongoose.connect(MONGO_URI);
  console.log('✅  Connected.\n');

  const col = mongoose.connection.collection('vidaconversations');

  // 1. Set kind = "dm" where missing
  const r1 = await col.updateMany(
    { kind: { $exists: false } },
    { $set: { kind: 'dm' } }
  );
  console.log(`[1/5] kind → "dm"         : ${r1.modifiedCount} updated`);

  // 2. Back-fill createdBy = participants[0]
  //    We need to iterate because $set can't reference another field in updateMany
  //    without an aggregation pipeline.
  const docsWithoutCreator = await col
    .find({ createdBy: { $exists: false } }, { projection: { participants: 1 } })
    .toArray();

  let createdByCount = 0;
  for (const doc of docsWithoutCreator) {
    const firstParticipant = doc.participants?.[0];
    if (firstParticipant) {
      await col.updateOne(
        { _id: doc._id },
        { $set: { createdBy: firstParticipant } }
      );
      createdByCount++;
    }
  }
  console.log(`[2/5] createdBy backfill  : ${createdByCount} updated`);

  // 3. Initialise empty arrays where missing
  const arrayFields = ['admins', 'refs', 'pinned', 'mutedBy', 'archivedBy'];
  let arrTotal = 0;
  for (const field of arrayFields) {
    const r = await col.updateMany(
      { [field]: { $exists: false } },
      { $set: { [field]: [] } }
    );
    arrTotal += r.modifiedCount;
  }
  console.log(`[3/5] empty arrays init   : ${arrTotal} fields set`);

  // 4. Rename lastSender → lastMessageBy
  const r4 = await col.updateMany(
    { lastSender: { $exists: true } },
    { $rename: { lastSender: 'lastMessageBy' } }
  );
  console.log(`[4/5] lastSender → lastMessageBy : ${r4.modifiedCount} renamed`);

  // 5. Initialise Maps where missing
  const mapFields = ['unreadBy', 'typing'];
  let mapTotal = 0;
  for (const field of mapFields) {
    const r = await col.updateMany(
      { [field]: { $exists: false } },
      { $set: { [field]: {} } }
    );
    mapTotal += r.modifiedCount;
  }
  console.log(`[5/5] Maps init           : ${mapTotal} fields set`);

  console.log('\n🎉  Migration complete. Messages left untouched.');
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
