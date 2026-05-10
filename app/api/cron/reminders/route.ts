import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaUser from "@/lib/models/VidaUser";
import VidaTimeline from "@/lib/models/VidaTimeline";
import VidaNotification from "@/lib/models/VidaNotification";
import { buildLookups } from "@/lib/timeline/lookups";
import { triggerNotification } from "@/lib/pusher/server";
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
      return NextResponse.json({ fanned: 0, message: "No active Super Admins" });
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
      return NextResponse.json({ fanned: 0, message: "No due reminders" });
    }

    const lookups = await buildLookups();
    let fanned = 0;

    // Fan out: for each Super Admin × each due reminder
    for (const admin of superAdmins) {
      const userId = (admin as any)._id.toString();
      const userEmail = (admin as any).email;
      const userName = (admin as any).name;

      const newNotifications: BellNotification[] = [];

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

      // Email enqueue will be added in Step 5
    }

    return NextResponse.json({
      fanned,
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
