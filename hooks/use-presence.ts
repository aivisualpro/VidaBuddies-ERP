"use client";

import { useEffect, useState, useRef } from "react";
import { getPusherClient } from "@/lib/pusher/client";

export interface PresenceUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
}

/**
 * usePresence — subscribes to `presence-conv-<conversationId>`
 * and exposes the set of online users.
 */
export function usePresence(conversationId: string | null) {
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!conversationId) {
      setOnlineUsers([]);
      return;
    }

    const pusher = getPusherClient();
    if (!pusher) return;

    const channelName = `presence-conv-${conversationId}`;
    const channel = pusher.subscribe(channelName) as any;
    channelRef.current = channel;

    channel.bind("pusher:subscription_succeeded", (members: any) => {
      const list: PresenceUser[] = [];
      members.each((m: any) => list.push({ id: m.id, ...m.info }));
      setOnlineUsers(list);
      // Update lastSeen on server
      fetch("/api/admin/chat/presence", { method: "POST" }).catch(() => {});
    });

    channel.bind("pusher:member_added", (m: any) => {
      setOnlineUsers((prev) => {
        if (prev.some((u) => u.id === m.id)) return prev;
        return [...prev, { id: m.id, ...m.info }];
      });
    });

    channel.bind("pusher:member_removed", (m: any) => {
      setOnlineUsers((prev) => prev.filter((u) => u.id !== m.id));
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(channelName);
      channelRef.current = null;
    };
  }, [conversationId]);

  return { onlineUsers };
}
