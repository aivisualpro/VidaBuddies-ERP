"use client";

import { useRef, useState, useCallback } from "react";
import { Send, Smile, Paperclip, X, Mic } from "lucide-react";

interface ChatComposerProps {
  onSend: (data: {
    text?: string;
    attachments?: any[];
    replyTo?: string;
  }) => void;
  onTyping: () => void;
  replyingTo: { _id: string; text?: string; _senderName?: string } | null;
  onCancelReply: () => void;
  sending: boolean;
}

export function ChatComposer({
  onSend,
  onTyping,
  replyingTo,
  onCancelReply,
  sending,
}: ChatComposerProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed && !replyingTo) return;

    onSend({
      text: trimmed || undefined,
      replyTo: replyingTo?._id,
    });
    setText("");
    onCancelReply();

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [text, replyingTo, onSend, onCancelReply]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    onTyping();

    // Auto-resize
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };

  const canSend = text.trim().length > 0;

  const btn =
    "h-9 w-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0";

  return (
    <div className="sticky bottom-0 z-20 bg-background border-t">
      {/* Reply preview banner */}
      {replyingTo && (
        <div className="flex items-center gap-2 px-4 py-2 bg-muted/30 border-b border-l-2 border-l-primary">
          <div className="flex-1 min-w-0">
            <span className="text-[11px] font-semibold text-primary block">
              Replying to {replyingTo._senderName || "message"}
            </span>
            <span className="text-[11px] text-muted-foreground truncate block">
              {replyingTo.text || ""}
            </span>
          </div>
          <button
            onClick={onCancelReply}
            className="h-6 w-6 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Composer row */}
      <div className="flex items-end gap-1.5 p-3">
        {/* Emoji */}
        <button className={btn} title="Emoji">
          <Smile className="h-5 w-5" />
        </button>

        {/* Attachment */}
        <button className={btn} title="Attach file">
          <Paperclip className="h-5 w-5" />
        </button>

        {/* Textarea */}
        <div className="flex-1 min-w-0">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Type a message… Use # to tag a record, @ to mention someone"
            rows={1}
            className="w-full resize-none bg-muted/30 border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring leading-relaxed"
            style={{ maxHeight: 160 }}
          />
        </div>

        {/* Mic / Send */}
        {canSend ? (
          <button
            onClick={handleSend}
            disabled={sending}
            className="h-9 w-9 flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shrink-0 disabled:opacity-50"
            title="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        ) : (
          <button className={btn} title="Voice note">
            <Mic className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}
