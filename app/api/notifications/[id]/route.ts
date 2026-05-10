import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import { getSession } from "@/lib/auth";
import VidaNotification from "@/lib/models/VidaNotification";

/**
 * PATCH /api/notifications/[id]
 *
 * Updates a notification (e.g. mark as read).
 * Body: { read: boolean }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    await connectToDatabase();

    // Only allow updating the user's own notifications
    const update: Record<string, unknown> = {};
    if (typeof body.read === "boolean") {
      update.read = body.read;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    await VidaNotification.updateOne(
      { _id: id, userEmail: session.email },
      { $set: update }
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Notification PATCH] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update" },
      { status: 500 }
    );
  }
}
