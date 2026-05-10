"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { Package, FileCheck, Ship, User } from "lucide-react";
import { useUserDataStore } from "@/store/useUserDataStore";

/* ─── Types ─── */

export interface RefItem {
  kind: "VBNumber" | "VBSerialNumber" | "VBShipmentNumber";
  refId: string;
  display: string;
}

export interface MentionItem {
  userId: string;
  name: string;
  avatar?: string;
  email?: string;
}

interface MentionPopoverProps {
  mode: "#" | "@" | null;
  query: string;
  /** Position from bottom of textarea */
  bottom: number;
  left: number;
  currentUserId: string;
  users: any[];
  onSelectRef: (item: RefItem) => void;
  onSelectMention: (item: MentionItem) => void;
  onClose: () => void;
}

/* ─── Cached lookup stores (module-level) ─── */
let _serialCache: { _id: string; VBSerialNumber: string; poNo: string }[] | null = null;
let _shipCache: { _id: string; VBShipmentNumber: string; svbid: string }[] | null = null;

/* ─── Component ─── */

export function MentionPopover({
  mode,
  query,
  bottom,
  left,
  currentUserId,
  users,
  onSelectRef,
  onSelectMention,
  onClose,
}: MentionPopoverProps) {
  const { purchaseOrders } = useUserDataStore();
  const [activeTab, setActiveTab] = useState<"all" | "vb" | "serial" | "ship">("all");
  const [serials, setSerials] = useState(_serialCache || []);
  const [ships, setShips] = useState(_shipCache || []);
  const listRef = useRef<HTMLDivElement>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);

  // Fetch serials/ships once (cached at module level)
  useEffect(() => {
    if (mode !== "#") return;
    if (!_serialCache) {
      fetch("/api/admin/vb-customer-po?fields=_id,VBSerialNumber,poNo")
        .then((r) => r.json())
        .then((data: any[]) => {
          if (Array.isArray(data)) {
            _serialCache = data;
            setSerials(data);
          }
        })
        .catch(() => {});
    }
    if (!_shipCache) {
      fetch("/api/admin/vb-shipping?fields=_id,VBShipmentNumber,svbid")
        .then((r) => r.json())
        .then((data: any[]) => {
          if (Array.isArray(data)) {
            _shipCache = data;
            setShips(data);
          }
        })
        .catch(() => {});
    }
  }, [mode]);

  // Reset selection on query change
  useEffect(() => setSelectedIdx(0), [query, activeTab]);

  const q = query.toLowerCase();

  /* ── Build ref items ── */
  const refItems: RefItem[] = useMemo(() => {
    if (mode !== "#") return [];
    const items: RefItem[] = [];

    if (activeTab === "all" || activeTab === "vb") {
      (purchaseOrders || []).forEach((po: any) => {
        const display = po.VBNumber || po.vbpoNo || po._id;
        if (!q || display.toLowerCase().includes(q) || po._id?.includes(q)) {
          items.push({ kind: "VBNumber", refId: po._id, display });
        }
      });
    }
    if (activeTab === "all" || activeTab === "serial") {
      serials.forEach((s) => {
        const display = s.VBSerialNumber || s.poNo || s._id;
        if (!q || display.toLowerCase().includes(q) || s._id?.includes(q)) {
          items.push({ kind: "VBSerialNumber", refId: s._id, display });
        }
      });
    }
    if (activeTab === "all" || activeTab === "ship") {
      ships.forEach((s) => {
        const display = s.VBShipmentNumber || s.svbid || s._id;
        if (!q || display.toLowerCase().includes(q) || s._id?.includes(q)) {
          items.push({ kind: "VBShipmentNumber", refId: s._id, display });
        }
      });
    }

    return items.slice(0, 50);
  }, [mode, purchaseOrders, serials, ships, q, activeTab]);

  /* ── Build mention items ── */
  const mentionItems: MentionItem[] = useMemo(() => {
    if (mode !== "@") return [];
    return (users || [])
      .filter((u: any) => u._id !== currentUserId)
      .filter((u: any) => {
        if (!q) return true;
        return (
          u.name?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q)
        );
      })
      .slice(0, 30)
      .map((u: any) => ({
        userId: u._id,
        name: u.name || u.email,
        avatar: u.profilePicture || "",
        email: u.email || "",
      }));
  }, [mode, users, currentUserId, q]);

  const totalItems = mode === "#" ? refItems.length : mentionItems.length;

  // Keyboard navigation (delegated from parent via global keydown)
  useEffect(() => {
    if (!mode) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, totalItems - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        if (mode === "#" && refItems[selectedIdx]) {
          onSelectRef(refItems[selectedIdx]);
        } else if (mode === "@" && mentionItems[selectedIdx]) {
          onSelectMention(mentionItems[selectedIdx]);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [mode, selectedIdx, totalItems, refItems, mentionItems, onSelectRef, onSelectMention, onClose]);

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selectedIdx}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [selectedIdx]);

  if (!mode || totalItems === 0) return null;

  const REF_TABS = [
    { key: "all" as const, label: "All" },
    { key: "vb" as const, label: "VB#" },
    { key: "serial" as const, label: "Serial#" },
    { key: "ship" as const, label: "Shipment#" },
  ];

  const kindIcon = (kind: string) => {
    switch (kind) {
      case "VBNumber": return <Package className="h-3.5 w-3.5 text-indigo-500" />;
      case "VBSerialNumber": return <FileCheck className="h-3.5 w-3.5 text-emerald-500" />;
      case "VBShipmentNumber": return <Ship className="h-3.5 w-3.5 text-violet-500" />;
      default: return null;
    }
  };

  return (
    <div
      className="absolute z-50 bg-background border rounded-xl shadow-xl w-[280px] overflow-hidden"
      style={{ bottom: `${bottom}px`, left: `${left}px` }}
    >
      {/* # tabs */}
      {mode === "#" && (
        <div className="flex border-b px-1 pt-1">
          {REF_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 text-[10px] font-semibold py-1.5 rounded-t-lg transition-colors ${
                activeTab === tab.key
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      <div ref={listRef} className="max-h-72 overflow-y-auto py-1 scrollbar-thin">
        {mode === "#" &&
          refItems.map((item, idx) => (
            <button
              key={`${item.kind}-${item.refId}`}
              data-idx={idx}
              onClick={() => onSelectRef(item)}
              className={`w-full text-left px-3 py-2 flex items-center gap-2.5 text-sm transition-colors ${
                idx === selectedIdx
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-muted/50"
              }`}
            >
              {kindIcon(item.kind)}
              <div className="min-w-0 flex-1">
                <span className="font-semibold text-[12px] block truncate">
                  {item.display}
                </span>
                <span className="text-[10px] text-muted-foreground truncate block">
                  {item.kind.replace("VB", "").replace("Number", "")} · {item.refId.slice(-6)}
                </span>
              </div>
            </button>
          ))}

        {mode === "@" &&
          mentionItems.map((item, idx) => (
            <button
              key={item.userId}
              data-idx={idx}
              onClick={() => onSelectMention(item)}
              className={`w-full text-left px-3 py-2 flex items-center gap-2.5 text-sm transition-colors ${
                idx === selectedIdx
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-muted/50"
              }`}
            >
              <div className="h-7 w-7 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-[10px] font-bold text-amber-700 dark:text-amber-300 overflow-hidden shrink-0">
                {item.avatar ? (
                  <img src={item.avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  item.name.charAt(0).toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <span className="font-semibold text-[12px] block truncate">
                  {item.name}
                </span>
                {item.email && (
                  <span className="text-[10px] text-muted-foreground truncate block">
                    {item.email}
                  </span>
                )}
              </div>
            </button>
          ))}
      </div>
    </div>
  );
}
