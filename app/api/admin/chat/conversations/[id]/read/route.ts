import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaMessage from "@/lib/models/VidaMessage";
import VidaConversation from "@/lib/models/VidaConversation";
import { getSession } from "@/lib/auth";
import { triggerToConversation } from "@/lib/pusher/server";
import { READ } from "@/lib/pusher/events";

/**
 * POST /api/admin/chat/conversations/[id]/read
 * Marks messages as read and clears unreadBy counter.
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

    const { id: conversationId } = await params;

    const convo = await VidaConversation.findOne({
      _id: conversationId,
      participants: session.id,
    });
    if (!convo)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Add read receipt to unread messages not sent by current user
    const result = await VidaMessage.updateMany(
      {
        conversationId,
        senderId: { $ne: session.id },
        "readBy.userId": { $ne: session.id },
      },
      {
        $addToSet: { readBy: { userId: session.id, at: new Date() } },
      }
    );

    // Clear unread counter
    await VidaConversation.findByIdAndUpdate(conversationId, {
      [`unreadBy.${session.id}`]: 0,
    });

    // Broadcast
    await triggerToConversation(conversationId, READ, {
      userId: session.id,
      conversationId,
    });

    return NextResponse.json({ updated: result.modifiedCount });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
