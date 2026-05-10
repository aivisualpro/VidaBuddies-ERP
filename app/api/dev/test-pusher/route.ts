import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { triggerNotification } from "@/lib/pusher/server";
import connectToDatabase from "@/lib/db";
import VidaUser from "@/lib/models/VidaUser";

/**
 * GET /api/dev/test-pusher
 *
 * Dev-only: fires a test Pusher notification to the current user.
 * Open the app in one tab, hit this URL in another tab — bell should
 * light up, toast should appear, sound should play.
 */
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  const session = await getSession();
  if (!session?.email) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  await connectToDatabase();
  const user = await VidaUser.findOne({ email: session.email }, { _id: 1 }).lean();
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const userId = (user as any)._id.toString();
  const channel = `private-user-${userId}`;

  const testPayload = {
    id: `test-${Date.now()}`,
    kind: "reminder",
    title: "🧪 Test Notification",
    message: "If you can see this toast + hear the bell, Pusher is working!",
    link: "/admin/active-actions",
    read: false,
    createdAt: new Date().toISOString(),
    meta: {
      status: "Open",
      category: "Test",
    },
  };

  await triggerNotification(channel, "notification:new", testPayload as unknown as Record<string, unknown>);

  return NextResponse.json({
    success: true,
    channel,
    userId,
    message: "Pusher event fired! Check your other browser tab.",
  });
}
