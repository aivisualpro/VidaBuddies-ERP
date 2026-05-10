import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaUser from "@/lib/models/VidaUser";
import VidaTimeline from "@/lib/models/VidaTimeline";
import VidaNotification from "@/lib/models/VidaNotification";
import { buildLookups } from "@/lib/timeline/lookups";
import { triggerNotification } from "@/lib/pusher/server";
import { sendPushToUser } from "@/lib/push/web-push";
import { sendMail } from "@/lib/email/send";
import { renderReminderEmail, type ReminderEmailItem } from "@/lib/email/templates/reminder";
import type { BellNotification } from "@/lib/notifications/types";

/**
 * GET /api/cron/reminders
 *
 * Daily cron job — fans out reminder notifications to ALL active Super Admins.
 * Protected via x-cron-secret header.
 *
 * For each due VidaTimeline entry, upserts a VidaNotification per Super Admin
 * with a dedupKey that includes the userId, so running multiple times per day
 * creates ZERO duplicates.
 *
 * On each newly created notification, triggers a Pusher event so the user
 * sees a live toast + badge increment without refreshing.
 *
 * After processing all items for a user, sends a single daily digest email
 * (deduplicated via email-specific dedupKey).
 */
export async function GET(req: NextRequest) {
  try {
    // Auth: cron secret header
    const secret = req.headers.get("x-cron-secret");
    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    // Load all active Super Admins
    const superAdmins = await VidaUser.find(
      { AppRole: "Super Admin", isActive: true },
      { _id: 1, name: 1, email: 1 }
    ).lean();

    if (superAdmins.length === 0) {
      return NextResponse.json({ fanned: 0, emailsSent: 0, message: "No active Super Admins" });
    }

    // End of today
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0]; // YYYY-MM-DD
    const endOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23, 59, 59, 999
    );

    // Query due reminders
    const items = await VidaTimeline.find({
      status: { $in: ["Open", "In Progress"] },
      reminder: { $ne: null, $lte: endOfToday },
    })
      .sort({ reminder: 1 })
      .lean();

    if (items.length === 0) {
      return NextResponse.json({ fanned: 0, emailsSent: 0, message: "No due reminders" });
    }

    const lookups = await buildLookups();
    const appUrl = process.env.APP_URL || "http://localhost:3000";
    let fanned = 0;
    let emailsSent = 0;
    let pushesSent = 0;

    // Fan out: for each Super Admin × each due reminder
    for (const admin of superAdmins) {
      const userId = (admin as any)._id.toString();
      const userEmail = (admin as any).email;
      const userName = (admin as any).name || "there";

      const newNotifications: BellNotification[] = [];
      const emailItems: ReminderEmailItem[] = [];

      for (const item of items) {
        const timelineId = (item as any)._id.toString();
        // Per-user dedupKey prevents duplicates
        const dedupKey = `reminder:${timelineId}:${todayStr}:${userId}`;

        const vbDisplay = (item as any).VBNumber
          ? lookups.poMap[(item as any).VBNumber] || (item as any).VBNumber
          : "";
        const serialDisplay = (item as any).VBSerialNumber
          ? lookups.cpoMap[(item as any).VBSerialNumber] || (item as any).VBSerialNumber
          : "";
        const shipDisplay = (item as any).VBShipmentNumber
          ? lookups.shipMap[(item as any).VBShipmentNumber] || (item as any).VBShipmentNumber
          : "";

        const title = `Reminder: ${(item as any).type}${vbDisplay ? ` ${vbDisplay}` : ""}`.trim();
        const message = (item as any).comments || "—";

        // Always collect for email (even if deduped in notification)
        emailItems.push({
          title,
          comments: (item as any).comments || undefined,
          vbNumber: vbDisplay || undefined,
          vbSerial: serialDisplay || undefined,
          vbShipment: shipDisplay || undefined,
          reminder: new Date((item as any).reminder || (item as any).timestamp),
          status: (item as any).status || "Open",
          link: "/admin/active-actions",
        });

        try {
          const result = await VidaNotification.updateOne(
            { dedupKey },
            {
              $setOnInsert: {
                title,
                message,
                type: "warning" as const,
                kind: "reminder" as const,
                read: false,
                userEmail,
                sourceId: timelineId,
                dedupKey,
                link: "/admin/active-actions",
                relatedId: timelineId,
                createdAt: new Date(),
              },
            },
            { upsert: true }
          );

          if (result.upsertedCount > 0) {
            fanned++;

            // Build BellNotification payload for Pusher
            const bellPayload: BellNotification = {
              id: timelineId,
              kind: "reminder",
              title,
              message,
              link: "/admin/active-actions",
              read: false,
              createdAt: (item as any).reminder
                ? new Date((item as any).reminder).toISOString()
                : new Date().toISOString(),
              meta: {
                status: (item as any).status || "Open",
                category: (item as any).category || null,
                VBNumber: vbDisplay || null,
                VBSerialNumber: serialDisplay || null,
                VBShipmentNumber: shipDisplay || null,
              },
            };

            newNotifications.push(bellPayload);
          }
        } catch (err: any) {
          if (err.code !== 11000) {
            console.error(`[Cron] Upsert failed for ${timelineId}/${userId}:`, err);
          }
        }
      }

      // Trigger Pusher for each new notification (batch per user)
      for (const notification of newNotifications) {
        await triggerNotification(
          `private-user-${userId}`,
          "notification:new",
          notification as unknown as Record<string, unknown>
        );
      }

      // ── Web Push (OS-level notifications) ──────────────
      if (newNotifications.length > 0) {
        try {
          const pushResult = await sendPushToUser(userId, {
            title: `🔔 ${items.length} reminder${items.length !== 1 ? "s" : ""} due`,
            body: newNotifications[0].title + (newNotifications.length > 1 ? ` (+${newNotifications.length - 1} more)` : ""),
            icon: "/icon-192x192.png",
            badge: "/icon-192x192.png",
            url: "/admin/active-actions",
            tag: `reminders-${todayStr}`,
          });
          pushesSent += pushResult.sent;
        } catch (pushErr: any) {
          console.error(`[Cron] Push failed for ${userId}:`, pushErr.message);
        }
      }

      // ── Daily email digest (one per user per day) ──────────
      if (emailItems.length > 0) {
        const emailDedupKey = `email-digest:${todayStr}:${userId}`;

        try {
          // Check if we already sent a digest email today for this user
          const existing = await VidaNotification.findOne({ dedupKey: emailDedupKey }).lean();

          if (!existing) {
            // Render and send the email
            const { subject, html, text } = renderReminderEmail({
              userName,
              items: emailItems,
              appUrl,
            });

            const result = await sendMail({
              to: userEmail,
              subject,
              html,
              text,
            });

            // Record the email send with a dedup marker
            await VidaNotification.updateOne(
              { dedupKey: emailDedupKey },
              {
                $setOnInsert: {
                  title: `Daily digest email sent to ${userEmail}`,
                  message: `${emailItems.length} reminders`,
                  type: "info" as const,
                  kind: "system" as const,
                  read: true,
                  userEmail,
                  dedupKey: emailDedupKey,
                  createdAt: new Date(),
                },
              },
              { upsert: true }
            );

            if (result.success) {
              emailsSent++;
              console.log(`[Cron] Digest email sent to ${userEmail} (${emailItems.length} items)`);
            } else {
              console.error(`[Cron] Email failed for ${userEmail}:`, result.error);
            }
          }
        } catch (emailErr: any) {
          console.error(`[Cron] Email error for ${userEmail}:`, emailErr);
        }
      }
    }

    return NextResponse.json({
      fanned,
      emailsSent,
      pushesSent,
      superAdmins: superAdmins.length,
      dueReminders: items.length,
    });
  } catch (error) {
    console.error("[Cron Reminders] Error:", error);
    return NextResponse.json(
      { error: "Cron failed" },
      { status: 500 }
    );
  }
}
