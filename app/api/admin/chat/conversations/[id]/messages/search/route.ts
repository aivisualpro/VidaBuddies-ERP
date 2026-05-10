import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaMessage from "@/lib/models/VidaMessage";
import VidaConversation from "@/lib/models/VidaConversation";
import { getSession } from "@/lib/auth";

/**
 * GET /api/admin/chat/conversations/[id]/messages/search?q=...
 * Full-text search within a conversation. Returns up to 20 matching messages.
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
    const q = new URL(req.url).searchParams.get("q");
    if (!q)
      return NextResponse.json({ messages: [] });

    // Verify membership
    const convo = await VidaConversation.findOne(
      { _id: conversationId, participants: session.id },
      { _id: 1 }
    ).lean();
    if (!convo)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    const messages = await VidaMessage.find({
      conversationId,
      text: { $regex: q, $options: "i" },
      deletedAt: { $exists: false },
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .select("_id text createdAt senderId")
      .populate("senderId", "name")
      .lean();

    const results = messages.map((m: any) => ({
      _id: m._id.toString(),
      text: m.text,
      createdAt: m.createdAt,
      senderName: m.senderId?.name || "Unknown",
    }));

    return NextResponse.json({ messages: results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
