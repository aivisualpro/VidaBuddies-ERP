"use client";

import { useState, useMemo } from "react";
import { Check, CheckCheck, FileText, Volume2 } from "lucide-react";
import Link from "next/link";
import { MessageActions } from "./message-actions";
import { Lightbox } from "./lightbox";
import type { ChatMsg } from "@/hooks/use-chat";

/* ─── Ref chip color classes ─── */
const REF_CHIP_CLASSES: Record<string, string> = {
  VBNumber:
    "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/25",
  VBSerialNumber:
    "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25",
  VBShipmentNumber:
    "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30 hover:bg-violet-500/25",
};

const REF_LINK_MAP: Record<string, string> = {
  VBNumber: "/admin/purchase-orders/list",
  VBSerialNumber: "/admin/customer-pos/list",
  VBShipmentNumber: "/admin/shipments/list",
};

const MENTION_CHIP_CLASS =
  "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30";

/**
 * Renders message text with inline chips for #refs and @mentions.
 * Walks the text looking for chip markers inserted by the composer.
 */
function renderChippedText(
  text: string,
  refs: any[],
  mentions: any[],
  isMe: boolean
): React.ReactNode[] {
  if (!text) return [];

  // Build lookup maps for fast matching
  const refMap = new Map<string, any>();
  (refs || []).forEach((r: any) => refMap.set(`#${r.display}`, r));
  const mentionMap = new Map<string, any>();
  (mentions || []).forEach((m: any) => mentionMap.set(`@${m.name}`, m));

  // Collect all chip markers and their positions
  const allMarkers = [
    ...Array.from(refMap.keys()),
    ...Array.from(mentionMap.keys()),
  ].sort((a, b) => b.length - a.length); // longest first to avoid partial matches

  if (allMarkers.length === 0) {
    return [<span key="t" className="whitespace-pre-wrap break-words">{text}</span>];
  }

  // Build regex from markers (escaped)
  const escaped = allMarkers.map((m) =>
    m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );
  const regex = new RegExp(`(${escaped.join("|")})`, "g");

  const parts = text.split(regex);
  const nodes: React.ReactNode[] = [];

  parts.forEach((part, i) => {
    const ref = refMap.get(part);
    if (ref) {
      const href = `${REF_LINK_MAP[ref.kind] || "/admin"}?focus=${ref.refId}`;
      nodes.push(
        <Link
          key={`ref-${i}`}
          href={href}
          className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[12px] font-semibold border no-underline transition-colors ${
            isMe
              ? "bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30 hover:bg-primary-foreground/30"
              : REF_CHIP_CLASSES[ref.kind] || ""
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </Link>
      );
      return;
    }

    const mention = mentionMap.get(part);
    if (mention) {
      nodes.push(
        <span
          key={`mention-${i}`}
          className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[12px] font-semibold border cursor-default ${
            isMe
              ? "bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30"
              : MENTION_CHIP_CLASS
          }`}
          title={mention.userId}
        >
          {part}
        </span>
      );
      return;
    }

    // Plain text
    if (part) {
      nodes.push(
        <span key={`text-${i}`} className="whitespace-pre-wrap break-words">
          {part}
        </span>
      );
    }
  });

  return nodes;
}

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
      className={`flex w-full gap-2 px-4 group relative pt-4 pb-0.5 -mt-3.5 ${
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
            className={`text-[11px] px-3 py-1.5 mb-0.5 rounded-xl border-l-2 border-primary/40 max-w-full overflow-hidden ${
              isMe
                ? "bg-primary/10 text-primary-foreground/70"
                : "bg-muted/40 text-muted-foreground"
            }`}
          >
            <span className="font-semibold">Reply</span>
            <span className="opacity-70 ml-1 line-clamp-2 block">
              {(message.replyTo.text || "")
                .replace(/#[A-Z0-9_-]+/gi, "")
                .replace(/@[A-Za-z\s]+/g, (m: string) => m)
                .trim()
                .substring(0, 120) || "Attachment"}
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
            <div className="flex flex-col gap-1.5 min-w-[280px] w-full">
              <textarea
                value={editText}
                onChange={(e) => {
                  setEditText(e.target.value);
                  // Auto-resize
                  const el = e.target;
                  el.style.height = 'auto';
                  el.style.height = el.scrollHeight + 'px';
                }}
                className="bg-transparent text-sm resize-none outline-none w-full"
                style={{ minHeight: Math.max(60, Math.min(300, editText.split('\n').length * 22 + 20)) }}
                autoFocus
                ref={(el) => {
                  if (el) {
                    el.style.height = 'auto';
                    el.style.height = el.scrollHeight + 'px';
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleEditSubmit();
                  }
                  if (e.key === "Escape") setEditing(false);
                }}
              />
              <div className="flex gap-1.5 justify-end">
                <button
                  onClick={() => setEditing(false)}
                  className="text-[10px] px-2.5 py-1 rounded-md bg-background/20 hover:bg-background/30 transition-colors"
                  aria-label="Cancel editing"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditSubmit}
                  className="text-[10px] px-2.5 py-1 rounded-md bg-background/30 hover:bg-background/40 font-semibold transition-colors"
                  aria-label="Save edit"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Text with chips */}
              {message.text && (
                <span>
                  {renderChippedText(
                    message.text,
                    message.refs,
                    message.mentions,
                    isMe
                  )}
                </span>
              )}

              {/* Attachments */}
              {message.attachments?.length > 0 && (
                <AttachmentRenderer
                  attachments={message.attachments}
                  isMe={isMe}
                />
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

      {/* Hover actions toolbar — overlaps bubble top edge */}
      {hovered && !isDeleted && !editing && (
        <div
          className={`absolute top-0 z-30 ${
            isMe ? "right-4" : "left-12"
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
          className={`absolute top-0 z-40 ${
            isMe ? "right-4" : "left-12"
          }`}
          style={{ marginTop: -36 }}
        >
          <div className="flex items-center gap-1 bg-background shadow-xl rounded-full border px-2 py-1.5">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  onReact(emoji);
                  setShowReactions(false);
                }}
                className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-muted text-xl transition-transform hover:scale-125"
                aria-label={`React with ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
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

function fmtDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/* ─── Attachment Renderer ─── */

function AttachmentRenderer({
  attachments,
  isMe,
}: {
  attachments: any[];
  isMe: boolean;
}) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const images = attachments.filter((a: any) => a.mime?.startsWith("image/"));
  const audios = attachments.filter((a: any) => a.mime?.startsWith("audio/"));
  const files = attachments.filter(
    (a: any) =>
      !a.mime?.startsWith("image/") && !a.mime?.startsWith("audio/")
  );

  return (
    <>
      {/* Images — grid */}
      {images.length > 0 && (
        <div
          className={`flex flex-wrap gap-1.5 mt-1.5 ${
            images.length === 1 ? "" : "grid grid-cols-2"
          }`}
        >
          {images.map((att: any, i: number) => (
            <button
              key={i}
              onClick={() => setLightboxIdx(i)}
              className="relative overflow-hidden rounded-xl cursor-pointer group"
              style={{
                maxWidth: images.length === 1 ? 360 : "100%",
                maxHeight: 360,
              }}
            >
              <img
                src={att.url}
                alt={att.name || ""}
                className="max-h-[360px] w-full object-cover rounded-xl transition-transform group-hover:scale-[1.02]"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-xl" />
            </button>
          ))}
        </div>
      )}

      {/* Audio — custom player */}
      {audios.map((att: any, i: number) => (
        <div
          key={`audio-${i}`}
          className={`flex items-center gap-2.5 px-3 py-2 rounded-xl mt-1.5 ${
            isMe
              ? "bg-primary-foreground/10"
              : "bg-background border"
          }`}
        >
          <Volume2
            className={`h-4 w-4 shrink-0 ${
              isMe ? "text-primary-foreground/70" : "text-primary"
            }`}
          />
          <audio
            src={att.url}
            controls
            preload="metadata"
            className="h-8 flex-1 min-w-0"
            style={{ maxWidth: 240 }}
          />
          {att.durationMs && (
            <span
              className={`text-[10px] tabular-nums shrink-0 ${
                isMe
                  ? "text-primary-foreground/50"
                  : "text-muted-foreground"
              }`}
            >
              {fmtDuration(att.durationMs)}
            </span>
          )}
        </div>
      ))}

      {/* Files — pill */}
      {files.map((att: any, i: number) => (
        <a
          key={`file-${i}`}
          href={att.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center gap-2 px-3 py-2 rounded-xl mt-1.5 text-xs font-medium transition-colors ${
            isMe
              ? "bg-primary-foreground/10 hover:bg-primary-foreground/20"
              : "bg-background hover:bg-muted border"
          }`}
        >
          <div
            className={`h-8 w-8 rounded-lg flex items-center justify-center text-[9px] font-bold shrink-0 ${
              isMe
                ? "bg-primary-foreground/15 text-primary-foreground"
                : "bg-primary/10 text-primary"
            }`}
          >
            {att.name?.split(".").pop()?.toUpperCase()?.slice(0, 4) || (
              <FileText className="h-4 w-4" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-[12px]">
              {att.name || "Attachment"}
            </p>
            {att.size && (
              <p className="text-[10px] opacity-60">{fmtSize(att.size)}</p>
            )}
          </div>
        </a>
      ))}

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <Lightbox
          images={images.map((a: any) => ({
            url: a.url,
            name: a.name,
          }))}
          startIndex={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
        />
      )}
    </>
  );
}

