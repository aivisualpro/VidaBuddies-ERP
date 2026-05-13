import { getServerPusher } from "./server";

/**
 * Workspace-wide channel for CRUD invalidation events.
 * Since this app is single-tenant, we use a fixed global channel.
 */
const WORKSPACE_CHANNEL = "private-workspace-global";

/**
 * After a successful CRUD operation on a resource, call this to notify
 * all connected clients via Pusher so they can invalidate their TanStack
 * Query caches.
 *
 * @param resource  - The TanStack Query key, e.g. "purchase-orders", "products"
 * @param action    - "create" | "update" | "delete"
 * @param id        - The document _id (optional but useful for targeted invalidation)
 *
 * This is fire-and-forget — failures are logged but never block the response.
 */
export async function broadcastMutation(
  resource: string,
  action: "create" | "update" | "delete",
  id?: string
): Promise<void> {
  const pusher = getServerPusher();
  if (!pusher) return;

  try {
    await pusher.trigger(WORKSPACE_CHANNEL, `${resource}:changed`, {
      id,
      action,
      ts: Date.now(),
    });
  } catch (error) {
    console.error("[Pusher] broadcastMutation failed:", { resource, action, id, error });
  }
}
