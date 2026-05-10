import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaMessage from "@/lib/models/VidaMessage";
import VidaConversation from "@/lib/models/VidaConversation";
import { getSession } from "@/lib/auth";
import { triggerToConversation } from "@/lib/pusher/server";
import { MESSAGE_EDIT, MESSAGE_DELETE } from "@/lib/pusher/events";

/**
 * PATCH /api/admin/chat/messages/[id]
 * Edit a message's text (only by sender).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase();
    const session = await getSession();
    if (!session?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const { text } = await req.json();

    const msg = await VidaMessage.findById(id);
    if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Only the sender can edit their own message
    if (msg.senderId.toString() !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (msg.deletedAt) {
      return NextResponse.json({ error: "Cannot edit deleted message" }, { status: 400 });
    }

    msg.text = text;
    msg.editedAt = new Date();
    await msg.save();

    await triggerToConversation(
      msg.conversationId.toString(),
      MESSAGE_EDIT,
      { _id: msg._id, text: msg.text, editedAt: msg.editedAt }
    );

    return NextResponse.json({ _id: msg._id, text: msg.text, editedAt: msg.editedAt });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/chat/messages/[id]
 * Soft-delete a message (sender or Super Admin).
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase();
    const session = await getSession();
    if (!session?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const msg = await VidaMessage.findById(id);
    if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Only sender or Super Admin can delete
    const isSender = msg.senderId.toString() === session.id;
    const isAdmin = session.role === "Super Admin";
    if (!isSender && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    msg.deletedAt = new Date();
    msg.text = "";
    msg.attachments = [];
    await msg.save();

    await triggerToConversation(
      msg.conversationId.toString(),
      MESSAGE_DELETE,
      { _id: msg._id }
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
