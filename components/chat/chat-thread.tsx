"use client";

import { useRef, useEffect, useMemo, useState, useCallback } from "react";
import { ChatHeader } from "./chat-header";
import { ChatComposer } from "./chat-composer";
import { MessageBubble } from "./message-bubble";
import { DaySeparator } from "./day-separator";
import { TypingIndicator } from "./typing-indicator";
import { EmptyState } from "./empty-state";
import { useChat, ChatMsg } from "@/hooks/use-chat";
import { Loader2 } from "lucide-react";

interface ChatThreadProps {
  conversationId: string | null;
  conversation: any; // populated conversation document
  currentUserId: string;
  users: any[];
}

export function ChatThread({
  conversationId,
  conversation,
  currentUserId,
  users,
}: ChatThreadProps) {
  const {
    messages,
    loading,
    hasMore,
    sending,
    typingUsers,
    sendMessage,
    loadOlder,
    broadcastTyping,
  } = useChat(conversationId);

  const [replyingTo, setReplyingTo] = useState<ChatMsg | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevMsgCount = useRef(0);

  const isGroup =
    conversation?.kind === "group" || conversation?.kind === "ref";
  const isAdmin =
    conversation?.admins?.includes(currentUserId) || false;

  // ── Auto-scroll to bottom on new messages ──
  useEffect(() => {
    if (messages.length > prevMsgCount.current) {
      // Only scroll if user is near the bottom
      const el = scrollContainerRef.current;
      if (el) {
        const isNearBottom =
          el.scrollHeight - el.scrollTop - el.clientHeight < 200;
        if (isNearBottom || prevMsgCount.current === 0) {
          setTimeout(
            () => bottomRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }),
            50
          );
        }
      }
    }
    prevMsgCount.current = messages.length;
  }, [messages.length]);

  // ── Load older on scroll to top ──
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el || loading || !hasMore) return;
    if (el.scrollTop < 100) {
      const prevHeight = el.scrollHeight;
      loadOlder();
      // Preserve scroll position after prepending older messages
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight - prevHeight;
      });
    }
  }, [loading, hasMore, loadOlder]);

  // ── Group messages by day + detect streaks ──
  const groupedByDay = useMemo(() => {
    const groups: { dateStr: string; messages: ChatMsg[] }[] = [];
    let currentDate = "";

    messages.forEach((msg) => {
      const d = new Date(msg.createdAt).toDateString();
      if (d !== currentDate) {
        currentDate = d;
        groups.push({ dateStr: msg.createdAt, messages: [] });
      }
      groups[groups.length - 1].messages.push(msg);
    });

    return groups;
  }, [messages]);

  // ── Streak detection: show avatar only on first msg of same sender within 5min ──
  const isFirstOfStreak = (msgs: ChatMsg[], idx: number): boolean => {
    if (idx === 0) return true;
    const prev = msgs[idx - 1];
    const curr = msgs[idx];
    if (prev.senderId !== curr.senderId) return true;
    const diff =
      new Date(curr.createdAt).getTime() -
      new Date(prev.createdAt).getTime();
    return diff > 5 * 60 * 1000;
  };

  // ── Actions ──
  const handleReact = useCallback(
    async (msgId: string, emoji: string) => {
      await fetch(`/api/admin/chat/messages/${msgId}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      }).catch(() => {});
    },
    []
  );

  const handleEdit = useCallback(
    async (msgId: string, text: string) => {
      await fetch(`/api/admin/chat/messages/${msgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      }).catch(() => {});
    },
    []
  );

  const handleDelete = useCallback(async (msgId: string) => {
    await fetch(`/api/admin/chat/messages/${msgId}`, {
      method: "DELETE",
    }).catch(() => {});
  }, []);

  const handlePin = useCallback(async (msgId: string) => {
    await fetch(`/api/admin/chat/messages/${msgId}/pin`, {
      method: "POST",
    }).catch(() => {});
  }, []);

  // ── Empty state ──
  if (!conversationId) return <EmptyState />;

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full">
      {/* Header */}
      <ChatHeader
        conversationId={conversationId}
        conversation={conversation}
        currentUserId={currentUserId}
      />

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto scrollbar-thin"
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
      >
        {/* Load-more spinner */}
        {loading && hasMore && (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Initial loading */}
        {loading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">
              Loading messages…
            </span>
          </div>
        )}

        {/* No messages yet */}
        {!loading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
            <span className="text-sm font-medium">No messages yet</span>
            <span className="text-xs">Send the first message!</span>
          </div>
        )}

        {/* Message list */}
        <div className="flex flex-col py-2">
          {groupedByDay.map((group) => (
            <div key={group.dateStr}>
              <DaySeparator dateStr={group.dateStr} />
              {group.messages.map((msg, idx) => {
                const isMe = msg.senderId === currentUserId;
                const firstOfStreak = isFirstOfStreak(group.messages, idx);
                return (
                  <MessageBubble
                    key={msg._id}
                    message={msg}
                    isMe={isMe}
                    isAdmin={isAdmin}
                    showAvatar={firstOfStreak}
                    showSender={isGroup && firstOfStreak}
                    currentUserId={currentUserId}
                    onReply={() => setReplyingTo(msg)}
                    onReact={(emoji) => handleReact(msg._id, emoji)}
                    onEdit={(text) => handleEdit(msg._id, text)}
                    onDelete={() => handleDelete(msg._id)}
                    onPin={() => handlePin(msg._id)}
                  />
                );
              })}
            </div>
          ))}

          {/* Typing indicator */}
          {typingUsers.length > 0 && (
            <TypingIndicator
              users={typingUsers.filter(
                (u) => u.userId !== currentUserId
              )}
            />
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Composer */}
      <ChatComposer
        onSend={sendMessage}
        onTyping={broadcastTyping}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
        sending={sending}
        currentUserId={currentUserId}
        users={users}
      />
    </div>
  );
}
