import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaMessage from "@/lib/models/VidaMessage";
import VidaConversation from "@/lib/models/VidaConversation";
import { getSession } from "@/lib/auth";
import { triggerToConversation } from "@/lib/pusher/server";
import { MESSAGE_REACT } from "@/lib/pusher/events";

/**
 * POST /api/admin/chat/messages/[id]/react
 * Toggle an emoji reaction on a message.
 * Body: { emoji: "👍" }
 *
 * Flat storage: each reaction is { emoji, userId }.
 * Toggling = if (emoji+userId) exists → remove, else → add.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase();
    const session = await getSession();
    if (!session?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const { emoji } = await req.json();

    if (!emoji) {
      return NextResponse.json({ error: "emoji is required" }, { status: 400 });
    }

    const msg = await VidaMessage.findById(id);
    if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Verify user is a participant of this conversation
    const convo = await VidaConversation.findOne({
      _id: msg.conversationId,
      participants: session.id,
    });
    if (!convo) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Check if this user already reacted with this emoji
    const existingIdx = msg.reactions.findIndex(
      (r) => r.emoji === emoji && r.userId.toString() === session.id
    );

    if (existingIdx >= 0) {
      // Remove the reaction
      msg.reactions.splice(existingIdx, 1);
    } else {
      // Add the reaction
      msg.reactions.push({ emoji, userId: session.id } as any);
    }

    await msg.save();

    await triggerToConversation(
      msg.conversationId.toString(),
      MESSAGE_REACT,
      { _id: msg._id, reactions: msg.reactions }
    );

    return NextResponse.json({ _id: msg._id, reactions: msg.reactions });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
