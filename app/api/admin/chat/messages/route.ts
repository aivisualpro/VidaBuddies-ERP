import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaConversation from "@/lib/models/VidaConversation";
import VidaMessage from "@/lib/models/VidaMessage";
import { getSession } from "@/lib/auth";
import { triggerToConversation, triggerToUser } from "@/lib/pusher/server";
import { MESSAGE_NEW, MENTION } from "@/lib/pusher/events";
import { buildLookups, enrichTimelineEntry } from "@/lib/timeline/lookups";

/**
 * GET /api/admin/chat/messages?conversationId=...&before=...&limit=...
 * Fetch messages for a conversation with cursor-based pagination.
 */
export async function GET(req: Request) {
  try {
    await connectToDatabase();
    const session = await getSession();
    if (!session || !session.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const conversationId = url.searchParams.get("conversationId");
    // Legacy support: peerId creates/finds a DM on-the-fly
    const peerId = url.searchParams.get("peerId");
    const before = url.searchParams.get("before"); // cursor: createdAt ISO
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);

    let convoId = conversationId;

    // Legacy peerId support — find existing DM
    if (!convoId && peerId) {
      const convo = await VidaConversation.findOne({
        kind: "dm",
        participants: { $all: [session.id, peerId], $size: 2 },
      });
      if (!convo) return NextResponse.json({ messages: [] });
      convoId = convo._id.toString();
    }

    if (!convoId) {
      return NextResponse.json({ error: "conversationId is required" }, { status: 400 });
    }

    // Verify membership
    const convo = await VidaConversation.findOne({
      _id: convoId,
      participants: session.id,
    });
    if (!convo) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    // Build query with optional cursor
    const query: any = { conversationId: convoId };
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await VidaMessage.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("senderId", "name profilePicture")
      .populate("replyTo", "text senderId")
      .lean();

    // Reverse to chronological order for display
    messages.reverse();

    // Enrich entity refs if any messages have them
    const hasRefs = messages.some((m: any) => m.refs?.length > 0);
    let lookups: any = null;
    if (hasRefs) {
      lookups = await buildLookups();
    }

    const enrichedMessages = messages.map((msg: any) => {
      const enriched: any = {
        ...msg,
        _senderName: msg.senderId?.name || "Unknown",
        _senderAvatar: msg.senderId?.profilePicture || "",
        senderId: msg.senderId?._id?.toString() || msg.senderId,
      };

      // Resolve reply-to sender
      if (msg.replyTo) {
        enriched._replyToMessage = {
          _id: msg.replyTo._id,
          text: msg.replyTo.text,
          senderId: msg.replyTo.senderId?.toString(),
        };
        enriched.replyTo = msg.replyTo._id;
      }

      // Resolve entity refs using timeline lookups
      if (lookups && msg.refs?.length > 0) {
        enriched._resolvedRefs = msg.refs.map((ref: any) => {
          let display = ref.refId?.toString() || "";
          if (ref.refType === "VBNumber") display = lookups.poMap[display] || display;
          if (ref.refType === "VBSerialNumber") display = lookups.cpoMap[display] || display;
          if (ref.refType === "VBShipmentNumber") display = lookups.shipMap[display] || display;
          return { ...ref, _display: display };
        });
      }

      return enriched;
    });

    return NextResponse.json({
      messages: enrichedMessages,
      conversationId: convoId,
      hasMore: messages.length === limit,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/admin/chat/messages
 * Send a new message. Triggers Pusher for realtime delivery.
 */
export async function POST(req: Request) {
  try {
    await connectToDatabase();
    const session = await getSession();
    if (!session || !session.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const {
      conversationId,
      peerId, // Legacy DM support
      text,
      attachments = [],
      mentions = [],
      replyTo,
      refs = [],
    } = body;

    let convoId = conversationId;

    // Legacy support: find or create DM by peerId
    if (!convoId && peerId) {
      let convo = await VidaConversation.findOne({
        kind: "dm",
        participants: { $all: [session.id, peerId], $size: 2 },
      });
      if (!convo) {
        convo = await VidaConversation.create({
          kind: "dm",
          participants: [session.id, peerId],
          admins: [session.id],
        });
      }
      convoId = convo._id.toString();
    }

    if (!convoId) {
      return NextResponse.json({ error: "conversationId is required" }, { status: 400 });
    }

    if (!text && attachments.length === 0) {
      return NextResponse.json({ error: "Message must have text or attachments" }, { status: 400 });
    }

    // Verify membership
    const convo = await VidaConversation.findOne({
      _id: convoId,
      participants: session.id,
    });
    if (!convo) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    // Determine message kind
    const kind = attachments.length > 0 ? "file" : "text";

    // Create the message
    const msg = await VidaMessage.create({
      conversationId: convoId,
      senderId: session.id,
      text: text || undefined,
      kind,
      mentions,
      attachments,
      replyTo: replyTo || undefined,
      refs,
    });

    // Update conversation metadata
    const previewText = text || (attachments.length > 0 ? "📎 Attachment" : "");
    await VidaConversation.findByIdAndUpdate(convoId, {
      lastMessage: previewText.substring(0, 200),
      lastMessageBy: session.id,
      lastMessageAt: new Date(),
    });

    // Populate sender for the response
    const populated = await VidaMessage.findById(msg._id)
      .populate("senderId", "name profilePicture")
      .lean();

    const responseMsg = {
      ...populated,
      _senderName: (populated as any)?.senderId?.name || session.name,
      _senderAvatar: (populated as any)?.senderId?.profilePicture || "",
      senderId: session.id,
    };

    // Trigger Pusher event for realtime delivery
    await triggerToConversation(convoId, MESSAGE_NEW, responseMsg);

    // Also notify each participant on their personal channel (for unread badge)
    const otherParticipants = convo.participants
      .map((p: any) => p.toString())
      .filter((p: string) => p !== session.id);

    for (const userId of otherParticipants) {
      await triggerToUser(userId, MENTION, {
        conversationId: convoId,
        senderName: session.name,
        preview: previewText.substring(0, 80),
      });
    }

    return NextResponse.json(responseMsg);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
