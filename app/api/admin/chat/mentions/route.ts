import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaMessage from "@/lib/models/VidaMessage";
import { getSession } from "@/lib/auth";

/**
 * GET /api/admin/chat/mentions?cursor=...&limit=...
 *
 * Returns messages where current user is @mentioned,
 * sorted newest-first. Used by the "Mentions" virtual conversation.
 */
export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const session = await getSession();
    if (!session?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const cursor = url.searchParams.get("cursor");
    const limit = Math.min(
      parseInt(url.searchParams.get("limit") || "50"),
      100
    );

    const filter: any = {
      "mentions.userId": session.id,
      deletedAt: { $exists: false },
    };

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
      .lean();

    const enriched = messages.map((m: any) => ({
      ...m,
      _id: m._id.toString(),
      _senderName: m.senderId?.name || "Unknown",
      _senderAvatar: m.senderId?.profilePicture || "",
      senderId: m.senderId?._id?.toString() || m.senderId?.toString(),
      conversationId: m.conversationId?.toString(),
    }));

    return NextResponse.json({
      messages: enriched,
      hasMore: messages.length === limit,
      cursor: enriched.length
        ? enriched[enriched.length - 1]._id
        : null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
