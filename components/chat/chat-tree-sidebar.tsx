"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import {
  Search,
  ChevronRight,
  ChevronDown,
  Ship,
  Package,
  Truck,
  MessageCircle,
  AtSign,
  Hash,
  Users,
  Plus,
} from "lucide-react";

/* ─── Types ─── */

interface ConvSummary {
  _id: string;
  name: string;
  kind: "dm" | "group" | "ref";
  lastMessage: string;
  lastMessageAt: string;
  unread: number;
  refs: { kind: string; refId: string; display: string }[];
  participants: any[];
  icon?: string;
  lastMessageBy?: any;
}

interface ShipLeaf {
  display: string;
  conversations: ConvSummary[];
}
interface SerialNode {
  display: string;
  conversations: ConvSummary[];
  byShipment: Record<string, ShipLeaf>;
}
interface VBNode {
  display: string;
  conversations: ConvSummary[];
  bySerial: Record<string, SerialNode>;
}

interface TreeData {
  groups: { byVBNumber: Record<string, VBNode> };
  dms: ConvSummary[];
  mentionsCount: number;
  currentUser: { id: string; name: string; email: string };
}

interface ChatTreeSidebarProps {
  activeConvId: string | null;
  onSelect: (conv: ConvSummary | null, mode?: "mentions") => void;
  onNewChat?: () => void;
}

/* ─── Helpers ─── */

function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const oneDay = 86400000;
  if (diff < oneDay && d.getDate() === now.getDate())
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diff < 7 * oneDay) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function getOtherName(conv: ConvSummary, myId: string): string {
  if (conv.name) return conv.name;
  const other = conv.participants?.find(
    (p: any) => (p._id || p).toString() !== myId
  );
  return (other as any)?.name || "Chat";
}

/* ─── Component ─── */

export function ChatTreeSidebar({
  activeConvId,
  onSelect,
  onNewChat,
}: ChatTreeSidebarProps) {
  const [data, setData] = useState<TreeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedL1, setExpandedL1] = useState<Set<string>>(new Set());
  const [expandedL2, setExpandedL2] = useState<Set<string>>(new Set());
  const [mentionsActive, setMentionsActive] = useState(false);

  // Fetch tree data
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/chat/conversations");
      if (res.ok) setData(await res.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Auto-expand to active conversation
  useEffect(() => {
    if (!data || !activeConvId) return;
    const { byVBNumber } = data.groups;
    for (const [vbId, vb] of Object.entries(byVBNumber)) {
      // Check direct L1 conversations
      if (vb.conversations.some((c) => c._id === activeConvId)) {
        setExpandedL1((p) => new Set(p).add(vbId));
      }
      for (const [serId, ser] of Object.entries(vb.bySerial)) {
        if (ser.conversations.some((c) => c._id === activeConvId)) {
          setExpandedL1((p) => new Set(p).add(vbId));
          setExpandedL2((p) => new Set(p).add(`${vbId}:${serId}`));
        }
        for (const [shipId, ship] of Object.entries(ser.byShipment)) {
          if (ship.conversations.some((c) => c._id === activeConvId)) {
            setExpandedL1((p) => new Set(p).add(vbId));
            setExpandedL2((p) => new Set(p).add(`${vbId}:${serId}`));
          }
        }
      }
    }
  }, [data, activeConvId]);

  const toggleL1 = (id: string) =>
    setExpandedL1((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const toggleL2 = (id: string) =>
    setExpandedL2((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  // Filter
  const q = search.toLowerCase();

  const filteredVBNumbers = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.groups.byVBNumber).filter(([, vb]) => {
      if (!q) return true;
      if (vb.display.toLowerCase().includes(q)) return true;
      return Object.values(vb.bySerial).some(
        (s) =>
          s.display.toLowerCase().includes(q) ||
          Object.values(s.byShipment).some((sh) =>
            sh.display.toLowerCase().includes(q)
          )
      );
    });
  }, [data, q]);

  const filteredDMs = useMemo(() => {
    if (!data) return [];
    if (!q) return data.dms;
    return data.dms.filter(
      (c) =>
        getOtherName(c, data.currentUser.id).toLowerCase().includes(q) ||
        c.lastMessage?.toLowerCase().includes(q)
    );
  }, [data, q]);

  const myId = data?.currentUser?.id || "";

  // Count total convs in a VB node (recursive)
  const countNode = (vb: VBNode) => {
    let n = vb.conversations.length;
    for (const s of Object.values(vb.bySerial)) {
      n += s.conversations.length;
      for (const sh of Object.values(s.byShipment)) n += sh.conversations.length;
    }
    return n;
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full border-r bg-muted/20 w-[280px] shrink-0 items-center justify-center">
        <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-[10px] text-muted-foreground mt-2">Loading…</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full border-r bg-muted/20 w-[280px] shrink-0">
      {/* Header + Search */}
      <div className="p-3 border-b space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-foreground tracking-wide">
            Conversations
          </span>
          {onNewChat && (
            <button
              onClick={onNewChat}
              className="h-6 w-6 rounded-md bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-7 pl-7 pr-2 rounded-md border border-input bg-background text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-1 scrollbar-thin">
        {/* ── Mentions ── */}
        {data && data.mentionsCount > 0 && (
          <button
            onClick={() => {
              setMentionsActive(true);
              onSelect(null, "mentions");
            }}
            className={`w-full text-left px-3 py-2 text-xs font-semibold flex items-center gap-2 transition-colors ${
              mentionsActive
                ? "bg-primary/10 text-primary border-l-2 border-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border-l-2 border-transparent"
            }`}
          >
            <AtSign className="h-3.5 w-3.5" />
            Mentions
            <span className="ml-auto text-[10px] tabular-nums bg-primary text-primary-foreground rounded-full px-1.5 min-w-[18px] text-center font-bold">
              {data.mentionsCount}
            </span>
          </button>
        )}

        {/* ── Direct Messages ── */}
        {filteredDMs.length > 0 && (
          <div className="mt-1">
            <div className="px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Direct Messages
            </div>
            {filteredDMs.map((conv) => (
              <ConvRow
                key={conv._id}
                conv={conv}
                isActive={activeConvId === conv._id && !mentionsActive}
                myId={myId}
                indent={0}
                onClick={() => {
                  setMentionsActive(false);
                  onSelect(conv);
                }}
              />
            ))}
          </div>
        )}

        {/* ── Records / Shipments ── */}
        {filteredVBNumbers.length > 0 && (
          <div className="mt-1">
            <div className="px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Records
            </div>

            {filteredVBNumbers.map(([vbId, vb]) => {
              const isExp = expandedL1.has(vbId);
              return (
                <div key={vbId}>
                  {/* Level-1: VBNumber */}
                  <div className="flex items-center">
                    <button
                      onClick={() => toggleL1(vbId)}
                      className="px-1 py-1.5 text-muted-foreground hover:text-foreground"
                    >
                      {isExp ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                    </button>
                    <button
                      onClick={() => toggleL1(vbId)}
                      className="flex-1 text-left px-1 py-1.5 text-[11px] font-semibold flex items-center gap-1 truncate text-foreground/80 hover:text-foreground transition-colors"
                    >
                      <Ship className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="truncate font-mono">
                        {vb.display}
                      </span>
                      <span className="ml-auto text-[9px] tabular-nums text-muted-foreground shrink-0">
                        {countNode(vb)}
                      </span>
                    </button>
                  </div>

                  {/* Level-2: VBSerialNumber */}
                  {isExp &&
                    Object.entries(vb.bySerial).map(([serId, ser]) => {
                      const l2Key = `${vbId}:${serId}`;
                      const isL2Exp = expandedL2.has(l2Key);
                      const shipEntries = Object.entries(ser.byShipment);
                      return (
                        <div key={serId}>
                          <div className="flex items-center pl-4">
                            {shipEntries.length > 0 ? (
                              <button
                                onClick={() => toggleL2(l2Key)}
                                className="px-1 py-1 text-muted-foreground hover:text-foreground"
                              >
                                {isL2Exp ? (
                                  <ChevronDown className="h-2.5 w-2.5" />
                                ) : (
                                  <ChevronRight className="h-2.5 w-2.5" />
                                )}
                              </button>
                            ) : (
                              <span className="w-5" />
                            )}
                            <span className="flex-1 text-left px-1 py-1 text-[10px] font-semibold flex items-center gap-1 truncate text-muted-foreground">
                              <Package className="h-2.5 w-2.5 shrink-0" />
                              <span className="truncate font-mono">
                                {ser.display}
                              </span>
                              <span className="ml-auto text-[9px] tabular-nums shrink-0">
                                {ser.conversations.length +
                                  Object.values(ser.byShipment).reduce(
                                    (a, s) => a + s.conversations.length,
                                    0
                                  )}
                              </span>
                            </span>
                          </div>

                          {/* Serial-level conversations */}
                          {ser.conversations.map((conv) => (
                            <ConvRow
                              key={conv._id}
                              conv={conv}
                              isActive={
                                activeConvId === conv._id && !mentionsActive
                              }
                              myId={myId}
                              indent={2}
                              onClick={() => {
                                setMentionsActive(false);
                                onSelect(conv);
                              }}
                            />
                          ))}

                          {/* Level-3: VBShipmentNumber */}
                          {isL2Exp &&
                            shipEntries.map(([shipId, ship]) => (
                              <div key={shipId}>
                                <div className="pl-10 pr-3 py-1 text-[10px] flex items-center gap-1 text-muted-foreground">
                                  <Truck className="h-2.5 w-2.5 shrink-0" />
                                  <span className="truncate font-mono">
                                    {ship.display}
                                  </span>
                                  <span className="ml-auto text-[9px] tabular-nums shrink-0">
                                    {ship.conversations.length}
                                  </span>
                                </div>
                                {ship.conversations.map((conv) => (
                                  <ConvRow
                                    key={conv._id}
                                    conv={conv}
                                    isActive={
                                      activeConvId === conv._id &&
                                      !mentionsActive
                                    }
                                    myId={myId}
                                    indent={3}
                                    onClick={() => {
                                      setMentionsActive(false);
                                      onSelect(conv);
                                    }}
                                  />
                                ))}
                              </div>
                            ))}
                        </div>
                      );
                    })}

                  {/* VBNumber-level conversations (not under any serial) */}
                  {isExp &&
                    vb.conversations
                      .filter(
                        (c) =>
                          !Object.values(vb.bySerial).some((s) =>
                            s.conversations.some((sc) => sc._id === c._id)
                          )
                      )
                      .map((conv) => (
                        <ConvRow
                          key={conv._id}
                          conv={conv}
                          isActive={
                            activeConvId === conv._id && !mentionsActive
                          }
                          myId={myId}
                          indent={1}
                          onClick={() => {
                            setMentionsActive(false);
                            onSelect(conv);
                          }}
                        />
                      ))}
                </div>
              );
            })}
          </div>
        )}

        {/* Empty */}
        {filteredVBNumbers.length === 0 && filteredDMs.length === 0 && (
          <p className="text-[10px] text-muted-foreground text-center py-6">
            {q ? "No matches" : "No conversations yet"}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── Conversation leaf row ─── */

const INDENT_PX = [12, 24, 36, 48];

function ConvRow({
  conv,
  isActive,
  myId,
  indent,
  onClick,
}: {
  conv: ConvSummary;
  isActive: boolean;
  myId: string;
  indent: number;
  onClick: () => void;
}) {
  const name = getOtherName(conv, myId);
  const isGroup = conv.kind === "group" || conv.kind === "ref";

  return (
    <button
      onClick={onClick}
      className={`w-full text-left pr-3 py-1.5 flex items-center gap-2 transition-colors ${
        isActive
          ? "bg-primary/10 text-primary border-l-2 border-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/30 border-l-2 border-transparent"
      }`}
      style={{ paddingLeft: `${INDENT_PX[indent] ?? 12}px` }}
    >
      {/* Icon */}
      <div
        className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${
          isGroup
            ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
            : "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
        }`}
      >
        {isGroup ? (
          <Users className="h-3 w-3" />
        ) : (
          name.charAt(0).toUpperCase()
        )}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span
            className={`text-[11px] truncate ${
              isActive ? "font-bold" : "font-semibold"
            }`}
          >
            {name}
          </span>
          <span className="ml-auto text-[9px] tabular-nums text-muted-foreground shrink-0">
            {timeAgo(conv.lastMessageAt)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground truncate">
            {conv.lastMessage || "No messages yet"}
          </span>
          {conv.unread > 0 && (
            <span className="ml-auto shrink-0 text-[9px] font-bold bg-primary text-primary-foreground rounded-full px-1.5 min-w-[16px] text-center">
              {conv.unread}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
