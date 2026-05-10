import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaMessage from "@/lib/models/VidaMessage";
import VidaConversation from "@/lib/models/VidaConversation";
import { getSession } from "@/lib/auth";
import { triggerToConversation } from "@/lib/pusher/server";
import { CONV_UPDATE } from "@/lib/pusher/events";

/**
 * POST /api/admin/chat/messages/[id]/pin
 * Toggle pin on a message — adds/removes the messageId from
 * VidaConversation.pinned[].
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

    const { id: messageId } = await params;

    const msg = await VidaMessage.findById(messageId);
    if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Verify membership
    const convo = await VidaConversation.findOne({
      _id: msg.conversationId,
      participants: session.id,
    });
    if (!convo) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const isPinned = convo.pinned.some(
      (p: any) => p.toString() === messageId
    );

    if (isPinned) {
      await VidaConversation.findByIdAndUpdate(convo._id, {
        $pull: { pinned: messageId },
      });
    } else {
      await VidaConversation.findByIdAndUpdate(convo._id, {
        $addToSet: { pinned: messageId },
      });
    }

    await triggerToConversation(
      msg.conversationId.toString(),
      CONV_UPDATE,
      { _id: messageId, pinned: !isPinned }
    );

    return NextResponse.json({ _id: messageId, pinned: !isPinned });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
