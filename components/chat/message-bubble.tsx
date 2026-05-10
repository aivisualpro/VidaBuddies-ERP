"use client";

import { useState, useMemo } from "react";
import { Check, CheckCheck } from "lucide-react";
import { MessageActions } from "./message-actions";
import type { ChatMsg } from "@/hooks/use-chat";

interface MessageBubbleProps {
  message: ChatMsg;
  isMe: boolean;
  isAdmin: boolean;
  showAvatar: boolean;
  showSender: boolean; // true in groups, only on first of streak
  currentUserId: string;
  onReply: () => void;
  onReact: (emoji: string) => void;
  onEdit: (text: string) => void;
  onDelete: () => void;
  onPin: () => void;
}

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

export function MessageBubble({
  message,
  isMe,
  isAdmin,
  showAvatar,
  showSender,
  currentUserId,
  onReply,
  onReact,
  onEdit,
  onDelete,
  onPin,
}: MessageBubbleProps) {
  const [hovered, setHovered] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.text || "");

  const isDeleted = !!message.deletedAt;
  const isEdited = !!message.editedAt;

  // Read status for my messages
  const readStatus = useMemo(() => {
    if (!isMe) return null;
    const readCount = message.readBy?.length || 0;
    const deliveredCount = message.deliveredTo?.length || 0;
    if (readCount > 0) return "read";
    if (deliveredCount > 0) return "delivered";
    return "sent";
  }, [isMe, message.readBy, message.deliveredTo]);

  // Group reactions by emoji
  const groupedReactions = useMemo(() => {
    const map = new Map<string, string[]>();
    (message.reactions || []).forEach((r: any) => {
      const arr = map.get(r.emoji) || [];
      arr.push(r.userId);
      map.set(r.emoji, arr);
    });
    return Array.from(map.entries());
  }, [message.reactions]);

  const handleCopy = () => {
    if (message.text) navigator.clipboard.writeText(message.text);
  };

  const handleEditSubmit = () => {
    if (editText.trim() && editText !== message.text) {
      onEdit(editText.trim());
    }
    setEditing(false);
  };

  const time = new Date(message.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className={`flex w-full gap-2 px-4 group relative py-0.5 ${
        isMe ? "justify-end" : "justify-start"
      }`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setShowReactions(false);
      }}
    >
      {/* Avatar placeholder (left, others only) */}
      {!isMe && (
        <div className="w-8 shrink-0 flex items-end">
          {showAvatar && (
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary overflow-hidden">
              {message._senderAvatar ? (
                <img
                  src={message._senderAvatar}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                (message._senderName || "?").charAt(0).toUpperCase()
              )}
            </div>
          )}
        </div>
      )}

      {/* Bubble column */}
      <div
        className={`flex flex-col max-w-[68%] xl:max-w-[55%] ${
          isMe ? "items-end" : "items-start"
        }`}
      >
        {/* Sender name (groups only, first of streak) */}
        {showSender && !isMe && (
          <span className="text-[11px] font-semibold text-primary mb-0.5 ml-1">
            {message._senderName}
          </span>
        )}

        {/* Reply preview */}
        {message.replyTo && (
          <div
            className={`text-[11px] px-3 py-1.5 mb-0.5 rounded-xl border-l-2 border-primary/40 ${
              isMe
                ? "bg-primary/10 text-primary-foreground/70"
                : "bg-muted/40 text-muted-foreground"
            }`}
          >
            <span className="font-semibold">Reply</span>
            <span className="opacity-70 ml-1 truncate block">
              {message.replyTo.text || ""}
            </span>
          </div>
        )}

        {/* Main bubble */}
        <div
          className={`relative px-3 py-2 text-[14px] leading-relaxed ${
            isDeleted
              ? "bg-muted/30 text-muted-foreground italic rounded-2xl border"
              : isMe
              ? "bg-primary text-primary-foreground rounded-2xl rounded-br-sm"
              : "bg-muted/60 text-foreground rounded-2xl rounded-bl-sm"
          }`}
        >
          {isDeleted ? (
            <span className="text-[13px]">🚫 This message was deleted</span>
          ) : editing ? (
            <div className="flex flex-col gap-1 min-w-[200px]">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="bg-transparent text-sm resize-none outline-none min-h-[40px]"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleEditSubmit();
                  }
                  if (e.key === "Escape") setEditing(false);
                }}
              />
              <div className="flex gap-1 justify-end">
                <button
                  onClick={() => setEditing(false)}
                  className="text-[10px] px-2 py-0.5 rounded bg-background/20 hover:bg-background/30"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditSubmit}
                  className="text-[10px] px-2 py-0.5 rounded bg-background/30 hover:bg-background/40 font-semibold"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Text */}
              {message.text && (
                <span className="whitespace-pre-wrap break-words">
                  {message.text}
                </span>
              )}

              {/* Attachments */}
              {message.attachments?.length > 0 && (
                <div className="flex flex-col gap-1.5 mt-1.5">
                  {message.attachments.map((att: any, i: number) => (
                    <a
                      key={i}
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium ${
                        isMe
                          ? "bg-primary-foreground/10 hover:bg-primary-foreground/20"
                          : "bg-background hover:bg-muted border"
                      }`}
                    >
                      {att.mime?.startsWith("image/") ? (
                        <img
                          src={att.url}
                          alt={att.name || ""}
                          className="max-h-48 max-w-full rounded-lg object-cover"
                        />
                      ) : (
                        <>
                          <div className="h-7 w-7 rounded bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary">
                            {att.name?.split(".").pop()?.toUpperCase() ||
                              "FILE"}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold">
                              {att.name || "Attachment"}
                            </p>
                            {att.size && (
                              <p className="text-[10px] opacity-60">
                                {fmtSize(att.size)}
                              </p>
                            )}
                          </div>
                        </>
                      )}
                    </a>
                  ))}
                </div>
              )}

              {/* Timestamp + ticks */}
              <span
                className={`inline-flex items-center gap-1 mt-0.5 float-right ml-3 text-[10px] ${
                  isMe
                    ? "text-primary-foreground/60"
                    : "text-muted-foreground"
                }`}
              >
                {isEdited && (
                  <span className="italic mr-0.5">edited</span>
                )}
                {time}
                {readStatus && (
                  <span className="ml-0.5 inline-flex">
                    {readStatus === "sent" ? (
                      <Check className="h-3 w-3" />
                    ) : readStatus === "delivered" ? (
                      <CheckCheck className="h-3 w-3" />
                    ) : (
                      <CheckCheck className="h-3 w-3 text-sky-400" />
                    )}
                  </span>
                )}
              </span>
            </>
          )}
        </div>

        {/* Reactions row */}
        {groupedReactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {groupedReactions.map(([emoji, userIds]) => {
              const hasMe = userIds.includes(currentUserId);
              return (
                <button
                  key={emoji}
                  onClick={() => onReact(emoji)}
                  className={`flex items-center gap-0.5 text-[12px] px-1.5 py-0.5 rounded-full border transition-colors ${
                    hasMe
                      ? "bg-primary/10 border-primary/30"
                      : "bg-muted/40 border-transparent hover:bg-muted"
                  }`}
                >
                  {emoji}
                  <span className="text-[10px] font-bold text-muted-foreground">
                    {userIds.length}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Hover actions toolbar */}
      {hovered && !isDeleted && !editing && (
        <div
          className={`absolute top-0 ${
            isMe ? "right-[calc(68%+24px)] xl:right-[calc(55%+24px)]" : "left-[calc(68%+44px)] xl:left-[calc(55%+44px)]"
          }`}
        >
          <MessageActions
            isMe={isMe}
            isAdmin={isAdmin}
            onReply={onReply}
            onReact={() => setShowReactions(!showReactions)}
            onEdit={isMe ? () => { setEditing(true); setEditText(message.text || ""); } : undefined}
            onDelete={isMe || isAdmin ? onDelete : undefined}
            onPin={onPin}
            onCopy={handleCopy}
          />
        </div>
      )}

      {/* Quick reactions popup */}
      {showReactions && (
        <div
          className={`absolute ${
            isMe ? "right-4" : "left-12"
          } -top-9 flex items-center gap-0.5 bg-background shadow-xl rounded-full border p-1.5 z-40`}
        >
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                onReact(emoji);
                setShowReactions(false);
              }}
              className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-muted text-base transition-transform hover:scale-125"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
