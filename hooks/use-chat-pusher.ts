"use client";

import { useEffect, useRef, useCallback } from "react";
import { getPusherClient } from "@/lib/pusher/client";

/**
 * Pusher event names used by the chat system.
 */
export const CHAT_EVENTS = {
  NEW_MESSAGE: "new-message",
  MESSAGE_UPDATED: "message-updated",
  MESSAGE_DELETED: "message-deleted",
  TYPING: "typing",
  READ_RECEIPT: "read-receipt",
  REACTION: "reaction",
} as const;

type ChatEventHandler = (data: any) => void;

interface UseChatPusherOptions {
  /** The conversation ID to subscribe to */
  conversationId: string | null;
  /** Called when a new message arrives */
  onNewMessage?: ChatEventHandler;
  /** Called when a message is edited */
  onMessageUpdated?: ChatEventHandler;
  /** Called when a message is deleted */
  onMessageDeleted?: ChatEventHandler;
  /** Called when someone is typing */
  onTyping?: ChatEventHandler;
  /** Called when a read receipt arrives */
  onReadReceipt?: ChatEventHandler;
  /** Called when a reaction is toggled */
  onReaction?: ChatEventHandler;
}

/**
 * React hook that subscribes to a Pusher private channel for a conversation.
 * Automatically subscribes/unsubscribes when conversationId changes.
 */
export function useChatPusher({
  conversationId,
  onNewMessage,
  onMessageUpdated,
  onMessageDeleted,
  onTyping,
  onReadReceipt,
  onReaction,
}: UseChatPusherOptions) {
  const channelRef = useRef<any>(null);

  // Keep callback refs stable to avoid re-subscribing on every render
  const handlersRef = useRef({
    onNewMessage,
    onMessageUpdated,
    onMessageDeleted,
    onTyping,
    onReadReceipt,
    onReaction,
  });
  handlersRef.current = {
    onNewMessage,
    onMessageUpdated,
    onMessageDeleted,
    onTyping,
    onReadReceipt,
    onReaction,
  };

  useEffect(() => {
    if (!conversationId) return;

    const pusher = getPusherClient();
    if (!pusher) return;

    const channelName = `private-conv-${conversationId}`;
    const channel = pusher.subscribe(channelName);
    channelRef.current = channel;

    // Bind all events
    channel.bind(CHAT_EVENTS.NEW_MESSAGE, (data: any) => {
      handlersRef.current.onNewMessage?.(data);
    });
    channel.bind(CHAT_EVENTS.MESSAGE_UPDATED, (data: any) => {
      handlersRef.current.onMessageUpdated?.(data);
    });
    channel.bind(CHAT_EVENTS.MESSAGE_DELETED, (data: any) => {
      handlersRef.current.onMessageDeleted?.(data);
    });
    channel.bind(CHAT_EVENTS.TYPING, (data: any) => {
      handlersRef.current.onTyping?.(data);
    });
    channel.bind(CHAT_EVENTS.READ_RECEIPT, (data: any) => {
      handlersRef.current.onReadReceipt?.(data);
    });
    channel.bind(CHAT_EVENTS.REACTION, (data: any) => {
      handlersRef.current.onReaction?.(data);
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(channelName);
      channelRef.current = null;
    };
  }, [conversationId]);
}

/**
 * Hook to broadcast typing indicator to the current conversation.
 * Throttles to avoid spamming the server.
 */
export function useTypingBroadcast(conversationId: string | null) {
  const lastSentRef = useRef(0);

  const broadcastTyping = useCallback(async () => {
    if (!conversationId) return;

    // Throttle: only send once every 2 seconds
    const now = Date.now();
    if (now - lastSentRef.current < 2000) return;
    lastSentRef.current = now;

    try {
      await fetch(`/api/admin/chat/${conversationId}/typing`, {
        method: "POST",
      });
    } catch {
      // Silent fail — typing indicator is best-effort
    }
  }, [conversationId]);

  return broadcastTyping;
}
