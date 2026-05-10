import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import { getSession } from "@/lib/auth";
import VidaUser from "@/lib/models/VidaUser";
import VidaTimeline from "@/lib/models/VidaTimeline";
import VidaNotification from "@/lib/models/VidaNotification";
import { buildLookups } from "@/lib/timeline/lookups";
import { triggerNotification } from "@/lib/pusher/server";
import type { BellNotification } from "@/lib/notifications/types";

/**
 * POST /api/notifications/reminders/sync
 *
 * Upserts VidaNotification rows for each due reminder using dedupKey
 * to ensure running this multiple times per day creates ZERO duplicates.
 * Only accessible by Super Admins.
 */
export async function POST() {
  try {
    const session = await getSession();
    if (!session?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const user = await VidaUser.findOne(
      { email: session.email },
      { _id: 1, AppRole: 1 }
    ).lean();

    if (!user || (user as any).AppRole !== "Super Admin") {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const userId = (user as any)._id.toString();

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

    const lookups = await buildLookups();
    let created = 0;
    let skipped = 0;

    for (const item of items) {
      const timelineId = (item as any)._id.toString();
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
              userEmail: session.email,
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
          created++;

          // Trigger Pusher realtime event
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

          await triggerNotification(
            `private-user-${userId}`,
            "notification:new",
            bellPayload as unknown as Record<string, unknown>
          );
        } else {
          skipped++;
        }
      } catch (err: any) {
        if (err.code === 11000) {
          skipped++;
        } else {
          console.error(`[Sync] Failed to upsert for ${timelineId}:`, err);
        }
      }
    }

    return NextResponse.json({ created, skipped, total: items.length });
  } catch (error) {
    console.error("[Reminders Sync] Error:", error);
    return NextResponse.json(
      { error: "Failed to sync reminders" },
      { status: 500 }
    );
  }
}
