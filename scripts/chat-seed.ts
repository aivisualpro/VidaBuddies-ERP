#!/usr/bin/env npx ts-node
/**
 * Chat Seed Script
 *
 * Creates 3 dummy users, 5 ref conversations, and 30 messages
 * with mentions and refs to populate the chat for testing.
 *
 * Usage: npx ts-node scripts/chat-seed.ts
 *
 * Requires MONGODB_URI in .env.local
 */

import mongoose from "mongoose";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });

const MONGO_URI = process.env.MONGODB_URI || "";

async function main() {
  console.log("🌱 Connecting to MongoDB…");
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db!;

  const usersCol = db.collection("vidausers");
  const convCol = db.collection("vidaconversations");
  const msgCol = db.collection("vidamessages");

  // ── Create 3 dummy users ──
  const dummyUsers = [
    { name: "Alice Test", email: "alice-test@vida.dev", AppRole: "Manager", isActive: true },
    { name: "Bob Test", email: "bob-test@vida.dev", AppRole: "Manager", isActive: true },
    { name: "Charlie Test", email: "charlie-test@vida.dev", AppRole: "Manager", isActive: true },
  ];

  const userIds: mongoose.Types.ObjectId[] = [];
  for (const u of dummyUsers) {
    const existing = await usersCol.findOne({ email: u.email });
    if (existing) {
      userIds.push(existing._id as mongoose.Types.ObjectId);
      console.log(`  ✓ User "${u.name}" already exists`);
    } else {
      const result = await usersCol.insertOne({ ...u, password: "seeded" });
      userIds.push(result.insertedId as unknown as mongoose.Types.ObjectId);
      console.log(`  + Created user "${u.name}"`);
    }
  }

  // ── Create 5 ref conversations ──
  const refSpecs = [
    { kind: "VBNumber", refId: "seed-vb-001", display: "VB-SEED-001" },
    { kind: "VBNumber", refId: "seed-vb-002", display: "VB-SEED-002" },
    { kind: "VBSerialNumber", refId: "seed-ser-001", display: "SER-SEED-001" },
    { kind: "VBShipmentNumber", refId: "seed-ship-001", display: "SHP-SEED-001" },
    { kind: "VBShipmentNumber", refId: "seed-ship-002", display: "SHP-SEED-002" },
  ];

  const convIds: mongoose.Types.ObjectId[] = [];
  for (const ref of refSpecs) {
    const existing = await convCol.findOne({
      kind: "ref",
      "refs.refId": ref.refId,
    });
    if (existing) {
      convIds.push(existing._id as mongoose.Types.ObjectId);
      console.log(`  ✓ Conversation "${ref.display}" already exists`);
    } else {
      const result = await convCol.insertOne({
        kind: "ref",
        name: `${ref.kind}: ${ref.display}`,
        participants: userIds,
        admins: [userIds[0]],
        createdBy: userIds[0],
        refs: [ref],
        pinned: [],
        mutedBy: [],
        archivedBy: [],
        unreadBy: {},
        typing: {},
        lastMessageAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      convIds.push(result.insertedId as unknown as mongoose.Types.ObjectId);
      console.log(`  + Created conversation "${ref.display}"`);
    }
  }

  // ── Create 30 messages ──
  const phrases = [
    "Hey team, the shipment is on the way.",
    "Can someone check the PO details?",
    "I've updated the tracking number.",
    "The customer requested an ETA update.",
    "Please review the attached document.",
    "Great work on the last order!",
  ];

  let created = 0;
  for (let i = 0; i < 30; i++) {
    const convIdx = i % convIds.length;
    const senderIdx = i % userIds.length;
    const text = phrases[i % phrases.length];

    // Add a mention on every 5th message
    const mentions =
      i % 5 === 0
        ? [
            {
              userId: userIds[(senderIdx + 1) % userIds.length],
              name: dummyUsers[(senderIdx + 1) % dummyUsers.length].name,
            },
          ]
        : [];

    // Add a ref on every 3rd message
    const refs =
      i % 3 === 0 ? [refSpecs[convIdx]] : [];

    await msgCol.insertOne({
      conversationId: convIds[convIdx],
      senderId: userIds[senderIdx],
      kind: "text",
      text: `[${i + 1}] ${text}`,
      mentions,
      refs,
      attachments: [],
      reactions: [],
      readBy: [],
      deliveredTo: [{ userId: userIds[senderIdx], at: new Date() }],
      createdAt: new Date(Date.now() - (30 - i) * 60000),
      updatedAt: new Date(Date.now() - (30 - i) * 60000),
    });
    created++;
  }
  console.log(`  + Created ${created} messages across ${convIds.length} conversations`);

  // Update lastMessage on each conversation
  for (const cId of convIds) {
    const latest = await msgCol
      .find({ conversationId: cId })
      .sort({ createdAt: -1 })
      .limit(1)
      .toArray();
    if (latest.length > 0) {
      await convCol.updateOne(
        { _id: cId },
        {
          $set: {
            lastMessage: latest[0].text?.substring(0, 200),
            lastMessageAt: latest[0].createdAt,
            lastMessageBy: latest[0].senderId,
          },
        }
      );
    }
  }

  console.log("\n✅ Seed complete!");
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
