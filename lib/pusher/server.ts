import Pusher from "pusher";

/* ─── Singleton ─── */

let _pusherServer: Pusher | null = null;

function getPusherServer(): Pusher | null {
  if (_pusherServer) return _pusherServer;

  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.PUSHER_CLUSTER;

  if (!appId || !key || !secret || !cluster) {
    console.warn(
      "[Pusher] Missing env vars (PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, PUSHER_CLUSTER). Pusher is disabled."
    );
    return null;
  }

  _pusherServer = new Pusher({ appId, key, secret, cluster, useTLS: true });
  return _pusherServer;
}

/**
 * Returns the Pusher server singleton, or null if env vars are not configured.
 */
export function getServerPusher(): Pusher | null {
  return getPusherServer();
}

/** @deprecated Use getServerPusher() which handles missing env vars. */
export const pusherServer = getPusherServer();

/* ─── Low-level trigger (generic) ─── */

/**
 * Generic trigger — no-ops silently if Pusher is not configured.
 * Kept for backward compat with the notification system (cron/reminders).
 */
export async function triggerNotification(
  channel: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  const server = getPusherServer();
  if (!server) return;

  try {
    await server.trigger(channel, event, payload);
  } catch (error) {
    console.error("[Pusher] Failed to trigger event:", { channel, event, error });
  }
}

/* ─── Chat-specific helpers ─── */

/**
 * Trigger an event on a conversation's private channel.
 * Channel: `private-conv-<conversationId>`
 */
export async function triggerToConversation(
  conversationId: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  return triggerNotification(`private-conv-${conversationId}`, event, payload);
}

/**
 * Trigger an event on a user's personal channel.
 * Channel: `private-user-<userId>`
 */
export async function triggerToUser(
  userId: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  return triggerNotification(`private-user-${userId}`, event, payload);
}

/**
 * Trigger an event on a conversation's presence channel.
 * Channel: `presence-conv-<conversationId>`
 */
export async function triggerPresence(
  conversationId: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  return triggerNotification(`presence-conv-${conversationId}`, event, payload);
}
