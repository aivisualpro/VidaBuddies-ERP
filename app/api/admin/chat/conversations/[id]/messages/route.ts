import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaConversation from "@/lib/models/VidaConversation";
import VidaMessage from "@/lib/models/VidaMessage";
import { getSession } from "@/lib/auth";
import { triggerToConversation, triggerToUser } from "@/lib/pusher/server";
import { MESSAGE_NEW, MENTION } from "@/lib/pusher/events";

/**
 * GET /api/admin/chat/conversations/[id]/messages?cursor=...&limit=...
 * Paginated messages for a conversation, newest-first. Client reverses.
 *
 * POST /api/admin/chat/conversations/[id]/messages
 * Send a message in this conversation.
 */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase();
    const session = await getSession();
    if (!session?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: conversationId } = await params;
    const url = new URL(req.url);
    const cursor = url.searchParams.get("cursor"); // _id of last message
    const limit = Math.min(
      parseInt(url.searchParams.get("limit") || "50"),
      100
    );

    // Verify membership
    const convo = await VidaConversation.findOne({
      _id: conversationId,
      participants: session.id,
    }).lean();
    if (!convo)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Build query
    const filter: any = { conversationId };
    if (cursor) {
      const cursorMsg = await VidaMessage.findById(cursor, {
        createdAt: 1,
      }).lean();
      if (cursorMsg) {
        filter.createdAt = { $lt: (cursorMsg as any).createdAt };
      }
    }

    const messages = await VidaMessage.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("senderId", "name profilePicture")
      .populate("replyTo", "text senderId")
      .lean();

    // Enrich with sender display fields
    const enriched = messages.map((m: any) => ({
      ...m,
      _id: m._id.toString(),
      _senderName: m.senderId?.name || "Unknown",
      _senderAvatar: m.senderId?.profilePicture || "",
      senderId: m.senderId?._id?.toString() || m.senderId?.toString(),
      conversationId: m.conversationId.toString(),
      replyTo: m.replyTo
        ? {
            _id: m.replyTo._id?.toString(),
            text: m.replyTo.text,
            senderId: m.replyTo.senderId?.toString(),
          }
        : undefined,
    }));

    const hasMore = messages.length === limit;

    return NextResponse.json({
      messages: enriched, // newest-first; client reverses
      hasMore,
      cursor: enriched.length
        ? enriched[enriched.length - 1]._id
        : null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

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
    const body = await req.json();
    const {
      text,
      attachments = [],
      mentions = [],
      replyTo,
      refs = [],
    } = body;

    if (!text && attachments.length === 0)
      return NextResponse.json(
        { error: "Message must have text or attachments" },
        { status: 400 }
      );

    // Verify membership
    const convo = await VidaConversation.findOne({
      _id: conversationId,
      participants: session.id,
    });
    if (!convo)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    const kind = attachments.length > 0 ? "file" : "text";

    const msg = await VidaMessage.create({
      conversationId,
      senderId: session.id,
      text: text || undefined,
      kind,
      mentions,
      attachments,
      replyTo: replyTo || undefined,
      refs,
      deliveredTo: [{ userId: session.id, at: new Date() }],
    });

    // Update conversation metadata
    const preview = text || (attachments.length > 0 ? "📎 Attachment" : "");
    await VidaConversation.findByIdAndUpdate(conversationId, {
      lastMessage: preview.substring(0, 200),
      lastMessageBy: session.id,
      lastMessageAt: new Date(),
      [`unreadBy.${session.id}`]: 0, // sender's own unread = 0
    });

    // Increment unread for all other participants
    const others = convo.participants
      .map((p: any) => p.toString())
      .filter((p: string) => p !== session.id);
    for (const uid of others) {
      await VidaConversation.findByIdAndUpdate(conversationId, {
        $inc: { [`unreadBy.${uid}`]: 1 },
      });
    }

    // Populate for response
    const populated = await VidaMessage.findById(msg._id)
      .populate("senderId", "name profilePicture")
      .lean();

    const responseMsg = {
      ...populated,
      _id: (populated as any)._id.toString(),
      _senderName: (populated as any)?.senderId?.name || session.name,
      _senderAvatar:
        (populated as any)?.senderId?.profilePicture || "",
      senderId: session.id,
      conversationId,
    };

    // Realtime: broadcast to conversation
    await triggerToConversation(conversationId, MESSAGE_NEW, responseMsg);

    // Notify each participant on personal channel
    for (const uid of others) {
      await triggerToUser(uid, MENTION, {
        conversationId,
        senderName: session.name,
        preview: preview.substring(0, 80),
      });
    }

    // ── Ref fan-out: shadow-copy message into dedicated ref conversations ──
    if (refs.length > 0 && convo.kind !== "ref") {
      for (const ref of refs) {
        try {
          // Find or create a dedicated ref conversation for this ref
          let refConvo = await VidaConversation.findOne({
            kind: "ref",
            "refs.kind": ref.kind,
            "refs.refId": ref.refId,
          });

          if (!refConvo) {
            refConvo = await VidaConversation.create({
              kind: "ref",
              name: `${ref.kind}: ${ref.display}`,
              participants: [session.id],
              admins: [session.id],
              createdBy: session.id,
              refs: [ref],
            });
          }

          // Ensure sender is a participant of the ref conversation
          if (
            !refConvo.participants
              .map((p: any) => p.toString())
              .includes(session.id)
          ) {
            refConvo.participants.push(session.id);
            await refConvo.save();
          }

          // Insert shadow copy
          await VidaMessage.create({
            conversationId: refConvo._id,
            senderId: session.id,
            text: msg.text,
            kind: msg.kind,
            mentions: msg.mentions,
            attachments: msg.attachments,
            refs: msg.refs,
            mirrorOf: msg._id,
          });

          // Update ref conversation metadata
          await VidaConversation.findByIdAndUpdate(refConvo._id, {
            lastMessage: preview.substring(0, 200),
            lastMessageBy: session.id,
            lastMessageAt: new Date(),
          });
        } catch (err) {
          console.error("[Ref fan-out] Error for ref:", ref, err);
        }
      }
    }

    // ── Mention notifications to specific @mentioned users ──
    if (mentions.length > 0) {
      for (const m of mentions) {
        if (m.userId && m.userId !== session.id) {
          await triggerToUser(m.userId, MENTION, {
            conversationId,
            senderName: session.name,
            preview: `mentioned you: ${preview.substring(0, 60)}`,
            type: "mention",
          });
        }
      }
    }

    return NextResponse.json(responseMsg);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
