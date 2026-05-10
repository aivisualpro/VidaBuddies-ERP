import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import { getSession } from "@/lib/auth";
import VidaNotification from "@/lib/models/VidaNotification";

/**
 * POST /api/notifications/mark-all-read
 *
 * Marks all notifications for the current user as read.
 */
export async function POST() {
  try {
    const session = await getSession();
    if (!session?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const result = await VidaNotification.updateMany(
      { userEmail: session.email, read: false },
      { $set: { read: true } }
    );

    return NextResponse.json({
      success: true,
      modified: result.modifiedCount,
    });
  } catch (error: any) {
    console.error("[Mark All Read] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to mark all read" },
      { status: 500 }
    );
  }
}
