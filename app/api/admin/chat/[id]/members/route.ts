import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaConversation from "@/lib/models/VidaConversation";
import { getSession } from "@/lib/auth";

/**
 * PUT /api/admin/chat/[id]/members
 * Add or remove members from a group conversation.
 * Body: { add?: string[], remove?: string[] }
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase();
    const session = await getSession();
    if (!session?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: conversationId } = await params;
    const { add = [], remove = [] } = await req.json();

    const convo = await VidaConversation.findById(conversationId);
    if (!convo) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Only group/channel conversations can have members modified
    if (convo.kind === "dm") {
      return NextResponse.json({ error: "Cannot modify DM participants" }, { status: 400 });
    }

    // Only admins or Super Admin can modify members
    const isAdmin = convo.admins.some((a: any) => a.toString() === session.id);
    const isSuperAdmin = session.role === "Super Admin";
    if (!isAdmin && !isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Add members
    if (add.length > 0) {
      await VidaConversation.findByIdAndUpdate(conversationId, {
        $addToSet: { participants: { $each: add } },
      });
    }

    // Remove members (but never remove the last admin)
    if (remove.length > 0) {
      await VidaConversation.findByIdAndUpdate(conversationId, {
        $pull: { participants: { $in: remove } },
      });
      // Also remove from admins if they were admins
      await VidaConversation.findByIdAndUpdate(conversationId, {
        $pull: { admins: { $in: remove } },
      });
    }

    const updated = await VidaConversation.findById(conversationId)
      .populate("participants", "name profilePicture isActive email")
      .lean();

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
