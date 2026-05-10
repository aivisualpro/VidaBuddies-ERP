import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaConversation from "@/lib/models/VidaConversation";
import { getSession } from "@/lib/auth";

/**
 * GET /api/admin/chat/conversations/[id]
 * Returns conversation metadata with populated participants.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase();
    const session = await getSession();
    if (!session?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const convo = await VidaConversation.findOne({
      _id: id,
      participants: session.id,
    })
      .populate("participants", "name profilePicture isActive email")
      .populate("lastMessageBy", "name")
      .lean();

    if (!convo)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(convo);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
