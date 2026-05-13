import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import { getSession } from "@/lib/auth";
import VidaUser from "@/lib/models/VidaUser";

/**
 * GET /api/me
 * Returns the current user's profile info from session + DB.
 * Used by client components to gate features by AppRole.
 */
export async function GET() {
  try {
    console.time("[me] total");

    // Parallelize session decryption and DB connection — independent operations
    const [session] = await Promise.all([
      getSession(),
      connectToDatabase(),
    ]);

    if (!session?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await VidaUser.findOne(
      { email: session.email },
      { _id: 1, name: 1, email: 1, AppRole: 1, profilePicture: 1 }
    ).lean();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    console.timeEnd("[me] total");
    return NextResponse.json({
      id: (user as any)._id.toString(),
      name: (user as any).name,
      email: (user as any).email,
      role: (user as any).AppRole,
      profilePicture: (user as any).profilePicture || null,
    });
  } catch (error) {
    console.error("[/api/me] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
