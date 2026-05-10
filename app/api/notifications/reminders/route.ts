import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import { getSession } from "@/lib/auth";
import VidaUser from "@/lib/models/VidaUser";
import VidaTimeline from "@/lib/models/VidaTimeline";
import { buildLookups } from "@/lib/timeline/lookups";
import type { BellNotification } from "@/lib/notifications/types";

/**
 * GET /api/notifications/reminders
 *
 * Returns due reminders as BellNotification[] for the current user.
 * Only returns data if the user is a Super Admin.
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    // Only Super Admins can see reminders
    const user = await VidaUser.findOne(
      { email: session.email },
      { AppRole: 1 }
    ).lean();

    if (!user || (user as any).AppRole !== "Super Admin") {
      return NextResponse.json([]);
    }

    // End of today (23:59:59.999)
    const now = new Date();
    const endOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23, 59, 59, 999
    );

    // Query: Open or In Progress, with a reminder set, due today or overdue
    const items = await VidaTimeline.find({
      status: { $in: ["Open", "In Progress"] },
      reminder: { $ne: null, $lte: endOfToday },
    })
      .sort({ reminder: 1 }) // overdue first
      .lean();

    // Enrich with display names
    const lookups = await buildLookups();

    const notifications: BellNotification[] = items.map((item: any) => {
      const vbDisplay = item.VBNumber
        ? lookups.poMap[item.VBNumber] || item.VBNumber
        : "";
      const serialDisplay = item.VBSerialNumber
        ? lookups.cpoMap[item.VBSerialNumber] || item.VBSerialNumber
        : "";
      const shipDisplay = item.VBShipmentNumber
        ? lookups.shipMap[item.VBShipmentNumber] || item.VBShipmentNumber
        : "";

      return {
        id: item._id.toString(),
        kind: "reminder" as const,
        title: `Reminder: ${item.type}${vbDisplay ? ` ${vbDisplay}` : ""}`.trim(),
        message: item.comments || "—",
        link: "/admin/active-actions",
        read: false,
        createdAt: item.reminder
          ? new Date(item.reminder).toISOString()
          : new Date(item.timestamp).toISOString(),
        meta: {
          status: item.status || "Open",
          category: item.category || null,
          VBSerialNumber: serialDisplay || null,
          VBShipmentNumber: shipDisplay || null,
          VBNumber: vbDisplay || null,
        },
      };
    });

    return NextResponse.json(notifications);
  } catch (error) {
    console.error("[Reminders API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch reminders" },
      { status: 500 }
    );
  }
}
