import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaNotification from "@/lib/models/VidaNotification";
import VidaUser from "@/lib/models/VidaUser";
import { getSession } from "@/lib/auth";

/**
 * GET /api/notifications/chat
 *
 * Returns chat + mention notifications for the current user's email.
 * Newest first, limited to the last 50.
 */
export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const session = await getSession();
    if (!session?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Get user email for notification lookup
    const user = await VidaUser.findById(session.id, "email").lean();
    const userEmail = (user as any)?.email;

    // Find notifications by dedupKey pattern (chat:*:*:<userId>)
    // OR by userEmail if set
    const filter: any = {
      kind: { $in: ["chat", "mention"] },
      $or: [
        { dedupKey: { $regex: `:${session.id}$` } },
        ...(userEmail ? [{ userEmail }] : []),
      ],
    };

    const notifications = await VidaNotification.find(filter)
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const items = notifications.map((n: any) => ({
      id: n._id.toString(),
      kind: n.kind || "chat",
      title: n.title,
      message: n.message,
      link: n.link,
      read: n.read,
      createdAt: n.createdAt?.toISOString?.() || new Date().toISOString(),
      meta: {
        conversationId: n.sourceId,
        senderName: n.message?.match(/^in .+?: /)?.[0]?.replace(/^in |: $/g, "") || "",
      },
    }));

    return NextResponse.json(items);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
