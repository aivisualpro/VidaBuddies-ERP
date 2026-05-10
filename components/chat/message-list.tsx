"use client";

import React, { useRef, useEffect, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "@/components/chat/message-bubble";
import { TypingIndicator } from "@/components/chat/typing-indicator";
import { useChatStore } from "@/store/useChatStore";
import { IconMoodSmile } from "@tabler/icons-react";

export function MessageList() {
  const { messages, isLoadingMessages, currentUser, typingUsers } = useChatStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [messages, typingUsers]);

  // Group messages by date
  const groupedMessages = useMemo(() => {
    const groups: { date: string; messages: typeof messages }[] = [];
    let currentDate = "";

    messages.forEach((msg) => {
      if (msg.deletedAt && !msg.text) return; // hide fully deleted
      const dateStr = new Date(msg.createdAt).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });

      if (dateStr !== currentDate) {
        currentDate = dateStr;
        groups.push({ date: dateStr, messages: [] });
      }
      groups[groups.length - 1].messages.push(msg);
    });

    return groups;
  }, [messages]);

  // Relative date label
  const getDateLabel = (dateStr: string): string => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const todayStr = today.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    const yesterdayStr = yesterday.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    if (dateStr === todayStr) return "Today";
    if (dateStr === yesterdayStr) return "Yesterday";
    return dateStr;
  };

  return (
    <ScrollArea className="flex-1 px-6 py-4">
      <div className="flex flex-col justify-end min-h-full">
        {isLoadingMessages && messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center my-auto pb-10 gap-3">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-2.5 w-2.5 bg-blue-500 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
            <span className="text-sm font-bold tracking-wide text-zinc-400">
              Loading messages...
            </span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center my-auto pb-10">
            <div className="h-16 w-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4 border-4 border-white dark:border-zinc-900 shadow-xl">
              <IconMoodSmile
                className="text-blue-600 dark:text-blue-400"
                size={32}
              />
            </div>
            <p className="text-sm font-black text-zinc-800 dark:text-zinc-200">
              Start the conversation
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              Send your first message to get things rolling.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {groupedMessages.map((group) => (
              <div key={group.date}>
                {/* Date separator */}
                <div className="flex items-center justify-center my-4">
                  <div className="h-px flex-1 bg-black/5 dark:bg-white/5" />
                  <span className="px-4 text-[11px] font-bold text-zinc-400 bg-transparent uppercase tracking-wider">
                    {getDateLabel(group.date)}
                  </span>
                  <div className="h-px flex-1 bg-black/5 dark:bg-white/5" />
                </div>

                {/* Messages */}
                {group.messages.map((msg, i) => {
                  const isMe = msg.senderId === currentUser?.id;
                  const prevMsg = i > 0 ? group.messages[i - 1] : null;
                  const showAvatar = !prevMsg || prevMsg.senderId !== msg.senderId;

                  return (
                    <MessageBubble
                      key={msg._id}
                      message={msg}
                      isMe={isMe}
                      showAvatar={showAvatar}
                      currentUserId={currentUser?.id || ""}
                    />
                  );
                })}
              </div>
            ))}

            {/* Typing indicator */}
            {typingUsers.length > 0 && (
              <TypingIndicator users={typingUsers} />
            )}

            <div ref={scrollRef} />
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
