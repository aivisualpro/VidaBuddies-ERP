import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaConversation from "@/lib/models/VidaConversation";
import { getSession } from "@/lib/auth";

/** POST /api/admin/chat/conversations/[id]/leave — remove current user from participants */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase();
    const session = await getSession();
    if (!session?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    await VidaConversation.findByIdAndUpdate(id, {
      $pull: {
        participants: session.id,
        admins: session.id,
        mutedBy: session.id,
        archivedBy: session.id,
      },
    });

    return NextResponse.json({ left: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
