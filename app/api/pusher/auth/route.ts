import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getServerPusher } from "@/lib/pusher/server";

/**
 * POST /api/pusher/auth
 *
 * Authorizes private Pusher channels (e.g. `private-user-<userId>`).
 * The Pusher client SDK posts here automatically when subscribing to
 * a private channel.
 */
export async function POST(req: NextRequest) {
  try {
    const pusher = getServerPusher();
    if (!pusher) {
      return NextResponse.json(
        { error: "Pusher not configured" },
        { status: 503 }
      );
    }

    const session = await getSession();
    if (!session?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse the form body that Pusher client sends
    const body = await req.text();
    const params = new URLSearchParams(body);
    const socketId = params.get("socket_id");
    const channelName = params.get("channel_name");

    if (!socketId || !channelName) {
      return NextResponse.json(
        { error: "Missing socket_id or channel_name" },
        { status: 400 }
      );
    }

    // Only allow users to subscribe to their own private channel
    const expectedChannel = `private-user-${session.id}`;
    if (channelName !== expectedChannel) {
      return NextResponse.json(
        { error: "Channel not authorized for this user" },
        { status: 403 }
      );
    }

    // Authorize the channel
    const authResponse = pusher.authorizeChannel(socketId, channelName);

    return NextResponse.json(authResponse);
  } catch (error) {
    console.error("[Pusher Auth] Error:", error);
    return NextResponse.json(
      { error: "Authorization failed" },
      { status: 500 }
    );
  }
}
