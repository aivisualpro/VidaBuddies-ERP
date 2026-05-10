import Pusher from "pusher";

// Singleton Pusher server instance — reused across all API routes
let _pusherServer: Pusher | null = null;

function getPusherServer(): Pusher | null {
  if (_pusherServer) return _pusherServer;

  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.PUSHER_CLUSTER;

  // If any required env var is missing, skip initialization
  if (!appId || !key || !secret || !cluster) {
    console.warn(
      "[Pusher] Missing env vars (PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, PUSHER_CLUSTER). Pusher is disabled."
    );
    return null;
  }

  _pusherServer = new Pusher({
    appId,
    key,
    secret,
    cluster,
    useTLS: true,
  });

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

/**
 * Convenience helper to trigger a notification event on a channel.
 * No-ops silently if Pusher is not configured.
 */
export async function triggerNotification(
  channel: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  const server = getPusherServer();
  if (!server) return; // Pusher not configured — skip silently

  try {
    await server.trigger(channel, event, payload);
  } catch (error) {
    console.error("[Pusher] Failed to trigger event:", { channel, event, error });
  }
}
