import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaConversation from "@/lib/models/VidaConversation";
import { getSession } from "@/lib/auth";

/** POST /api/admin/chat/conversations/[id]/mute — toggle mute for current user */
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

    const convo = await VidaConversation.findById(id);
    if (!convo)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    const mutedIds = convo.mutedBy.map((m: any) => m.toString());
    if (mutedIds.includes(session.id)) {
      convo.mutedBy = convo.mutedBy.filter(
        (m: any) => m.toString() !== session.id
      ) as any;
    } else {
      convo.mutedBy.push(session.id as any);
    }
    await convo.save();

    return NextResponse.json({ muted: !mutedIds.includes(session.id) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
