import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaConversation from "@/lib/models/VidaConversation";
import { getSession } from "@/lib/auth";

/** POST /api/admin/chat/conversations/[id]/archive — toggle archive for current user */
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

    const archivedIds = convo.archivedBy.map((m: any) => m.toString());
    if (archivedIds.includes(session.id)) {
      convo.archivedBy = convo.archivedBy.filter(
        (m: any) => m.toString() !== session.id
      ) as any;
    } else {
      convo.archivedBy.push(session.id as any);
    }
    await convo.save();

    return NextResponse.json({ archived: !archivedIds.includes(session.id) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
