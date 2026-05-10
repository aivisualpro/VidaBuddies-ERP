"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Search,
  Pin,
  BellOff,
  Bell,
  Info,
  Hash,
  X,
  ChevronUp,
  ChevronDown,
  LogOut,
  Archive,
  ArchiveRestore,
} from "lucide-react";
import { usePresence } from "@/hooks/use-presence";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

interface ChatHeaderProps {
  conversationId: string;
  conversation: any;
  currentUserId: string;
  onSearchMatch?: (msgId: string) => void;
}

/**
 * Computes a relative "last seen" label from a Date.
 */
function lastSeenLabel(dateStr?: string | Date): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "last seen just now";
  if (mins < 60) return `last seen ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `last seen ${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `last seen ${days}d ago`;
}

export function ChatHeader({
  conversationId,
  conversation,
  currentUserId,
  onSearchMatch,
}: ChatHeaderProps) {
  const { onlineUsers } = usePresence(conversationId);
  const convo = conversation;
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchIdx, setSearchIdx] = useState(0);
  const [infoOpen, setInfoOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isArchived, setIsArchived] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Check muted / archived status
  useEffect(() => {
    if (!convo || !currentUserId) return;
    const mutedIds = (convo.mutedBy || []).map((m: any) => m?.toString?.() || m);
    const archivedIds = (convo.archivedBy || []).map((m: any) => m?.toString?.() || m);
    setIsMuted(mutedIds.includes(currentUserId));
    setIsArchived(archivedIds.includes(currentUserId));
  }, [convo, currentUserId]);

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

  // Presence line with lastSeen fallback
  const presenceLine = (() => {
    if (convo.kind === "dm") {
      const other = convo.participants?.find(
        (p: any) => (p._id || p).toString() !== currentUserId
      );
      const otherIdStr = (other as any)?._id?.toString() || other?.toString();
      const isOnline = onlineUsers.some((u) => u.id === otherIdStr);
      if (isOnline) return "online";
      // Fall back to lastSeen if available
      const ls = (other as any)?.lastSeen;
      if (ls) return lastSeenLabel(ls);
      return "";
    }
    if (isGroup) {
      return `${convo.participants?.length || 0} members, ${onlineUsers.length} online`;
    }
    return "";
  })();

  // Ref chips
  const refs = convo.refs || [];
  // Pinned messages
  const pinned = convo.pinned || [];

  // ── Search ──
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await fetch(
        `/api/admin/chat/conversations/${conversationId}/messages/search?q=${encodeURIComponent(
          searchQuery
        )}`
      );
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.messages || []);
        setSearchIdx(0);
        if (data.messages?.length > 0 && onSearchMatch) {
          onSearchMatch(data.messages[0]._id);
        }
      }
    } catch {}
  }, [searchQuery, conversationId, onSearchMatch]);

  const navigateSearch = (dir: "prev" | "next") => {
    if (searchResults.length === 0) return;
    const newIdx =
      dir === "next"
        ? Math.min(searchIdx + 1, searchResults.length - 1)
        : Math.max(searchIdx - 1, 0);
    setSearchIdx(newIdx);
    if (onSearchMatch) onSearchMatch(searchResults[newIdx]._id);
  };

  // ── Mute / Archive / Leave ──
  const toggleMute = async () => {
    try {
      await fetch(`/api/admin/chat/conversations/${conversationId}/mute`, {
        method: "POST",
      });
      setIsMuted((p) => !p);
    } catch {}
  };

  const toggleArchive = async () => {
    try {
      await fetch(`/api/admin/chat/conversations/${conversationId}/archive`, {
        method: "POST",
      });
      setIsArchived((p) => !p);
    } catch {}
  };

  const leaveConversation = async () => {
    try {
      await fetch(`/api/admin/chat/conversations/${conversationId}/leave`, {
        method: "POST",
      });
    } catch {}
  };

  const btn =
    "h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors";

  return (
    <>
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b">
        {/* Main header row */}
        <div className="px-4 py-2.5 flex items-center gap-3">
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
              <span
                className="absolute bottom-0 right-0 h-3 w-3 bg-emerald-500 border-2 border-background rounded-full"
                aria-label="Online"
              />
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
            <button
              className={btn}
              aria-label="Search in conversation"
              onClick={() => {
                setSearchOpen((p) => !p);
                if (!searchOpen) {
                  setTimeout(() => searchInputRef.current?.focus(), 100);
                }
              }}
            >
              <Search className="h-4 w-4" />
            </button>
            <button className={btn} aria-label="Pinned messages" onClick={() => {}}>
              <Pin className="h-4 w-4" />
            </button>
            <button className={btn} aria-label={isMuted ? "Unmute" : "Mute"} onClick={toggleMute}>
              {isMuted ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            </button>
            <button className={btn} aria-label="Conversation details" onClick={() => setInfoOpen(true)}>
              <Info className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* In-conversation search bar */}
        {searchOpen && (
          <div className="px-4 pb-2.5 flex items-center gap-2 motion-safe:animate-in motion-safe:slide-in-from-top-2 motion-safe:duration-200">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search messages…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearch();
                  if (e.key === "Escape") {
                    setSearchOpen(false);
                    setSearchQuery("");
                    setSearchResults([]);
                  }
                }}
                aria-label="Search messages in this conversation"
                className="w-full h-8 pl-8 pr-3 rounded-lg border border-input bg-muted/30 text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>
            {searchResults.length > 0 && (
              <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                {searchIdx + 1}/{searchResults.length}
              </span>
            )}
            <button
              onClick={() => navigateSearch("prev")}
              className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Previous search result"
              disabled={searchResults.length === 0}
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => navigateSearch("next")}
              className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Next search result"
              disabled={searchResults.length === 0}
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => {
                setSearchOpen(false);
                setSearchQuery("");
                setSearchResults([]);
              }}
              className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Close search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Pinned messages strip */}
        {pinned.length > 0 && (
          <div className="px-4 pb-2 flex items-center gap-1.5 overflow-x-auto scrollbar-thin">
            <Pin className="h-3 w-3 text-amber-500 shrink-0" />
            {pinned.map((p: any, i: number) => {
              const pId = p?._id?.toString() || p?.toString();
              return (
                <button
                  key={i}
                  onClick={() => onSearchMatch?.(pId)}
                  className="text-[10px] font-medium text-muted-foreground bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/20 shrink-0 transition-colors"
                  aria-label={`Jump to pinned message ${i + 1}`}
                >
                  📌 Pinned #{i + 1}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Info Drawer */}
      <Sheet open={infoOpen} onOpenChange={setInfoOpen}>
        <SheetContent side="right" className="w-[360px] sm:max-w-[360px] p-0 flex flex-col">
          <SheetHeader className="px-5 pt-5 pb-3 border-b">
            <SheetTitle className="text-sm font-bold">Conversation details</SheetTitle>
            <SheetDescription className="sr-only">
              Manage conversation settings
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Name */}
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Name
              </span>
              <p className="text-sm font-semibold mt-1">{name}</p>
            </div>

            {/* Participants */}
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Members ({convo.participants?.length || 0})
              </span>
              <div className="mt-2 space-y-1.5">
                {(convo.participants || []).map((p: any) => {
                  const pId = (p._id || p).toString();
                  const pName = (p as any)?.name || "User";
                  const isOnline = onlineUsers.some((u) => u.id === pId);
                  return (
                    <div key={pId} className="flex items-center gap-2 text-xs">
                      <div className="relative">
                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                          {pName.charAt(0).toUpperCase()}
                        </div>
                        {isOnline && (
                          <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 bg-emerald-500 border border-background rounded-full" />
                        )}
                      </div>
                      <span className="font-medium">{pName}</span>
                      {pId === currentUserId && (
                        <span className="text-[9px] text-muted-foreground">(you)</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Actions
              </span>
              <button
                onClick={toggleMute}
                className="w-full flex items-center gap-2 text-xs py-2 px-3 rounded-lg hover:bg-muted transition-colors"
                aria-label={isMuted ? "Unmute conversation" : "Mute conversation"}
              >
                {isMuted ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
                {isMuted ? "Unmute" : "Mute notifications"}
              </button>
              <button
                onClick={toggleArchive}
                className="w-full flex items-center gap-2 text-xs py-2 px-3 rounded-lg hover:bg-muted transition-colors"
                aria-label={isArchived ? "Unarchive conversation" : "Archive conversation"}
              >
                {isArchived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                {isArchived ? "Unarchive" : "Archive"}
              </button>
              {isGroup && (
                <button
                  onClick={leaveConversation}
                  className="w-full flex items-center gap-2 text-xs py-2 px-3 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                  aria-label="Leave conversation"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Leave group
                </button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
