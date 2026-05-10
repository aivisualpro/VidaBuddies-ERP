import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaNotification from "@/lib/models/VidaNotification";

/**
 * GET /api/dev/reset-cron
 *
 * Dev-only: Deletes all notification dedup records for today,
 * allowing the cron to re-fan-out and re-send emails.
 * Blocked in production.
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Not available in production" },
      { status: 404 }
    );
  }

  await connectToDatabase();

  const todayStr = new Date().toISOString().split("T")[0];

  // Delete all notification + email dedup records for today
  const result = await VidaNotification.deleteMany({
    dedupKey: { $regex: todayStr },
  });

  return NextResponse.json({
    success: true,
    deleted: result.deletedCount,
    message: `Cleared all dedup records for ${todayStr}. Run cron:reminders to re-trigger.`,
  });
}
