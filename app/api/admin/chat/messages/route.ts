import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaConversation from "@/lib/models/VidaConversation";
import VidaMessage from "@/lib/models/VidaMessage";
import { getSession } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    await connectToDatabase();
    const session = await getSession();
    if (!session || !session.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const peerId = url.searchParams.get("peerId");

    if (!peerId) {
      return NextResponse.json({ error: "peerId is required" }, { status: 400 });
    }

    // Find conversation between currentUser and peerId
    let conversation = await VidaConversation.findOne({
      participants: { $all: [session.id, peerId] }
    });

    if (!conversation) {
      return NextResponse.json({ messages: [] });
    }

    const messages = await VidaMessage.find({ conversationId: conversation._id })
      .sort({ createdAt: 1 })
      .lean();

    return NextResponse.json({ messages, conversationId: conversation._id });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await connectToDatabase();
    const session = await getSession();
    if (!session || !session.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { peerId, text } = body;

    if (!peerId || !text) {
      return NextResponse.json({ error: "peerId and text required" }, { status: 400 });
    }

    // Find or create conversation
    let conversation = await VidaConversation.findOne({
      participants: { $all: [session.id, peerId] }
    });

    if (!conversation) {
      conversation = await VidaConversation.create({
        participants: [session.id, peerId],
      });
    }

    // Insert Message
    const msg = await VidaMessage.create({
      conversationId: conversation._id,
      senderId: session.id,
      text: text,
      isRead: false
    });

    // Update conversation lastMessage
    await VidaConversation.findByIdAndUpdate(conversation._id, {
      lastMessage: text,
      lastSender: session.id,
      lastMessageAt: new Date()
    });

    return NextResponse.json(msg);

  } catch(error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
