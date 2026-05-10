"use client";

import { useMemo, useState } from "react";
import { Search, ChevronRight, ChevronDown, Ship, Package, Layers } from "lucide-react";
import { useUserDataStore } from "@/store/useUserDataStore";

interface ShipmentGroupSidebarProps {
  data: { VBNumber?: string; VBSerialNumber?: string; poNo?: string; customerPOId?: string }[];
  /** Currently active filter — null means "All" */
  activeVBNumber: string | null;
  activeVBSerial: string | null;
  onSelect: (vbNumber: string | null, vbSerial: string | null) => void;
}

export function ShipmentGroupSidebar({
  data,
  activeVBNumber,
  activeVBSerial,
  onSelect,
}: ShipmentGroupSidebarProps) {
  const [search, setSearch] = useState("");
  const [expandedPOs, setExpandedPOs] = useState<Set<string>>(new Set());

  // Use global store data (already loaded at app init) — no async fetch needed
  const { purchaseOrders } = useUserDataStore();

  // Build lookup maps from store data — instant, no flash
  const poLookup = useMemo(() => {
    const map: Record<string, string> = {};
    (purchaseOrders || []).forEach((po: any) => {
      map[po._id] = po.VBNumber || po.vbpoNo || po._id;
    });
    return map;
  }, [purchaseOrders]);

  // Build CPO lookup from shipping data itself — each shipping record
  // has VBSerialNumber (ObjectId) that we need to display.
  // We'll fetch CPOs once but from store if available, otherwise parse from data patterns.
  const [cpoLookup, setCpoLookup] = useState<Record<string, string>>({});
  const [cpoLoaded, setCpoLoaded] = useState(false);

  // Fetch CPO lookup once (lightweight, just IDs and names)
  useMemo(() => {
    if (cpoLoaded) return;
    fetch('/api/admin/vb-customer-po?fields=_id,VBSerialNumber,poNo')
      .then(r => r.json())
      .then((items: any[]) => {
        if (!Array.isArray(items)) return;
        const map: Record<string, string> = {};
        items.forEach((c) => {
          map[c._id] = c.VBSerialNumber || c.poNo || c._id;
        });
        setCpoLookup(map);
        setCpoLoaded(true);
      })
      .catch(() => {});
  }, [cpoLoaded]);

  const resolveVBNumber = (id: string) => poLookup[id] || id;
  const resolveVBSerial = (id: string) => cpoLookup[id] || id;

  // Build tree: VBNumber (Level-1) → VBSerialNumber (Level-2) with counts
  const tree = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    data.forEach((item) => {
      const vbNum = item.VBNumber || "Unlinked";
      const vbSer = item.VBSerialNumber || "none";
      if (!map.has(vbNum)) map.set(vbNum, new Map());
      const serMap = map.get(vbNum)!;
      serMap.set(vbSer, (serMap.get(vbSer) || 0) + 1);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => resolveVBNumber(a).localeCompare(resolveVBNumber(b)))
      .map(([vbNumber, serMap]) => ({
        vbNumber,
        displayName: resolveVBNumber(vbNumber),
        total: Array.from(serMap.values()).reduce((s, n) => s + n, 0),
        children: Array.from(serMap.entries())
          .sort(([a], [b]) => resolveVBSerial(a).localeCompare(resolveVBSerial(b)))
          .map(([vbSerial, count]) => ({
            vbSerial,
            displayName: resolveVBSerial(vbSerial),
            count,
          })),
      }));
  }, [data, poLookup, cpoLookup]);

  // Filter tree by search (searches against resolved display names)
  const filteredTree = useMemo(() => {
    if (!search) return tree;
    const q = search.toLowerCase();
    return tree
      .filter((node) => {
        if (node.displayName.toLowerCase().includes(q)) return true;
        return node.children.some((c) => c.displayName.toLowerCase().includes(q));
      })
      .map((node) => {
        if (node.displayName.toLowerCase().includes(q)) return node;
        return {
          ...node,
          children: node.children.filter((c) =>
            c.displayName.toLowerCase().includes(q)
          ),
        };
      });
  }, [tree, search]);

  const toggleExpand = (vbNumber: string) => {
    setExpandedPOs((prev) => {
      const next = new Set(prev);
      if (next.has(vbNumber)) next.delete(vbNumber);
      else next.add(vbNumber);
      return next;
    });
  };

  // Auto-expand the active node
  useMemo(() => {
    if (activeVBNumber) {
      setExpandedPOs((prev) => {
        const next = new Set(prev);
        next.add(activeVBNumber);
        return next;
      });
    }
  }, [activeVBNumber]);

  const isAllActive = !activeVBNumber;

  // Don't render items while PO lookup is empty (prevents ObjectId flash)
  const isReady = Object.keys(poLookup).length > 0 || (purchaseOrders || []).length === 0;

  return (
    <div className="flex flex-col h-full border-r bg-muted/20 w-[180px] shrink-0">
      {/* Search */}
      <div className="p-2 border-b">
        <div className="relative">
          <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search VB # / Serial #..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-7 pl-7 pr-2 rounded-md border border-input bg-background text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-1 scrollbar-thin">
        {/* "All Shipments" */}
        <button
          onClick={() => onSelect(null, null)}
          className={`w-full text-left px-3 py-2 text-xs font-semibold flex items-center gap-2 transition-colors ${
            isAllActive
              ? "bg-primary/10 text-primary border-l-2 border-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border-l-2 border-transparent"
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          All Shipments
          <span className="ml-auto text-[10px] tabular-nums opacity-60">{data.length}</span>
        </button>

        {isReady && filteredTree.map((node) => {
          const isExpanded = expandedPOs.has(node.vbNumber);
          const isLevel1Active = activeVBNumber === node.vbNumber && !activeVBSerial;

          return (
            <div key={node.vbNumber}>
              {/* Level-1: VBNumber */}
              <div className="flex items-center">
                <button
                  onClick={() => toggleExpand(node.vbNumber)}
                  className="px-1 py-1.5 text-muted-foreground hover:text-foreground"
                >
                  {isExpanded
                    ? <ChevronDown className="h-3 w-3" />
                    : <ChevronRight className="h-3 w-3" />}
                </button>
                <button
                  onClick={() => onSelect(node.vbNumber, null)}
                  className={`flex-1 text-left px-1 py-1.5 text-[11px] font-semibold flex items-center gap-1 truncate transition-colors ${
                    isLevel1Active
                      ? "text-primary"
                      : "text-foreground/80 hover:text-foreground"
                  }`}
                >
                  <Ship className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="truncate font-mono">{node.displayName}</span>
                  <span className="ml-auto text-[9px] tabular-nums text-muted-foreground shrink-0">{node.total}</span>
                </button>
              </div>

              {/* Level-2: VBSerialNumber */}
              {isExpanded && node.children.map((child) => {
                if (child.vbSerial === "none") return null;
                const isLevel2Active = activeVBNumber === node.vbNumber && activeVBSerial === child.vbSerial;
                return (
                  <button
                    key={child.vbSerial}
                    onClick={() => onSelect(node.vbNumber, child.vbSerial)}
                    className={`w-full text-left pl-8 pr-3 py-1 text-[10px] flex items-center gap-1.5 transition-colors ${
                      isLevel2Active
                        ? "bg-primary/10 text-primary font-semibold border-l-2 border-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/30 border-l-2 border-transparent"
                    }`}
                  >
                    <Package className="h-2.5 w-2.5 shrink-0" />
                    <span className="truncate font-mono">{child.displayName}</span>
                    <span className="ml-auto text-[9px] tabular-nums shrink-0">{child.count}</span>
                  </button>
                );
              })}
            </div>
          );
        })}

        {filteredTree.length === 0 && (
          <p className="text-[10px] text-muted-foreground text-center py-4">No matches</p>
        )}
      </div>
    </div>
  );
}
