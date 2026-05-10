import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaMessage from "@/lib/models/VidaMessage";
import VidaConversation from "@/lib/models/VidaConversation";
import { getSession } from "@/lib/auth";
import { triggerToConversation } from "@/lib/pusher/server";
import { READ } from "@/lib/pusher/events";

/**
 * POST /api/admin/chat/[id]/read
 * Mark all messages as read up to a given messageId (or all if none specified).
 * Body: { messageId?: string }
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
    const body = await req.json().catch(() => ({}));
    const { messageId } = body;

    // Verify membership
    const convo = await VidaConversation.findOne({
      _id: conversationId,
      participants: session.id,
    });
    if (!convo) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Build filter: all unread messages in conversation not sent by current user
    const filter: any = {
      conversationId,
      senderId: { $ne: session.id },
      "readBy.userId": { $ne: session.id },
    };

    // If messageId provided, only mark up to that message
    if (messageId) {
      const targetMsg = await VidaMessage.findById(messageId).lean();
      if (targetMsg) {
        filter.createdAt = { $lte: (targetMsg as any).createdAt };
      }
    }

    // Add read receipt to all matching messages
    const result = await VidaMessage.updateMany(filter, {
      $addToSet: {
        readBy: { userId: session.id, readAt: new Date() },
      },
      $set: { isRead: true },
    });

    // Broadcast read receipt
    await triggerToConversation(
      conversationId,
      READ,
      { userId: session.id, conversationId, upToMessageId: messageId }
    );

    return NextResponse.json({ updated: result.modifiedCount });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
