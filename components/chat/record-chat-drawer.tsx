"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, MessageCircle } from "lucide-react";
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
  /** Optional parent ref for cross-level lookups */
  parentRefId?: string;
  parentRefKind?: string;
}

export function RecordChatDrawer({
  open,
  onClose,
  refKind,
  refId,
  display,
  currentUserId,
  users,
  parentRefId,
  parentRefKind,
}: RecordChatDrawerProps) {
  const [conversation, setConversation] = useState<any>(null);
  const [relatedConvos, setRelatedConvos] = useState<any[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !refKind || !refId) {
      setConversation(null);
      setRelatedConvos([]);
      setActiveConvId(null);
      return;
    }

    setLoading(true);
    let url = `/api/admin/chat/conversations/by-ref?kind=${encodeURIComponent(
      refKind
    )}&refId=${encodeURIComponent(refId)}&display=${encodeURIComponent(
      display
    )}`;

    if (parentRefId) {
      url += `&parentRefId=${encodeURIComponent(parentRefId)}`;
      if (parentRefKind)
        url += `&parentRefKind=${encodeURIComponent(parentRefKind)}`;
    }

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        setConversation(data);
        const related = data.relatedConversations || [];
        setRelatedConvos(related);

        // If the primary conversation has no messages but a parent does, auto-switch
        if (!data.lastMessage && related.length > 0 && related[0].lastMessage) {
          setActiveConvId(related[0]._id?.toString());
        } else {
          setActiveConvId(data._id?.toString());
        }

        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [open, refKind, refId, display, parentRefId, parentRefKind]);

  const kindLabel =
    refKind === "VBNumber"
      ? "VB#"
      : refKind === "VBSerialNumber"
      ? "Serial#"
      : "Shipment#";

  // Find the currently active conversation object
  const activeConvo =
    activeConvId === conversation?._id?.toString()
      ? conversation
      : relatedConvos.find((c) => c._id?.toString() === activeConvId) ||
        conversation;

  // All conversations to show tabs for
  const allConvos = [
    ...(conversation?._id ? [conversation] : []),
    ...relatedConvos,
  ];

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
            {activeConvo?._id && (
              <Link
                href={`/admin/chat?conv=${activeConvo._id}`}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
              >
                Open in chat
                <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </div>

          {/* Conversation tabs when there are related conversations */}
          {allConvos.length > 1 && (
            <div className="flex items-center gap-1 mt-2 overflow-x-auto scrollbar-thin pb-0.5">
              {allConvos.map((c) => {
                const cId = c._id?.toString();
                const isActive = cId === activeConvId;
                const cName = c.name || c.refs?.[0]?.display || "Chat";
                const hasMessages = !!c.lastMessage;
                return (
                  <button
                    key={cId}
                    onClick={() => setActiveConvId(cId)}
                    className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md border transition-colors whitespace-nowrap ${
                      isActive
                        ? "bg-primary/10 text-primary border-primary/30"
                        : "text-muted-foreground border-transparent hover:bg-muted"
                    }`}
                    aria-label={`Switch to ${cName}`}
                  >
                    <MessageCircle
                      className={`h-3 w-3 ${hasMessages ? "fill-current" : ""}`}
                    />
                    {cName}
                  </button>
                );
              })}
            </div>
          )}
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-hidden">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
          {!loading && activeConvo?._id && (
            <ChatThread
              key={activeConvId} // force re-mount on tab switch
              conversationId={activeConvo._id}
              conversation={activeConvo}
              currentUserId={currentUserId}
              users={users}
            />
          )}
          {!loading && !activeConvo?._id && (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              Could not load conversation
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
