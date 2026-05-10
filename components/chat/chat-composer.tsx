"use client";

import { useRef, useState, useCallback, useMemo } from "react";
import {
  Send,
  Smile,
  Paperclip,
  X,
  Mic,
  Image as ImageIcon,
  File as FileIcon,
  Camera,
  Loader2,
  Square,
} from "lucide-react";
import {
  MentionPopover,
  RefItem,
  MentionItem,
} from "./mention-popover";

/* ─── Token types for chip tracking ─── */

interface RefToken {
  type: "ref";
  kind: "VBNumber" | "VBSerialNumber" | "VBShipmentNumber";
  refId: string;
  display: string;
}

interface MentionToken {
  type: "mention";
  userId: string;
  name: string;
}

type ChipToken = RefToken | MentionToken;

/* ─── Chip color classes ─── */
const REF_CHIP_CLASSES: Record<string, string> = {
  VBNumber:
    "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
  VBSerialNumber:
    "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  VBShipmentNumber:
    "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
};

const MENTION_CHIP_CLASS =
  "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30";

/* ─── Queued attachment ─── */
interface QueuedFile {
  id: string;
  file: File;
  preview?: string; // object URL for images
  uploading: boolean;
  uploaded?: any; // { url, name, mime, size, ... }
  error?: string;
}

/* ─── Props ─── */

interface ChatComposerProps {
  onSend: (data: {
    text?: string;
    attachments?: any[];
    mentions?: any[];
    refs?: any[];
    replyTo?: string;
  }) => void;
  onTyping: () => void;
  replyingTo: { _id: string; text?: string; _senderName?: string } | null;
  onCancelReply: () => void;
  sending: boolean;
  currentUserId: string;
  users: any[];
}

/* ─── Upload helper ─── */
async function uploadFile(file: File): Promise<any> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/admin/chat/upload", { method: "POST", body: fd });
  if (!res.ok) throw new Error("Upload failed");
  return res.json();
}

/* ─── Component ─── */

export function ChatComposer({
  onSend,
  onTyping,
  replyingTo,
  onCancelReply,
  sending,
  currentUserId,
  users,
}: ChatComposerProps) {
  const [text, setText] = useState("");
  const [chips, setChips] = useState<ChipToken[]>([]);
  const [popoverMode, setPopoverMode] = useState<"#" | "@" | null>(null);
  const [popoverQuery, setPopoverQuery] = useState("");
  const [triggerPos, setTriggerPos] = useState(0);
  const [showPaperclip, setShowPaperclip] = useState(false);
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  /* ── Queue files and upload ── */
  const enqueueFiles = useCallback((files: FileList | File[]) => {
    const newItems: QueuedFile[] = Array.from(files).map((f) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file: f,
      preview: f.type.startsWith("image/")
        ? URL.createObjectURL(f)
        : undefined,
      uploading: true,
    }));

    setQueue((prev) => [...prev, ...newItems]);

    // Upload each
    newItems.forEach(async (item) => {
      try {
        const result = await uploadFile(item.file);
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id ? { ...q, uploading: false, uploaded: result } : q
          )
        );
      } catch {
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? { ...q, uploading: false, error: "Upload failed" }
              : q
          )
        );
      }
    });
  }, []);

  const removeQueued = useCallback((id: string) => {
    setQueue((prev) => {
      const item = prev.find((q) => q.id === id);
      if (item?.preview) URL.revokeObjectURL(item.preview);
      return prev.filter((q) => q.id !== id);
    });
  }, []);

  /* ── Drag-and-drop ── */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);
  const handleDragLeave = useCallback(() => setDragOver(false), []);
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length) enqueueFiles(e.dataTransfer.files);
    },
    [enqueueFiles]
  );

  /* ── Voice recording ── */
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `voice-${Date.now()}.webm`, {
          type: "audio/webm",
        });
        // Upload and auto-send
        try {
          const result = await uploadFile(file);
          onSend({ attachments: [result] });
        } catch {
          // silently fail
        }
        setRecording(false);
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch {
      // Microphone permission denied
      setRecording(false);
    }
  }, [onSend]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
  }, []);

  /* ── Detect # / @ trigger ── */
  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setText(val);
      onTyping();

      const el = e.target;
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 160) + "px";

      const cursorPos = el.selectionStart || 0;
      const before = val.slice(0, cursorPos);

      let triggerChar: "#" | "@" | null = null;
      let tPos = -1;

      for (let i = before.length - 1; i >= 0; i--) {
        const ch = before[i];
        if (ch === " " || ch === "\n") break;
        if (ch === "#" || ch === "@") {
          if (i === 0 || /\s/.test(before[i - 1])) {
            triggerChar = ch as "#" | "@";
            tPos = i;
          }
          break;
        }
      }

      if (triggerChar && tPos >= 0) {
        setPopoverMode(triggerChar);
        setPopoverQuery(before.slice(tPos + 1));
        setTriggerPos(tPos);
      } else {
        setPopoverMode(null);
        setPopoverQuery("");
      }
    },
    [onTyping]
  );

  /* ── Insert ref chip ── */
  const handleSelectRef = useCallback(
    (item: RefItem) => {
      const chipText = `#${item.display}`;
      const before = text.slice(0, triggerPos);
      const after = text.slice(triggerPos + 1 + popoverQuery.length);
      setText(before + chipText + " " + after);
      setChips((prev) => [
        ...prev,
        { type: "ref", kind: item.kind, refId: item.refId, display: item.display },
      ]);
      setPopoverMode(null);
      setPopoverQuery("");
      textareaRef.current?.focus();
    },
    [text, triggerPos, popoverQuery]
  );

  /* ── Insert mention chip ── */
  const handleSelectMention = useCallback(
    (item: MentionItem) => {
      const chipText = `@${item.name}`;
      const before = text.slice(0, triggerPos);
      const after = text.slice(triggerPos + 1 + popoverQuery.length);
      setText(before + chipText + " " + after);
      setChips((prev) => [
        ...prev,
        { type: "mention", userId: item.userId, name: item.name },
      ]);
      setPopoverMode(null);
      setPopoverQuery("");
      textareaRef.current?.focus();
    },
    [text, triggerPos, popoverQuery]
  );

  /* ── Send ── */
  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    const uploadedAtts = queue
      .filter((q) => q.uploaded && !q.error)
      .map((q) => q.uploaded);
    const stillUploading = queue.some((q) => q.uploading);

    if (!trimmed && uploadedAtts.length === 0 && !replyingTo) return;
    if (stillUploading) return; // wait for uploads

    const refs = chips
      .filter((c): c is RefToken => c.type === "ref")
      .map((c) => ({ kind: c.kind, refId: c.refId, display: c.display }));

    const mentions = chips
      .filter((c): c is MentionToken => c.type === "mention")
      .map((c) => ({ userId: c.userId, name: c.name }));

    onSend({
      text: trimmed || undefined,
      attachments: uploadedAtts.length ? uploadedAtts : undefined,
      refs: refs.length ? refs : undefined,
      mentions: mentions.length ? mentions : undefined,
      replyTo: replyingTo?._id,
    });

    // Cleanup previews
    queue.forEach((q) => {
      if (q.preview) URL.revokeObjectURL(q.preview);
    });

    setText("");
    setChips([]);
    setQueue([]);
    onCancelReply();
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }, [text, chips, queue, replyingTo, onSend, onCancelReply]);

  /* ── Keyboard ── */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (popoverMode) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Backspace" && chips.length > 0) {
      const el = textareaRef.current;
      if (!el) return;
      const pos = el.selectionStart || 0;
      const before = text.slice(0, pos);
      for (let i = chips.length - 1; i >= 0; i--) {
        const chip = chips[i];
        const marker = chip.type === "ref" ? `#${chip.display}` : `@${chip.name}`;
        if (before.endsWith(marker)) {
          e.preventDefault();
          setText(text.slice(0, pos - marker.length) + text.slice(pos));
          setChips((prev) => prev.filter((_, idx) => idx !== i));
          return;
        }
      }
    }
  };

  /* ── Chips preview ── */
  const chipElements = useMemo(() => {
    if (chips.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1 px-4 py-1.5 border-b bg-muted/20">
        {chips.map((chip, i) => {
          const cls =
            chip.type === "ref"
              ? REF_CHIP_CLASSES[chip.kind] || ""
              : MENTION_CHIP_CLASS;
          const label =
            chip.type === "ref" ? `#${chip.display}` : `@${chip.name}`;
          return (
            <span
              key={`chip-${i}`}
              className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold border ${cls}`}
            >
              {label}
              <button
                onClick={() =>
                  setChips((prev) => prev.filter((_, idx) => idx !== i))
                }
                className="ml-0.5 opacity-60 hover:opacity-100"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          );
        })}
      </div>
    );
  }, [chips]);

  const canSend =
    text.trim().length > 0 ||
    queue.some((q) => q.uploaded && !q.error);
  const stillUploading = queue.some((q) => q.uploading);

  const btn =
    "h-9 w-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0";

  return (
    <div
      ref={containerRef}
      className={`sticky bottom-0 z-20 bg-background border-t relative ${
        dragOver ? "ring-2 ring-primary ring-inset" : ""
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drop overlay */}
      {dragOver && (
        <div className="absolute inset-0 bg-primary/5 z-10 flex items-center justify-center pointer-events-none">
          <span className="text-sm font-semibold text-primary">
            Drop files to attach
          </span>
        </div>
      )}

      {/* Mention / Ref popover */}
      <MentionPopover
        mode={popoverMode}
        query={popoverQuery}
        bottom={containerRef.current?.offsetHeight || 60}
        left={16}
        currentUserId={currentUserId}
        users={users}
        onSelectRef={handleSelectRef}
        onSelectMention={handleSelectMention}
        onClose={() => setPopoverMode(null)}
      />

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

      {/* Queued attachments preview */}
      {queue.length > 0 && (
        <div className="flex gap-2 px-4 py-2 overflow-x-auto border-b scrollbar-thin">
          {queue.map((q) => (
            <div
              key={q.id}
              className="relative shrink-0 rounded-xl border bg-muted/30 overflow-hidden group"
            >
              {q.preview ? (
                <img
                  src={q.preview}
                  alt=""
                  className="h-16 w-16 object-cover"
                />
              ) : (
                <div className="h-16 w-16 flex flex-col items-center justify-center gap-0.5 px-1">
                  <FileIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-[8px] text-muted-foreground truncate w-full text-center">
                    {q.file.name.split(".").pop()?.toUpperCase()}
                  </span>
                </div>
              )}
              {q.uploading && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                </div>
              )}
              {q.error && (
                <div className="absolute inset-0 bg-destructive/40 flex items-center justify-center">
                  <span className="text-[8px] text-white font-bold">ERR</span>
                </div>
              )}
              <button
                onClick={() => removeQueued(q.id)}
                className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Chips preview row */}
      {chipElements}

      {/* Composer row */}
      <div className="flex items-end gap-1.5 p-3">
        <button className={btn} title="Emoji">
          <Smile className="h-5 w-5" />
        </button>

        {/* Paperclip menu */}
        <div className="relative">
          <button
            className={btn}
            title="Attach"
            onClick={() => setShowPaperclip(!showPaperclip)}
          >
            <Paperclip className="h-5 w-5" />
          </button>
          {showPaperclip && (
            <div className="absolute bottom-full left-0 mb-1 bg-background border rounded-xl shadow-xl py-1 w-40 z-30">
              <button
                className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-muted transition-colors"
                onClick={() => {
                  imageInputRef.current?.click();
                  setShowPaperclip(false);
                }}
              >
                <ImageIcon className="h-4 w-4 text-primary" />
                Image
              </button>
              <button
                className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-muted transition-colors"
                onClick={() => {
                  fileInputRef.current?.click();
                  setShowPaperclip(false);
                }}
              >
                <FileIcon className="h-4 w-4 text-emerald-500" />
                Document
              </button>
              <button
                className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-muted transition-colors md:hidden"
                onClick={() => {
                  // Mobile camera
                  const inp = document.createElement("input");
                  inp.type = "file";
                  inp.accept = "image/*";
                  inp.capture = "environment";
                  inp.onchange = (e: any) => {
                    if (e.target.files?.length) enqueueFiles(e.target.files);
                  };
                  inp.click();
                  setShowPaperclip(false);
                }}
              >
                <Camera className="h-4 w-4 text-violet-500" />
                Camera
              </button>
            </div>
          )}
        </div>

        {/* Hidden file inputs */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) enqueueFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) enqueueFiles(e.target.files);
            e.target.value = "";
          }}
        />

        {/* Textarea */}
        <div className="flex-1 min-w-0">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Type a message… Use # to tag a record, @ to mention"
            rows={1}
            className="w-full resize-none bg-muted/30 border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring leading-relaxed"
            style={{ maxHeight: 160 }}
          />
        </div>

        {/* Send / Mic */}
        {recording ? (
          <button
            onClick={stopRecording}
            className="h-9 w-9 flex items-center justify-center rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors shrink-0 animate-pulse"
            title="Stop recording"
          >
            <Square className="h-4 w-4" />
          </button>
        ) : canSend ? (
          <button
            onClick={handleSend}
            disabled={sending || stillUploading}
            className="h-9 w-9 flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shrink-0 disabled:opacity-50"
            title={stillUploading ? "Uploading…" : "Send"}
          >
            {stillUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        ) : (
          <button
            onClick={startRecording}
            className={btn}
            title="Voice note"
          >
            <Mic className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}
