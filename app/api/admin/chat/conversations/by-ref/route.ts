import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaConversation from "@/lib/models/VidaConversation";
import { getSession } from "@/lib/auth";

/**
 * GET /api/admin/chat/conversations/by-ref?kind=VBNumber&refId=xxx
 * GET /api/admin/chat/conversations/by-ref?kind=VBSerialNumber&refId=xxx&parentRefId=yyy
 *
 * Finds or creates a dedicated "ref" conversation for the given record.
 * If `parentRefId` is provided and kind is VBSerialNumber/VBShipmentNumber,
 * also searches for parent VBNumber conversations to return those too.
 *
 * Returns: { conversation, relatedConversations[] }
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
    const parentRefId = url.searchParams.get("parentRefId");
    const parentRefKind = url.searchParams.get("parentRefKind") || "VBNumber";

    if (!kind || !refId)
      return NextResponse.json(
        { error: "kind and refId required" },
        { status: 400 }
      );

    // ── 1. Find existing ref conversation for this exact record ──
    let convo = await VidaConversation.findOne({
      kind: "ref",
      "refs.kind": kind,
      "refs.refId": refId,
    })
      .populate("participants", "name profilePicture email lastSeen")
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
        .populate("participants", "name profilePicture email lastSeen")
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
          .populate("participants", "name profilePicture email lastSeen")
          .populate("lastMessageBy", "name");
      }
    }

    // ── 2. Find related parent conversations ──
    const relatedConversations: any[] = [];

    if (parentRefId) {
      const parentConvos = await VidaConversation.find({
        kind: "ref",
        "refs.kind": parentRefKind,
        "refs.refId": parentRefId,
        _id: { $ne: convo?._id }, // exclude current
      })
        .populate("participants", "name profilePicture email lastSeen")
        .populate("lastMessageBy", "name")
        .lean();

      relatedConversations.push(...parentConvos);
    }

    // For backward compatibility, return the conversation directly
    // but also include relatedConversations if any
    const result = convo?.toObject ? convo.toObject() : convo;
    if (relatedConversations.length > 0) {
      (result as any).relatedConversations = relatedConversations;
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
