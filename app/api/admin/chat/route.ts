import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaUser from "@/lib/models/VidaUser";
import VidaConversation from "@/lib/models/VidaConversation";
import { getSession } from "@/lib/auth";

/**
 * GET /api/admin/chat
 * Returns the current user, all conversations (with populated participants),
 * and the full user directory for @mention autocomplete.
 */
export async function GET() {
  try {
    await connectToDatabase();
    const session = await getSession();
    if (!session || !session.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all active users for directory + @mentions
    const users = await VidaUser.find({ isActive: true })
      .select("name profilePicture isActive isOnWebsite email AppRole")
      .lean();

    // Get all conversations this user participates in
    const conversations = await VidaConversation.find({
      participants: session.id,
    })
      .populate("participants", "name profilePicture isActive email")
      .populate("lastMessageBy", "name")
      .sort({ lastMessageAt: -1 })
      .lean();

    return NextResponse.json({
      currentUser: { id: session.id, name: session.name, email: session.email },
      users,
      conversations,
    });
  } catch (error: any) {
    console.error("Chat sync failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/admin/chat
 * Create a new conversation (DM, group, or channel).
 * For DMs, checks if a conversation already exists between the two users.
 */
export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const session = await getSession();
    if (!session || !session.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { kind = "dm", participants = [], name, refs } = body;

    // Ensure current user is in participants
    const allParticipants = Array.from(
      new Set([session.id, ...participants])
    );

    // For DM: check if conversation already exists between the two users
    if (kind === "dm" && allParticipants.length === 2) {
      const existing = await VidaConversation.findOne({
        kind: "dm",
        participants: { $all: allParticipants, $size: 2 },
      }).lean();

      if (existing) {
        return NextResponse.json(existing);
      }
    }

    const convo = await VidaConversation.create({
      kind,
      name: kind !== "dm" ? name : undefined,
      participants: allParticipants,
      admins: [session.id],
      refs: refs || [],
    });

    // Populate and return
    const populated = await VidaConversation.findById(convo._id)
      .populate("participants", "name profilePicture isActive email")
      .lean();

    return NextResponse.json(populated, { status: 201 });
  } catch (error: any) {
    console.error("Create conversation failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
