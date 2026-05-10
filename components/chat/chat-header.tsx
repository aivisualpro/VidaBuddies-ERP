"use client";

import { useEffect, useState } from "react";
import { Search, Pin, BellOff, Info, Hash } from "lucide-react";
import { usePresence } from "@/hooks/use-presence";

interface ChatHeaderProps {
  conversationId: string;
  conversation: any;
  currentUserId: string;
}

export function ChatHeader({
  conversationId,
  conversation,
  currentUserId,
}: ChatHeaderProps) {
  const { onlineUsers } = usePresence(conversationId);
  const convo = conversation;

  if (!convo) return null;

  const isGroup = convo.kind === "group" || convo.kind === "ref";

  // Resolve name
  const name = (() => {
    if (convo.name) return convo.name;
    if (convo.kind === "dm") {
      const other = convo.participants?.find(
        (p: any) => (p._id || p).toString() !== currentUserId
      );
      return (other as any)?.name || "Chat";
    }
    return "Group Chat";
  })();

  // Resolve avatar
  const avatar = (() => {
    if (convo.icon) return convo.icon;
    if (convo.kind === "dm") {
      const other = convo.participants?.find(
        (p: any) => (p._id || p).toString() !== currentUserId
      );
      return (other as any)?.profilePicture || "";
    }
    return "";
  })();

  // Presence line
  const presenceLine = (() => {
    if (convo.kind === "dm") {
      const otherId = convo.participants?.find(
        (p: any) => (p._id || p).toString() !== currentUserId
      );
      const otherIdStr = (otherId as any)?._id?.toString() || otherId?.toString();
      const isOnline = onlineUsers.some((u) => u.id === otherIdStr);
      return isOnline ? "online" : "";
    }
    if (isGroup) {
      return `${convo.participants?.length || 0} members, ${onlineUsers.length} online`;
    }
    return "";
  })();

  // Ref chips
  const refs = convo.refs || [];

  const btn =
    "h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors";

  return (
    <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b px-4 py-2.5 flex items-center gap-3">
      {/* Avatar */}
      <div className="relative shrink-0">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary overflow-hidden">
          {avatar ? (
            <img src={avatar} alt="" className="h-full w-full object-cover" />
          ) : isGroup ? (
            <Hash className="h-5 w-5" />
          ) : (
            name.charAt(0).toUpperCase()
          )}
        </div>
        {presenceLine === "online" && (
          <span className="absolute bottom-0 right-0 h-3 w-3 bg-emerald-500 border-2 border-background rounded-full" />
        )}
      </div>

      {/* Name + subtitle */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-bold text-foreground truncate">{name}</h3>
        <div className="flex items-center gap-1.5 flex-wrap">
          {presenceLine && (
            <span
              className={`text-[11px] font-medium ${
                presenceLine === "online"
                  ? "text-emerald-500"
                  : "text-muted-foreground"
              }`}
            >
              {presenceLine}
            </span>
          )}
          {refs.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              {refs.map((ref: any, i: number) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20"
                >
                  #{ref.display}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5">
        <button className={btn} title="Search in conversation">
          <Search className="h-4 w-4" />
        </button>
        <button className={btn} title="Pinned messages">
          <Pin className="h-4 w-4" />
        </button>
        <button className={btn} title="Mute">
          <BellOff className="h-4 w-4" />
        </button>
        <button className={btn} title="Details">
          <Info className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
