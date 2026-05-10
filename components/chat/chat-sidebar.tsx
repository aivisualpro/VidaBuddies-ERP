"use client";

import React, { useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  IconSearch,
  IconPlus,
  IconUsers,
  IconMessage,
  IconBroadcast,
  IconHash,
} from "@tabler/icons-react";
import { useChatStore, ChatConversation } from "@/store/useChatStore";

interface ChatSidebarProps {
  onNewChat: () => void;
}

const FILTER_TABS = [
  { key: "all" as const, label: "All", icon: IconMessage },
  { key: "dm" as const, label: "DMs", icon: IconMessage },
  { key: "group" as const, label: "Groups", icon: IconUsers },
  { key: "ref" as const, label: "Refs", icon: IconHash },
];

export function ChatSidebar({ onNewChat }: ChatSidebarProps) {
  const {
    conversations,
    activeConversationId,
    setActiveConversation,
    searchQuery,
    setSearchQuery,
    sidebarFilter,
    setSidebarFilter,
    currentUser,
    isLoadingConversations,
  } = useChatStore();

  const filtered = useMemo(() => {
    let result = conversations;

    // Filter by kind
    if (sidebarFilter !== "all") {
      result = result.filter((c) => c.kind === sidebarFilter);
    }

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((c) => {
        const name = getConversationName(c, currentUser?.id || "");
        return (
          name.toLowerCase().includes(q) ||
          c.lastMessage?.toLowerCase().includes(q)
        );
      });
    }

    // Sort: by lastMessageAt descending
    return result.sort((a, b) => {
      const dateA = new Date(a.lastMessageAt || 0).getTime();
      const dateB = new Date(b.lastMessageAt || 0).getTime();
      return dateB - dateA;
    });
  }, [conversations, sidebarFilter, searchQuery, currentUser]);

  return (
    <div className="w-[320px] lg:w-[360px] flex-shrink-0 border-r border-black/5 dark:border-white/5 flex flex-col bg-slate-50/80 dark:bg-zinc-900/40 relative z-10">
      {/* Header */}
      <div className="p-5 pb-3 bg-transparent">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-black tracking-tight text-zinc-900 dark:text-zinc-100">
            Messages
          </h2>
          <Button
            onClick={onNewChat}
            size="icon"
            className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-600/20 transition-all"
          >
            <IconPlus size={18} stroke={2.5} />
          </Button>
        </div>

        {/* Search */}
        <div className="relative group mb-3">
          <IconSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-blue-500 transition-colors w-4 h-4" />
          <Input
            className="pl-10 bg-white dark:bg-zinc-950 border border-black/5 dark:border-white/5 rounded-xl text-sm h-10 shadow-sm focus-visible:ring-1 focus-visible:ring-blue-500 font-medium"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-1 bg-white dark:bg-zinc-950 rounded-xl p-1 border border-black/5 dark:border-white/5 shadow-sm">
          {FILTER_TABS.map((tab) => {
            const count =
              tab.key === "all"
                ? conversations.length
                : conversations.filter((c) => c.kind === tab.key).length;
            const isActive = sidebarFilter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setSidebarFilter(tab.key)}
                className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                  isActive
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                    : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/5"
                }`}
              >
                <tab.icon size={13} stroke={2.5} />
                {tab.label}
                {count > 0 && (
                  <span
                    className={`text-[9px] font-black min-w-[16px] h-4 flex items-center justify-center rounded-full px-1 ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-black/5 dark:bg-white/5 text-zinc-400"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Conversation List */}
      <ScrollArea className="flex-1 px-3 pb-4">
        <div className="flex flex-col gap-1 mt-1">
          {isLoadingConversations ? (
            <div className="p-6 text-center text-sm text-zinc-400 font-medium">
              <div className="flex items-center justify-center gap-2">
                <div className="h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                Syncing...
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center">
              <div className="h-14 w-14 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-3 border border-black/5 dark:border-white/5">
                <IconMessage size={24} className="text-zinc-400" />
              </div>
              <p className="text-sm font-bold text-zinc-600 dark:text-zinc-400">
                No conversations yet
              </p>
              <p className="text-xs text-zinc-400 mt-1">
                Start a new chat to get going
              </p>
            </div>
          ) : (
            filtered.map((convo) => (
              <ConversationItem
                key={convo._id}
                convo={convo}
                isActive={activeConversationId === convo._id}
                currentUserId={currentUser?.id || ""}
                onClick={() => setActiveConversation(convo._id)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// --- Helpers ---

function getConversationName(
  convo: ChatConversation,
  currentUserId: string
): string {
  if (convo.kind !== "dm" && convo.name) return convo.name;
  // For DMs, show the other person's name
  const other = convo.participants?.find(
    (p: any) => (p._id || p).toString() !== currentUserId
  );
  return (other as any)?.name || "Chat";
}

function getConversationAvatar(
  convo: ChatConversation,
  currentUserId: string
): string {
  if (convo.icon) return convo.icon;
  if (convo.kind === "dm") {
    const other = convo.participants?.find(
      (p: any) => (p._id || p).toString() !== currentUserId
    );
    return (other as any)?.profilePicture || "";
  }
  return "";
}

function getAvatarFallback(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
}

function isOnline(convo: ChatConversation, currentUserId: string): boolean {
  if (convo.kind !== "dm") return false;
  const other = convo.participants?.find(
    (p: any) => (p._id || p).toString() !== currentUserId
  );
  return (other as any)?.isActive || false;
}

function formatTimestamp(dateStr?: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const oneDay = 86400000;

  if (diff < oneDay && d.getDate() === now.getDate()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (diff < 7 * oneDay) {
    return d.toLocaleDateString([], { weekday: "short" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

// --- Conversation Item ---

function ConversationItem({
  convo,
  isActive,
  currentUserId,
  onClick,
}: {
  convo: ChatConversation;
  isActive: boolean;
  currentUserId: string;
  onClick: () => void;
}) {
  const name = getConversationName(convo, currentUserId);
  const avatar = getConversationAvatar(convo, currentUserId);
  const online = isOnline(convo, currentUserId);
  const timeStr = formatTimestamp(convo.lastMessageAt);
  const lastMsg = convo.lastMessage || "Click to start chatting";
  const isGroup = convo.kind === "group" || convo.kind === "ref";

  // Gradient colors by kind
  const gradients: Record<string, string> = {
    dm: "from-blue-500 to-indigo-600",
    group: "from-emerald-500 to-teal-600",
    ref: "from-violet-500 to-purple-600",
  };

  return (
    <div
      onClick={onClick}
      className={`flex items-start gap-3.5 p-3 rounded-2xl cursor-pointer transition-all border border-transparent ${
        isActive
          ? "bg-white dark:bg-zinc-800 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border-black/5 dark:border-white/5 relative"
          : "hover:bg-black/5 dark:hover:bg-white/5"
      }`}
    >
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-600 rounded-r-full" />
      )}

      <div className="relative">
        <Avatar
          className={`h-11 w-11 border-0 shadow-sm ring-2 ${
            isActive
              ? "ring-blue-200 dark:ring-blue-900"
              : "ring-white dark:ring-zinc-900"
          }`}
        >
          {avatar && <AvatarImage src={avatar} />}
          <AvatarFallback
            className={`bg-gradient-to-br ${
              gradients[convo.kind] || gradients.dm
            } text-white font-bold text-xs`}
          >
            {isGroup ? (
              <IconUsers size={18} />
            ) : (
              getAvatarFallback(name)
            )}
          </AvatarFallback>
        </Avatar>
        {online && (
          <span className="absolute bottom-0 right-0 h-3 w-3 bg-emerald-500 border-2 border-white dark:border-zinc-800 rounded-full" />
        )}
      </div>

      <div className="flex-1 min-w-0 pt-0.5">
        <div className="flex justify-between items-center mb-0.5">
          <h3
            className={`text-[14px] font-bold truncate ${
              isActive
                ? "text-zinc-900 dark:text-zinc-100"
                : "text-zinc-700 dark:text-zinc-300"
            }`}
          >
            {name}
          </h3>
          <span
            className={`text-[11px] font-bold flex-shrink-0 ml-2 ${
              isActive ? "text-blue-600" : "text-zinc-400"
            }`}
          >
            {timeStr}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {convo.kind !== "dm" && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 text-zinc-500 uppercase tracking-wider flex-shrink-0">
              {convo.kind}
            </span>
          )}
          <p
            className={`text-[12.5px] truncate font-medium ${
              isActive
                ? "text-zinc-500 dark:text-zinc-400"
                : "text-zinc-500 dark:text-zinc-500"
            }`}
          >
            {lastMsg}
          </p>
        </div>
      </div>
    </div>
  );
}
