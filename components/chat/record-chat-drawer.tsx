"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ChatThread } from "./chat-thread";

interface RecordChatDrawerProps {
  open: boolean;
  onClose: () => void;
  refKind: "VBNumber" | "VBSerialNumber" | "VBShipmentNumber";
  refId: string;
  display: string;
  currentUserId: string;
  users: any[];
}

export function RecordChatDrawer({
  open,
  onClose,
  refKind,
  refId,
  display,
  currentUserId,
  users,
}: RecordChatDrawerProps) {
  const [conversation, setConversation] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !refKind || !refId) {
      setConversation(null);
      return;
    }

    setLoading(true);
    fetch(
      `/api/admin/chat/conversations/by-ref?kind=${encodeURIComponent(
        refKind
      )}&refId=${encodeURIComponent(refId)}&display=${encodeURIComponent(
        display
      )}`
    )
      .then((r) => r.json())
      .then((data) => {
        setConversation(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [open, refKind, refId, display]);

  const kindLabel =
    refKind === "VBNumber"
      ? "VB#"
      : refKind === "VBSerialNumber"
      ? "Serial#"
      : "Shipment#";

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-[520px] sm:max-w-[520px] p-0 flex flex-col"
      >
        <SheetHeader className="px-4 pt-4 pb-2 border-b shrink-0">
          <div className="flex items-center justify-between pr-8">
            <div>
              <SheetTitle className="text-sm">
                {kindLabel} {display}
              </SheetTitle>
              <SheetDescription className="text-[11px]">
                Record conversation
              </SheetDescription>
            </div>
            {conversation?._id && (
              <Link
                href={`/admin/chat?conv=${conversation._id}`}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
              >
                Open in chat
                <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </div>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-hidden">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
          {!loading && conversation?._id && (
            <ChatThread
              conversationId={conversation._id}
              conversation={conversation}
              currentUserId={currentUserId}
              users={users}
            />
          )}
          {!loading && !conversation?._id && (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              Could not load conversation
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
