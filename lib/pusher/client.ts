"use client";

import PusherClient from "pusher-js";

// Singleton Pusher client instance — SSR-safe
let _pusherClient: PusherClient | null = null;

/**
 * Returns the Pusher client singleton.
 * Returns null on the server (SSR/RSC) or if env vars are missing.
 *
 * The client auto-authenticates against /api/pusher/auth for
 * private-* and presence-* channels.
 */
export function getPusherClient(): PusherClient | null {
  if (typeof window === "undefined") return null;

  if (_pusherClient) return _pusherClient;

  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

  if (!key || !cluster) {
    console.warn(
      "[Pusher] Missing NEXT_PUBLIC_PUSHER_KEY or NEXT_PUBLIC_PUSHER_CLUSTER. Realtime disabled."
    );
    return null;
  }

  _pusherClient = new PusherClient(key, {
    cluster,
    // Auth for private-* and presence-* channels
    channelAuthorization: {
      endpoint: "/api/pusher/auth",
      transport: "ajax",
    },
  });

  return _pusherClient;
}
