import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaConversation from "@/lib/models/VidaConversation";
import { getSession } from "@/lib/auth";
import { triggerToConversation } from "@/lib/pusher/server";
import { TYPING } from "@/lib/pusher/events";

/**
 * POST /api/admin/chat/[id]/typing
 * Broadcast a typing indicator for this conversation.
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

    // Verify membership
    const convo = await VidaConversation.findOne({
      _id: conversationId,
      participants: session.id,
    }).lean();
    if (!convo) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await triggerToConversation(
      conversationId,
      TYPING,
      { userId: session.id, name: session.name }
    );

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
