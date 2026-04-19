import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaUser from "@/lib/models/VidaUser";
import VidaConversation from "@/lib/models/VidaConversation";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    await connectToDatabase();
    const session = await getSession();
    if (!session || !session.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all users except the current user
    const users = await VidaUser.find({ _id: { $ne: session.id }, isActive: true })
      .select('name profilePicture isActive isOnWebsite')
      .lean();

    // Get all existing conversations for this user
    const conversations = await VidaConversation.find({
      participants: session.id
    }).populate('participants', 'name profilePicture isActive').lean();

    // The frontend can map these together.
    return NextResponse.json({
      currentUser: { id: session.id, name: session.name },
      users,
      conversations
    });

  } catch (error: any) {
    console.error("Chat sync failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
