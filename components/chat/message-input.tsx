"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  IconSend,
  IconMoodSmile,
  IconPaperclip,
  IconMicrophone,
  IconX,
  IconArrowBackUp,
  IconAt,
} from "@tabler/icons-react";
import { useChatStore } from "@/store/useChatStore";
import { useTypingBroadcast } from "@/hooks/use-chat-pusher";

interface MessageInputProps {
  users: any[];
}

export function MessageInput({ users }: MessageInputProps) {
  const {
    activeConversationId,
    isSending,
    replyingTo,
    setReplyingTo,
    sendMessage,
  } = useChatStore();

  const [text, setText] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIds, setMentionIds] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const broadcastTyping = useTypingBroadcast(activeConversationId);

  // Filter users for @mention dropdown
  const mentionResults = useMemo(() => {
    if (!mentionQuery) return users.slice(0, 8);
    const q = mentionQuery.toLowerCase();
    return users
      .filter((u: any) => u.name?.toLowerCase().includes(q))
      .slice(0, 8);
  }, [users, mentionQuery]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setText(value);
    broadcastTyping();

    // Detect @mention trigger
    const lastAt = value.lastIndexOf("@");
    if (lastAt >= 0 && lastAt === value.length - 1) {
      setShowMentions(true);
      setMentionQuery("");
    } else if (lastAt >= 0) {
      const afterAt = value.slice(lastAt + 1);
      if (!afterAt.includes(" ")) {
        setShowMentions(true);
        setMentionQuery(afterAt);
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (user: any) => {
    const lastAt = text.lastIndexOf("@");
    const before = text.slice(0, lastAt);
    setText(`${before}@${user.name} `);
    setMentionIds((prev) => [...prev, user._id]);
    setShowMentions(false);
    inputRef.current?.focus();
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!text.trim() && mentionIds.length === 0) return;
    if (!activeConversationId || isSending) return;

    await sendMessage({
      text: text.trim(),
      mentions: mentionIds,
      replyTo: replyingTo?._id,
    });

    setText("");
    setMentionIds([]);
    setShowMentions(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === "Escape") {
      setShowMentions(false);
      if (replyingTo) setReplyingTo(null);
    }
  };

  // Clear state when conversation changes
  useEffect(() => {
    setText("");
    setMentionIds([]);
    setShowMentions(false);
  }, [activeConversationId]);

  if (!activeConversationId) return null;

  return (
    <div className="px-6 py-4 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-xl border-t border-black/5 dark:border-white/5 z-20 shrink-0 relative">
      {/* Reply preview */}
      {replyingTo && (
        <div className="flex items-center gap-2 mb-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-200/50 dark:border-blue-800/30">
          <IconArrowBackUp
            size={14}
            className="text-blue-500 flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
              Replying to {replyingTo._senderName || "message"}
            </p>
            <p className="text-[12px] text-zinc-600 dark:text-zinc-400 truncate">
              {replyingTo.text || "📎 Attachment"}
            </p>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="h-6 w-6 flex items-center justify-center rounded-full hover:bg-blue-100 dark:hover:bg-blue-800/30 text-zinc-400 hover:text-zinc-600 transition-all"
          >
            <IconX size={14} />
          </button>
        </div>
      )}

      {/* @mention dropdown */}
      {showMentions && mentionResults.length > 0 && (
        <div className="absolute bottom-full left-6 right-6 mb-2 bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-black/5 dark:border-white/10 max-h-[240px] overflow-y-auto z-50">
          <div className="p-1.5">
            <p className="px-3 py-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              Mention someone
            </p>
            {mentionResults.map((user: any) => (
              <button
                key={user._id}
                onClick={() => insertMention(user)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all text-left"
              >
                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                  {user.profilePicture ? (
                    <img
                      src={user.profilePicture}
                      alt=""
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    user.name?.charAt(0)
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200 truncate">
                    {user.name}
                  </p>
                  <p className="text-[10px] text-zinc-400 truncate">
                    {user.AppRole || user.email}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input form */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2.5 bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.04)] rounded-2xl p-1.5 pr-2 h-[56px]"
      >
        <div className="flex gap-0.5 pl-1.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="w-9 h-9 rounded-xl text-zinc-400 hover:text-blue-600 transition-colors bg-slate-50 dark:bg-zinc-800"
          >
            <IconMoodSmile size={20} stroke={1.5} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="w-9 h-9 rounded-xl text-zinc-400 hover:text-blue-600 transition-colors bg-slate-50 dark:bg-zinc-800"
          >
            <IconPaperclip size={20} stroke={1.5} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => {
              const lastChar = text[text.length - 1];
              if (lastChar !== "@") {
                setText(text + "@");
                setShowMentions(true);
                setMentionQuery("");
              }
              inputRef.current?.focus();
            }}
            className="w-9 h-9 rounded-xl text-zinc-400 hover:text-blue-600 transition-colors bg-slate-50 dark:bg-zinc-800"
          >
            <IconAt size={20} stroke={1.5} />
          </Button>
        </div>

        <Input
          ref={inputRef}
          className="flex-1 border-none shadow-none focus-visible:ring-0 bg-transparent px-2 text-[14px] font-medium h-full rounded-none placeholder:text-zinc-400"
          placeholder="Type a message..."
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          disabled={isSending}
        />

        <div className="flex items-center">
          {text.trim().length === 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="w-10 h-10 rounded-xl text-zinc-400 bg-slate-50 dark:bg-zinc-800 hover:text-zinc-900"
            >
              <IconMicrophone size={20} stroke={1.5} />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              disabled={isSending}
              className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-600/30 transition-all"
            >
              <IconSend
                size={18}
                stroke={2}
                className="translate-x-[1px] -translate-y-[1px]"
              />
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
