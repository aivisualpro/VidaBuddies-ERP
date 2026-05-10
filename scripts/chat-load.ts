#!/usr/bin/env npx ts-node
/**
 * Chat Load Test Script
 *
 * Fires 100 messages over ~5 seconds across 5 conversations
 * to validate Pusher fan-out performance and DB write throughput.
 *
 * Usage: npx ts-node scripts/chat-load.ts
 *
 * Requires MONGODB_URI in .env.local
 */

import mongoose from "mongoose";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });

const MONGO_URI = process.env.MONGODB_URI || "";
const TOTAL_MESSAGES = 100;
const BATCH_DELAY_MS = 50; // 50ms between batches = ~5s total

async function main() {
  console.log("🔥 Connecting to MongoDB…");
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db!;

  const convCol = db.collection("vidaconversations");
  const msgCol = db.collection("vidamessages");

  // Find 5 conversations (prefer ref conversations)
  const convos = await convCol
    .find({ kind: "ref" })
    .limit(5)
    .toArray();

  if (convos.length === 0) {
    console.error("❌ No ref conversations found. Run chat-seed.ts first.");
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`📋 Found ${convos.length} conversations for load test`);

  // Get a sender (first participant of first conversation)
  const senderId = convos[0].participants?.[0] || convos[0].createdBy;
  if (!senderId) {
    console.error("❌ No participant found");
    await mongoose.disconnect();
    process.exit(1);
  }

  const startTime = Date.now();
  let sent = 0;

  for (let i = 0; i < TOTAL_MESSAGES; i++) {
    const conv = convos[i % convos.length];
    const text = `Load test message #${i + 1} at ${new Date().toISOString()}`;

    await msgCol.insertOne({
      conversationId: conv._id,
      senderId,
      kind: "text",
      text,
      mentions: [],
      refs: [],
      attachments: [],
      reactions: [],
      readBy: [],
      deliveredTo: [{ userId: senderId, at: new Date() }],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    sent++;

    // Update conversation metadata
    await convCol.updateOne(
      { _id: conv._id },
      {
        $set: {
          lastMessage: text.substring(0, 200),
          lastMessageAt: new Date(),
          lastMessageBy: senderId,
        },
      }
    );

    if (i % 10 === 0) {
      process.stdout.write(`\r  ${sent}/${TOTAL_MESSAGES} sent…`);
    }

    // Throttle
    await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n\n✅ Load test complete: ${sent} messages in ${elapsed}s`);
  console.log(`   Throughput: ${(sent / parseFloat(elapsed)).toFixed(1)} msg/s`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Load test failed:", err);
  process.exit(1);
});
