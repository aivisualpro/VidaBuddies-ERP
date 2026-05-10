"use client";

import {
  SmilePlus,
  Reply,
  Pencil,
  Trash2,
  Pin,
  Copy,
} from "lucide-react";

interface MessageActionsProps {
  isMe: boolean;
  isAdmin: boolean;
  onReply: () => void;
  onReact: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onPin: () => void;
  onCopy: () => void;
}

export function MessageActions({
  isMe,
  isAdmin,
  onReply,
  onReact,
  onEdit,
  onDelete,
  onPin,
  onCopy,
}: MessageActionsProps) {
  const btn =
    "h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors";

  return (
    <div className="flex items-center gap-0.5 bg-background shadow-lg rounded-xl border p-0.5 z-30">
      <button onClick={onReact} className={btn} title="React">
        <SmilePlus className="h-3.5 w-3.5" />
      </button>
      <button onClick={onReply} className={btn} title="Reply">
        <Reply className="h-3.5 w-3.5" />
      </button>
      <button onClick={onCopy} className={btn} title="Copy">
        <Copy className="h-3.5 w-3.5" />
      </button>
      {isMe && onEdit && (
        <button onClick={onEdit} className={btn} title="Edit">
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
      {(isMe || isAdmin) && onDelete && (
        <button
          onClick={onDelete}
          className={`${btn} hover:!text-destructive`}
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
      {isAdmin && (
        <button onClick={onPin} className={btn} title="Pin">
          <Pin className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
