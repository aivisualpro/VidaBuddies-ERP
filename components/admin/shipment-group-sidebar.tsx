"use client";

import { useMemo, useState, useEffect } from "react";
import { Search, ChevronRight, ChevronDown, Ship, Package, Layers } from "lucide-react";

interface ShipmentGroupSidebarProps {
  data: { VBNumber?: string; VBSerialNumber?: string }[];
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
  const [poLookup, setPoLookup] = useState<Record<string, string>>({});
  const [cpoLookup, setCpoLookup] = useState<Record<string, string>>({});

  // Fetch vidapos + vbcustomerpos to build ID → display name lookups
  useEffect(() => {
    // VBNumber on shipping = vidapos._id → resolve to vidapos.VBNumber (e.g. "VB1")
    fetch('/api/admin/purchase-orders')
      .then(r => r.json())
      .then((items: any[]) => {
        if (!Array.isArray(items)) return;
        const map: Record<string, string> = {};
        items.forEach((po) => {
          map[po._id] = po.VBNumber || po.vbpoNo || po._id;
        });
        setPoLookup(map);
      })
      .catch(() => {});

    // VBSerialNumber on shipping = vbcustomerpos._id → resolve to cpo.VBSerialNumber (e.g. "VB1-1")
    fetch('/api/admin/vb-customer-po')
      .then(r => r.json())
      .then((items: any[]) => {
        if (!Array.isArray(items)) return;
        const map: Record<string, string> = {};
        items.forEach((c) => {
          map[c._id] = c.VBSerialNumber || c.poNo || c._id;
        });
        setCpoLookup(map);
      })
      .catch(() => {});
  }, []);

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

  const isAllActive = activeVBNumber === null && activeVBSerial === null;

  return (
    <div className="flex flex-col h-full border-r bg-muted/20 w-[200px] shrink-0">
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
        {/* All */}
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
          <span className="ml-auto text-[10px] tabular-nums opacity-60">
            {data.length}
          </span>
        </button>

        {filteredTree.map((node) => {
          const isExpanded = expandedPOs.has(node.vbNumber);
          const isActive = activeVBNumber === node.vbNumber && activeVBSerial === null;
          const hasChildren =
            node.children.length > 1 ||
            (node.children.length === 1 && node.children[0].vbSerial !== "none");

          return (
            <div key={node.vbNumber}>
              {/* Level 1: VB Number */}
              <button
                onClick={() => {
                  if (hasChildren) toggleExpand(node.vbNumber);
                  onSelect(node.vbNumber, null);
                }}
                className={`w-full text-left px-3 py-1.5 text-[11px] font-medium flex items-center gap-1.5 transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary border-l-2 border-primary"
                    : "text-foreground/80 hover:bg-muted/50 border-l-2 border-transparent"
                }`}
              >
                {hasChildren ? (
                  isExpanded ? (
                    <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                  )
                ) : (
                  <Ship className="h-3 w-3 text-muted-foreground shrink-0" />
                )}
                <span className="truncate flex-1 font-mono">
                  {node.displayName}
                </span>
                <span className="text-[9px] tabular-nums text-muted-foreground shrink-0">
                  {node.total}
                </span>
              </button>

              {/* Level 2: VB Serial Number */}
              {isExpanded &&
                hasChildren &&
                node.children.map((child) => {
                  const isChildActive =
                    activeVBNumber === node.vbNumber &&
                    activeVBSerial === child.vbSerial;
                  return (
                    <button
                      key={child.vbSerial}
                      onClick={() => onSelect(node.vbNumber, child.vbSerial)}
                      className={`w-full text-left pl-8 pr-3 py-1 text-[10px] flex items-center gap-1.5 transition-colors ${
                        isChildActive
                          ? "bg-primary/5 text-primary font-semibold border-l-2 border-primary/50"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/30 border-l-2 border-transparent"
                      }`}
                    >
                      <Package className="h-2.5 w-2.5 shrink-0" />
                      <span className="truncate flex-1 font-mono">
                        {child.vbSerial === "none"
                          ? "No Serial"
                          : child.displayName}
                      </span>
                      <span className="text-[9px] tabular-nums opacity-50 shrink-0">
                        {child.count}
                      </span>
                    </button>
                  );
                })}
            </div>
          );
        })}

        {filteredTree.length === 0 && (
          <p className="text-[10px] text-muted-foreground text-center py-4">
            No matches
          </p>
        )}
      </div>
    </div>
  );
}
