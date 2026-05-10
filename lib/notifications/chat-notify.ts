/**
 * Server-side helper for creating chat notifications.
 * Handles: bell (VidaNotification), email (rate-limited), and push (for mentions).
 */

import connectToDatabase from "@/lib/db";
import VidaNotification from "@/lib/models/VidaNotification";
import VidaUser from "@/lib/models/VidaUser";
import { triggerToUser } from "@/lib/pusher/server";
import { sendMail } from "@/lib/email/send";
import { renderChatEmail } from "@/lib/email/templates/chat";
import { sendPushToUser } from "@/lib/push/web-push";

// Module-level rate-limit cache: userId → last email timestamp
const emailRateLimit = new Map<string, number>();
const RATE_LIMIT_DM_MS = 5 * 60 * 1000; // 5 minutes for DMs
const RATE_LIMIT_MENTION_MS = 60 * 1000; // 1 minute for mentions

interface ChatNotifyParams {
  conversationId: string;
  conversationName: string;
  messageId: string;
  senderId: string;
  senderName: string;
  messageText: string;
  refs?: { kind: string; display: string }[];
  /** IDs of participants to notify (excluding sender) */
  recipientIds: string[];
  /** IDs of users explicitly @mentioned */
  mentionedIds?: string[];
}

export async function notifyChatRecipients(params: ChatNotifyParams) {
  const {
    conversationId,
    conversationName,
    messageId,
    senderId,
    senderName,
    messageText,
    refs = [],
    recipientIds,
    mentionedIds = [],
  } = params;

  await connectToDatabase();

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";

  const mentionedSet = new Set(mentionedIds);
  const snippet = (messageText || "📎 Attachment").substring(0, 160);

  // De-duplicate: combine recipientIds and mentionedIds
  const allTargetIds = [
    ...new Set([...recipientIds, ...mentionedIds]),
  ].filter((id) => id !== senderId);

  for (const userId of allTargetIds) {
    const isMention = mentionedSet.has(userId);
    const kind = isMention ? "mention" : "chat";
    const dedupKey = `chat:${conversationId}:${messageId}:${userId}`;

    try {
      // ── 1. Bell notification (upsert with dedupKey) ──
      const title = isMention
        ? `${senderName} mentioned you`
        : `${senderName} sent a message`;

      const message = conversationName
        ? `in ${conversationName}: ${snippet}`
        : snippet;

      const notif = await VidaNotification.findOneAndUpdate(
        { dedupKey },
        {
          $setOnInsert: {
            title,
            message,
            type: "info",
            read: false,
            createdAt: new Date(),
            kind,
            link: `/admin/chat?conv=${conversationId}`,
            sourceId: messageId,
            dedupKey,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      // ── 2. Realtime Pusher ──
      await triggerToUser(userId, "notification:new", {
        id: notif._id.toString(),
        kind,
        title,
        message,
        link: `/admin/chat?conv=${conversationId}`,
        read: false,
        createdAt: notif.createdAt?.toISOString?.() || new Date().toISOString(),
        meta: {
          conversationId,
          senderName,
        },
      });

      // ── 3. Email (rate-limited) ──
      const rateLimitKey = `${kind}:${conversationId}:${userId}`;
      const lastSent = emailRateLimit.get(rateLimitKey) || 0;
      const limitMs = isMention ? RATE_LIMIT_MENTION_MS : RATE_LIMIT_DM_MS;
      const now = Date.now();

      if (now - lastSent > limitMs) {
        // Resolve user email + name
        const user = await VidaUser.findById(userId, "email name").lean();
        if (user && (user as any).email) {
          const emailResult = renderChatEmail({
            recipientName: (user as any).name || "there",
            senderName,
            conversationName,
            messageSnippet: messageText || "📎 Attachment",
            isMention,
            refs,
            conversationId,
            appUrl,
          });

          sendMail({
            to: (user as any).email,
            subject: emailResult.subject,
            html: emailResult.html,
            text: emailResult.text,
          }).catch((err) => {
            console.error("[ChatNotify] Email failed:", err);
          });

          emailRateLimit.set(rateLimitKey, now);
        }
      }

      // ── 4. Web Push (mentions only) ──
      if (isMention) {
        sendPushToUser(userId, {
          title: `${senderName} mentioned you`,
          body: snippet,
          url: `/admin/chat?conv=${conversationId}`,
          tag: `chat-mention-${conversationId}`,
        }).catch((err) => {
          console.error("[ChatNotify] Push failed:", err);
        });
      }
    } catch (err) {
      console.error(`[ChatNotify] Error for user ${userId}:`, err);
    }
  }
}
