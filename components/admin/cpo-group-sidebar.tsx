"use client";

import { useMemo, useState } from "react";
import { Search, Layers, Ship } from "lucide-react";
import { useUserDataStore } from "@/store/useUserDataStore";

interface CPOGroupSidebarProps {
  data: { VBNumber?: string }[];
  activeVBNumber: string | null;
  onSelect: (vbNumber: string | null) => void;
}

export function CPOGroupSidebar({
  data,
  activeVBNumber,
  onSelect,
}: CPOGroupSidebarProps) {
  const [search, setSearch] = useState("");
  const { purchaseOrders } = useUserDataStore();

  // Build a map: VidaPO _id → VBNumber display name (e.g. "VB300")
  const poDisplayMap = useMemo(() => {
    const map: Record<string, string> = {};
    (purchaseOrders || []).forEach((po: any) => {
      if (po._id && po.VBNumber) map[po._id] = po.VBNumber;
    });
    return map;
  }, [purchaseOrders]);

  // Build grouped list — resolve ObjectId to human-readable VBNumber
  const { groups, displayToKey } = useMemo(() => {
    const countMap = new Map<string, number>();
    const keyMap: Record<string, string> = {};

    data.forEach((item) => {
      const objectKey = item.VBNumber || "Unlinked";
      const displayName = poDisplayMap[objectKey] || objectKey;
      countMap.set(displayName, (countMap.get(displayName) || 0) + 1);
      if (!keyMap[displayName]) keyMap[displayName] = objectKey;
    });

    const sorted = Array.from(countMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([displayName, count]) => ({
        displayName,
        key: keyMap[displayName],
        count,
      }));

    return { groups: sorted, displayToKey: keyMap };
  }, [data, poDisplayMap]);

  // Reverse map: find display name for active key
  const activeDisplayName = useMemo(() => {
    if (!activeVBNumber) return null;
    const entry = Object.entries(displayToKey).find(([, key]) => key === activeVBNumber);
    return entry?.[0] || null;
  }, [activeVBNumber, displayToKey]);

  // Filter by search
  const filteredGroups = useMemo(() => {
    if (!search) return groups;
    const q = search.toLowerCase();
    return groups.filter((g) => g.displayName.toLowerCase().includes(q));
  }, [groups, search]);

  const isAllActive = activeVBNumber === null;

  return (
    <div className="flex flex-col h-full border-r bg-muted/20 w-[180px] shrink-0">
      {/* Search */}
      <div className="p-2 border-b">
        <div className="relative">
          <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search VB #..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-7 pl-7 pr-2 rounded-md border border-input bg-background text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      </div>

      {/* Groups */}
      <div className="flex-1 overflow-y-auto py-1 scrollbar-thin">
        {/* All */}
        <button
          onClick={() => onSelect(null)}
          className={`w-full text-left px-3 py-2 text-xs font-semibold flex items-center gap-2 transition-colors ${
            isAllActive
              ? "bg-primary/10 text-primary border-l-2 border-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border-l-2 border-transparent"
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          All Customer POs
          <span className="ml-auto text-[10px] tabular-nums opacity-60">
            {data.length}
          </span>
        </button>

        {filteredGroups.map((group) => {
          const isActive = activeDisplayName === group.displayName;
          return (
            <button
              key={group.displayName}
              onClick={() => onSelect(group.key)}
              className={`w-full text-left px-3 py-1.5 text-[11px] font-medium flex items-center gap-1.5 transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary border-l-2 border-primary"
                  : "text-foreground/80 hover:bg-muted/50 border-l-2 border-transparent"
              }`}
            >
              <Ship className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="truncate flex-1 font-mono">
                {group.displayName}
              </span>
              <span className="text-[9px] tabular-nums text-muted-foreground shrink-0">
                {group.count}
              </span>
            </button>
          );
        })}

        {filteredGroups.length === 0 && (
          <p className="text-[10px] text-muted-foreground text-center py-4">
            No matches
          </p>
        )}
      </div>
    </div>
  );
}
