import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaMessage from "@/lib/models/VidaMessage";
import VidaConversation from "@/lib/models/VidaConversation";
import { getSession } from "@/lib/auth";

/**
 * GET /api/admin/chat/search?q=...&conversationId=...
 * Full-text search across messages the user has access to.
 */
export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const session = await getSession();
    if (!session?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const q = req.nextUrl.searchParams.get("q");
    const conversationId = req.nextUrl.searchParams.get("conversationId");

    if (!q || q.trim().length < 2) {
      return NextResponse.json({ error: "Query must be at least 2 characters" }, { status: 400 });
    }

    // Get all conversation IDs this user belongs to
    let convoIds: string[];
    if (conversationId) {
      // Search within a specific conversation
      const convo = await VidaConversation.findOne({
        _id: conversationId,
        participants: session.id,
      }).lean();
      if (!convo) return NextResponse.json({ results: [] });
      convoIds = [conversationId];
    } else {
      // Search across all user's conversations
      const convos = await VidaConversation.find({
        participants: session.id,
      }).select("_id").lean();
      convoIds = convos.map((c: any) => c._id.toString());
    }

    if (convoIds.length === 0) {
      return NextResponse.json({ results: [] });
    }

    const results = await VidaMessage.find({
      conversationId: { $in: convoIds },
      text: { $regex: q, $options: "i" },
      deletedAt: { $exists: false },
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("senderId", "name profilePicture")
      .lean();

    const enriched = results.map((msg: any) => ({
      _id: msg._id,
      conversationId: msg.conversationId,
      text: msg.text,
      _senderName: msg.senderId?.name || "Unknown",
      _senderAvatar: msg.senderId?.profilePicture || "",
      senderId: msg.senderId?._id?.toString() || msg.senderId,
      createdAt: msg.createdAt,
    }));

    return NextResponse.json({ results: enriched });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
