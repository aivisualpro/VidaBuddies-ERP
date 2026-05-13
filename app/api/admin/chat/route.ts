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
    console.time("[chat] total");

    // Parallelize independent setup operations
    const [, session] = await Promise.all([
      connectToDatabase(),
      getSession(),
    ]);

    if (!session || !session.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parallelize both data queries — they are independent
    const [users, rawConversations] = await Promise.all([
      // Users for directory + @mentions
      VidaUser.find({ isActive: true })
        .select("_id name profilePicture isActive isOnWebsite email AppRole")
        .lean(),
      // Conversations this user participates in (no populate — manual denorm below)
      VidaConversation.find({ participants: session.id })
        .sort({ lastMessageAt: -1 })
        .lean(),
    ]);

    // Manual denormalization: build a user map from the already-fetched users list
    // instead of letting Mongoose .populate() fire separate DB queries.
    const userMap = new Map<string, any>();
    for (const u of users) {
      userMap.set((u as any)._id.toString(), {
        _id: (u as any)._id,
        name: (u as any).name,
        profilePicture: (u as any).profilePicture,
        isActive: (u as any).isActive,
        email: (u as any).email,
      });
    }

    const conversations = rawConversations.map((convo: any) => ({
      ...convo,
      participants: (convo.participants || []).map((pid: any) => {
        const id = pid?.toString?.() || pid;
        return userMap.get(id) || { _id: pid, name: "Unknown" };
      }),
      lastMessageBy: convo.lastMessageBy
        ? (() => {
            const u = userMap.get(convo.lastMessageBy.toString());
            return u ? { _id: u._id, name: u.name } : { _id: convo.lastMessageBy };
          })()
        : null,
    }));

    console.timeEnd("[chat] total");
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
