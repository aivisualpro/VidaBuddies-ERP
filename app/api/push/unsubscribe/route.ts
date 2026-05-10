import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import { getSession } from "@/lib/auth";
import PushSubscription from "@/lib/models/PushSubscription";

/**
 * POST /api/push/unsubscribe
 *
 * Removes a Web Push subscription for the current user.
 * Body: { endpoint }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { endpoint } = await req.json();

    if (!endpoint) {
      return NextResponse.json(
        { error: "Missing endpoint" },
        { status: 400 }
      );
    }

    await connectToDatabase();
    await PushSubscription.deleteOne({ endpoint, userId: session.id });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Push Unsubscribe] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to unsubscribe" },
      { status: 500 }
    );
  }
}
