import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getServerPusher } from "@/lib/pusher/server";
import connectToDatabase from "@/lib/db";
import VidaConversation from "@/lib/models/VidaConversation";

/**
 * POST /api/pusher/auth
 *
 * Authorizes Pusher channel subscriptions. Handles:
 *   - `private-user-<userId>`    → personal notification channel (self only)
 *   - `private-conv-<convoId>`   → conversation channel (participant check)
 *   - `presence-conv-<convoId>`  → presence channel (participant check + user_info)
 *
 * Everything else → 403.
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

    // Pusher client SDK sends form-encoded body
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

    // ── 1. Personal notification channel: private-user-<userId> ──
    if (channelName === `private-user-${session.id}`) {
      const authResponse = pusher.authorizeChannel(socketId, channelName);
      return NextResponse.json(authResponse);
    }

    // ── 2. Private conversation channel: private-conv-<conversationId> ──
    const privConvMatch = channelName.match(/^private-conv-(.+)$/);
    if (privConvMatch) {
      const conversationId = privConvMatch[1];
      const isMember = await verifyMembership(conversationId, session.id);
      if (!isMember) {
        return NextResponse.json(
          { error: "Channel not authorized for this user" },
          { status: 403 }
        );
      }

      const authResponse = pusher.authorizeChannel(socketId, channelName);
      return NextResponse.json(authResponse);
    }

    // ── 3. Presence conversation channel: presence-conv-<conversationId> ──
    const presConvMatch = channelName.match(/^presence-conv-(.+)$/);
    if (presConvMatch) {
      const conversationId = presConvMatch[1];
      const isMember = await verifyMembership(conversationId, session.id);
      if (!isMember) {
        return NextResponse.json(
          { error: "Channel not authorized for this user" },
          { status: 403 }
        );
      }

      // Presence channels require user_info in the auth response
      const presenceData = {
        user_id: session.id,
        user_info: {
          id: session.id,
          name: session.name || "",
          email: session.email || "",
          avatar: "", // populated client-side from user store
        },
      };

      const authResponse = pusher.authorizeChannel(
        socketId,
        channelName,
        presenceData
      );
      return NextResponse.json(authResponse);
    }

    // ── Unknown channel pattern — deny ──
    return NextResponse.json(
      { error: "Channel not authorized for this user" },
      { status: 403 }
    );
  } catch (error) {
    console.error("[Pusher Auth] Error:", error);
    return NextResponse.json(
      { error: "Authorization failed" },
      { status: 500 }
    );
  }
}

/* ─── Helpers ─── */

/**
 * Check that `userId` is in the participants array of the given conversation.
 * Connects to the DB on first call.
 */
async function verifyMembership(
  conversationId: string,
  userId: string
): Promise<boolean> {
  try {
    await connectToDatabase();
    const convo = await VidaConversation.findOne(
      { _id: conversationId, participants: userId },
      { _id: 1 }
    ).lean();
    return !!convo;
  } catch {
    return false; // invalid ObjectId, etc.
  }
}
