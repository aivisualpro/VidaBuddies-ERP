import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaUser from "@/lib/models/VidaUser";
import { getSession } from "@/lib/auth";

/**
 * POST /api/admin/chat/presence
 * Updates the current user's lastSeen timestamp.
 */
export async function POST() {
  try {
    await connectToDatabase();
    const session = await getSession();
    if (!session?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await VidaUser.findByIdAndUpdate(session.id, { lastSeen: new Date() });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
