import webpush from "web-push";
import connectToDatabase from "@/lib/db";
import PushSubscription from "@/lib/models/PushSubscription";

// Configure VAPID once
let _configured = false;

function ensureVapidConfigured() {
  if (_configured) return true;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!publicKey || !privateKey) {
    console.warn("[WebPush] Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY. Push disabled.");
    return false;
  }

  webpush.setVapidDetails(
    "mailto:notifications@vidabuddies.com",
    publicKey,
    privateKey
  );

  _configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
}

/**
 * Send a Web Push notification to all subscriptions for a given userId.
 * Automatically cleans up expired/invalid subscriptions.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number; cleaned: number }> {
  if (!ensureVapidConfigured()) {
    return { sent: 0, failed: 0, cleaned: 0 };
  }

  await connectToDatabase();

  const subscriptions = await PushSubscription.find({ userId }).lean();

  if (subscriptions.length === 0) {
    return { sent: 0, failed: 0, cleaned: 0 };
  }

  const jsonPayload = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;
  let cleaned = 0;

  for (const sub of subscriptions) {
    const pushSub = {
      endpoint: (sub as any).endpoint,
      keys: {
        p256dh: (sub as any).keys.p256dh,
        auth: (sub as any).keys.auth,
      },
    };

    try {
      await webpush.sendNotification(pushSub, jsonPayload, {
        TTL: 86400, // 24 hours
        urgency: "high" as const,
      });
      sent++;
    } catch (err: any) {
      failed++;

      // 404 or 410 = subscription expired, clean up
      if (err.statusCode === 404 || err.statusCode === 410) {
        await PushSubscription.deleteOne({ _id: (sub as any)._id });
        cleaned++;
      } else {
        console.error(
          `[WebPush] Failed for ${(sub as any).endpoint?.slice(0, 60)}:`,
          err.statusCode || err.message
        );
      }
    }
  }

  return { sent, failed, cleaned };
}
