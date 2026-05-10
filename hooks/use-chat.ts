"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getPusherClient } from "@/lib/pusher/client";
import {
  MESSAGE_NEW,
  MESSAGE_EDIT,
  MESSAGE_DELETE,
  MESSAGE_REACT,
  READ,
  TYPING,
} from "@/lib/pusher/events";

/* ─── Types ─── */

export interface ChatMsg {
  _id: string;
  conversationId: string;
  senderId: string;
  kind: string;
  text?: string;
  mentions: any[];
  attachments: any[];
  reactions: any[];
  readBy: { userId: string; at: string }[];
  deliveredTo: { userId: string; at: string }[];
  replyTo?: any;
  refs: any[];
  editedAt?: string;
  deletedAt?: string;
  createdAt: string;
  _senderName?: string;
  _senderAvatar?: string;
}

interface TypingUser {
  userId: string;
  name: string;
}

/* ─── Hook ─── */

export function useChat(conversationId: string | null) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const typingTimers = useRef<Record<string, NodeJS.Timeout>>({});
  const channelRef = useRef<any>(null);

  // ── Fetch messages (paginated) ──
  const fetchMessages = useCallback(
    async (cursorId?: string | null) => {
      if (!conversationId) return;
      setLoading(true);
      try {
        const qs = cursorId ? `?cursor=${cursorId}&limit=50` : "?limit=50";
        const res = await fetch(
          `/api/admin/chat/conversations/${conversationId}/messages${qs}`
        );
        if (res.ok) {
          const data = await res.json();
          const reversed = [...data.messages].reverse(); // API is newest-first
          if (cursorId) {
            setMessages((prev) => [...reversed, ...prev]);
          } else {
            setMessages(reversed);
          }
          setHasMore(data.hasMore);
          setCursor(data.cursor);
        }
      } catch {}
      setLoading(false);
    },
    [conversationId]
  );

  // ── Load older (scroll-up) ──
  const loadOlder = useCallback(() => {
    if (!hasMore || loading) return;
    fetchMessages(cursor);
  }, [hasMore, loading, cursor, fetchMessages]);

  // ── Initial load + reset on conversation change ──
  useEffect(() => {
    setMessages([]);
    setCursor(null);
    setHasMore(false);
    setTypingUsers([]);
    if (conversationId) fetchMessages(null);
  }, [conversationId, fetchMessages]);

  // ── Mark as read on mount/focus ──
  useEffect(() => {
    if (!conversationId) return;
    const timer = setTimeout(() => {
      fetch(`/api/admin/chat/conversations/${conversationId}/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }).catch(() => {});
    }, 800);
    return () => clearTimeout(timer);
  }, [conversationId, messages.length]);

  // ── Send message (optimistic) ──
  const sendMessage = useCallback(
    async (data: {
      text?: string;
      attachments?: any[];
      mentions?: any[];
      replyTo?: string;
      refs?: any[];
    }) => {
      if (!conversationId) return;
      setSending(true);
      try {
        const res = await fetch(
          `/api/admin/chat/conversations/${conversationId}/messages`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          }
        );
        if (res.ok) {
          const msg = await res.json();
          // Optimistic add (deduped by Pusher handler)
          setMessages((prev) =>
            prev.some((m) => m._id === msg._id) ? prev : [...prev, msg]
          );
        }
      } catch {}
      setSending(false);
    },
    [conversationId]
  );

  // ── Broadcast typing ──
  const lastTyping = useRef(0);
  const broadcastTyping = useCallback(() => {
    if (!conversationId) return;
    const now = Date.now();
    if (now - lastTyping.current < 2000) return;
    lastTyping.current = now;
    fetch(`/api/admin/chat/conversations/${conversationId}/typing`, {
      method: "POST",
    }).catch(() => {});
  }, [conversationId]);

  // ── Pusher subscription ──
  useEffect(() => {
    if (!conversationId) return;
    const pusher = getPusherClient();
    if (!pusher) return;

    const channelName = `private-conv-${conversationId}`;
    const channel = pusher.subscribe(channelName);
    channelRef.current = channel;

    channel.bind(MESSAGE_NEW, (msg: ChatMsg) => {
      setMessages((prev) =>
        prev.some((m) => m._id === msg._id) ? prev : [...prev, msg]
      );
      // Clear typing for this sender
      setTypingUsers((prev) =>
        prev.filter((u) => u.userId !== msg.senderId)
      );
    });

    channel.bind(MESSAGE_EDIT, (data: any) => {
      setMessages((prev) =>
        prev.map((m) =>
          m._id === data._id ? { ...m, text: data.text, editedAt: data.editedAt } : m
        )
      );
    });

    channel.bind(MESSAGE_DELETE, (data: any) => {
      setMessages((prev) =>
        prev.map((m) =>
          m._id === data._id
            ? { ...m, deletedAt: new Date().toISOString(), text: "" }
            : m
        )
      );
    });

    channel.bind(MESSAGE_REACT, (data: any) => {
      setMessages((prev) =>
        prev.map((m) =>
          m._id === data._id ? { ...m, reactions: data.reactions } : m
        )
      );
    });

    channel.bind(READ, (data: any) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.readBy?.some((r: any) => r.userId === data.userId)) return m;
          return {
            ...m,
            readBy: [
              ...(m.readBy || []),
              { userId: data.userId, at: new Date().toISOString() },
            ],
          };
        })
      );
    });

    channel.bind(TYPING, (data: TypingUser) => {
      setTypingUsers((prev) => {
        if (prev.some((u) => u.userId === data.userId)) return prev;
        return [...prev, data];
      });
      // Auto-clear after 3s
      if (typingTimers.current[data.userId])
        clearTimeout(typingTimers.current[data.userId]);
      typingTimers.current[data.userId] = setTimeout(() => {
        setTypingUsers((prev) =>
          prev.filter((u) => u.userId !== data.userId)
        );
      }, 3000);
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(channelName);
      channelRef.current = null;
    };
  }, [conversationId]);

  return {
    messages,
    loading,
    hasMore,
    sending,
    typingUsers,
    sendMessage,
    loadOlder,
    broadcastTyping,
    setMessages,
  };
}
