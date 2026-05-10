import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import { getSession } from "@/lib/auth";
import PushSubscription from "@/lib/models/PushSubscription";

/**
 * POST /api/push/subscribe
 *
 * Saves a Web Push subscription for the current user.
 * Body: { endpoint, keys: { p256dh, auth } }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.id || !session?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { endpoint, keys } = body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json(
        { error: "Invalid subscription: missing endpoint or keys" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Upsert by endpoint — same browser updates, new browser inserts
    await PushSubscription.updateOne(
      { endpoint },
      {
        $set: {
          userId: session.id,
          userEmail: session.email,
          endpoint,
          keys: {
            p256dh: keys.p256dh,
            auth: keys.auth,
          },
          userAgent: req.headers.get("user-agent") || "",
        },
      },
      { upsert: true }
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Push Subscribe] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to subscribe" },
      { status: 500 }
    );
  }
}
