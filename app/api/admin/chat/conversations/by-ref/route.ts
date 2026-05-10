import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaConversation from "@/lib/models/VidaConversation";
import { getSession } from "@/lib/auth";

/**
 * GET /api/admin/chat/conversations/by-ref?kind=VBNumber&refId=xxx
 *
 * Finds or creates a dedicated "ref" conversation for the given record.
 * Returns the conversation document (populated participants).
 */
export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const session = await getSession();
    if (!session?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const kind = url.searchParams.get("kind");
    const refId = url.searchParams.get("refId");
    const display = url.searchParams.get("display") || refId || "";

    if (!kind || !refId)
      return NextResponse.json(
        { error: "kind and refId required" },
        { status: 400 }
      );

    // Find existing ref conversation
    let convo = await VidaConversation.findOne({
      kind: "ref",
      "refs.kind": kind,
      "refs.refId": refId,
    })
      .populate("participants", "name profilePicture email")
      .populate("lastMessageBy", "name");

    if (!convo) {
      // Create one
      convo = await VidaConversation.create({
        kind: "ref",
        name: `${kind}: ${display}`,
        participants: [session.id],
        admins: [session.id],
        createdBy: session.id,
        refs: [{ kind, refId, display }],
      });
      // Re-populate
      convo = await VidaConversation.findById(convo._id)
        .populate("participants", "name profilePicture email")
        .populate("lastMessageBy", "name");
    } else {
      // Ensure current user is a participant
      const participantIds = convo.participants.map((p: any) =>
        (p._id || p).toString()
      );
      if (!participantIds.includes(session.id)) {
        convo.participants.push(session.id);
        await convo.save();
        convo = await VidaConversation.findById(convo._id)
          .populate("participants", "name profilePicture email")
          .populate("lastMessageBy", "name");
      }
    }

    return NextResponse.json(convo);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
