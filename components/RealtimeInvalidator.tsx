"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getPusherClient } from "@/lib/pusher/client";

/**
 * Map of Pusher event names → TanStack Query key(s) to invalidate.
 * Add new resources here as they are migrated.
 */
const RESOURCE_MAP: Record<string, string[]> = {
  "purchase-orders:changed": ["purchase-orders"],
  "products:changed":        ["products"],
  "categories:changed":      ["categories"],
  "users:changed":           ["users"],
  "suppliers:changed":       ["suppliers"],
  "customers:changed":       ["customers"],
  "carriers:changed":        ["carriers"],
  "warehouses:changed":      ["warehouses"],
  "vb-shipping:changed":     ["vb-shipping"],
  "vb-customer-po:changed":  ["vb-customer-po"],
  "release-requests:changed":["release-requests"],
};

const CHANNEL_NAME = "private-workspace-global";

/**
 * Subscribes to the workspace-wide Pusher channel and invalidates
 * the corresponding TanStack Query cache when another user mutates
 * a resource.
 *
 * Mount once in the protected layout.
 */
export function RealtimeInvalidator() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const pusher = getPusherClient();
    if (!pusher) return;

    const channel = pusher.subscribe(CHANNEL_NAME);

    // Bind each resource event
    for (const [event, queryKeys] of Object.entries(RESOURCE_MAP)) {
      channel.bind(event, () => {
        for (const key of queryKeys) {
          queryClient.invalidateQueries({ queryKey: [key] });
        }
      });
    }

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(CHANNEL_NAME);
    };
  }, [queryClient]);

  // Renders nothing — pure side-effect component
  return null;
}
