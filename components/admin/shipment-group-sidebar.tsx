"use client";

import { useMemo, useState } from "react";
import { Search, ChevronRight, ChevronDown, Ship, Package, Layers, Anchor } from "lucide-react";

interface ShipmentGroupSidebarProps {
  data: {
    VBNumber?: string;
    VBSerialNumber?: string;
    VBShipmentNumber?: string;
    svbid?: string;
    _displayVBNumber?: string;
    _displayVBSerialNumber?: string;
  }[];
  /** Currently active filter — null means "All" */
  activeVBNumber: string | null;
  activeVBSerial: string | null;
  activeShipment: string | null;
  onSelect: (vbNumber: string | null, vbSerial: string | null, shipment: string | null) => void;
}

export function ShipmentGroupSidebar({
  data,
  activeVBNumber,
  activeVBSerial,
  activeShipment,
  onSelect,
}: ShipmentGroupSidebarProps) {
  const [search, setSearch] = useState("");
  const [expandedPOs, setExpandedPOs] = useState<Set<string>>(new Set());
  const [expandedSerials, setExpandedSerials] = useState<Set<string>>(new Set());

  // Build 3-level tree: VBNumber → VBSerialNumber → VBShipmentNumber
  const tree = useMemo(() => {
    const map = new Map<
      string,
      {
        displayName: string;
        serials: Map<
          string,
          {
            displayName: string;
            shipments: Map<string, { displayName: string; count: number }>;
          }
        >;
      }
    >();

    data.forEach((item) => {
      const vbNum = item.VBNumber || "Unlinked";
      const vbSer = item.VBSerialNumber || "none";
      const shipId = item.VBShipmentNumber || item.svbid || "none";
      const vbNumDisplay = (item as any)._displayVBNumber || vbNum;
      const vbSerDisplay = (item as any)._displayVBSerialNumber || vbSer;
      const shipDisplay = item.VBShipmentNumber || item.svbid || "—";

      if (!map.has(vbNum)) map.set(vbNum, { displayName: vbNumDisplay, serials: new Map() });
      const node = map.get(vbNum)!;
      if (!node.serials.has(vbSer)) node.serials.set(vbSer, { displayName: vbSerDisplay, shipments: new Map() });
      const serialNode = node.serials.get(vbSer)!;
      if (!serialNode.shipments.has(shipId)) serialNode.shipments.set(shipId, { displayName: shipDisplay, count: 0 });
      serialNode.shipments.get(shipId)!.count++;
    });

    return Array.from(map.entries())
      .sort(([, a], [, b]) => a.displayName.localeCompare(b.displayName))
      .map(([vbNumber, { displayName, serials }]) => ({
        vbNumber,
        displayName,
        total: data.filter((d) => (d.VBNumber || "Unlinked") === vbNumber).length,
        children: Array.from(serials.entries())
          .sort(([, a], [, b]) => a.displayName.localeCompare(b.displayName))
          .map(([vbSerial, { displayName: serDisplay, shipments }]) => ({
            vbSerial,
            displayName: serDisplay,
            count: Array.from(shipments.values()).reduce((s, n) => s + n.count, 0),
            shipments: Array.from(shipments.entries())
              .sort(([, a], [, b]) => a.displayName.localeCompare(b.displayName))
              .map(([shipId, { displayName: shipDisplay, count }]) => ({
                shipId,
                displayName: shipDisplay,
                count,
              })),
          })),
      }));
  }, [data]);

  // Filter tree by search
  const filteredTree = useMemo(() => {
    if (!search) return tree;
    const q = search.toLowerCase();
    return tree
      .filter((node) => {
        if (node.displayName.toLowerCase().includes(q)) return true;
        return node.children.some(
          (c) =>
            c.displayName.toLowerCase().includes(q) ||
            c.shipments.some((s) => s.displayName.toLowerCase().includes(q))
        );
      })
      .map((node) => {
        if (node.displayName.toLowerCase().includes(q)) return node;
        return {
          ...node,
          children: node.children
            .filter(
              (c) =>
                c.displayName.toLowerCase().includes(q) ||
                c.shipments.some((s) => s.displayName.toLowerCase().includes(q))
            )
            .map((c) => {
              if (c.displayName.toLowerCase().includes(q)) return c;
              return {
                ...c,
                shipments: c.shipments.filter((s) => s.displayName.toLowerCase().includes(q)),
              };
            }),
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

  const toggleSerialExpand = (key: string) => {
    setExpandedSerials((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Auto-expand the active nodes
  useMemo(() => {
    if (activeVBNumber) {
      setExpandedPOs((prev) => {
        const next = new Set(prev);
        next.add(activeVBNumber);
        return next;
      });
    }
    if (activeVBNumber && activeVBSerial) {
      setExpandedSerials((prev) => {
        const next = new Set(prev);
        next.add(`${activeVBNumber}:${activeVBSerial}`);
        return next;
      });
    }
  }, [activeVBNumber, activeVBSerial]);

  const isAllActive = !activeVBNumber;

  return (
    <div className="flex flex-col h-full border-r bg-muted/20 w-[200px] shrink-0">
      {/* Search */}
      <div className="p-2 border-b">
        <div className="relative">
          <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search..."
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
          onClick={() => onSelect(null, null, null)}
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

        {filteredTree.map((node) => {
          const isExpanded = expandedPOs.has(node.vbNumber);
          const isLevel1Active = activeVBNumber === node.vbNumber && !activeVBSerial && !activeShipment;

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
                  onClick={() => onSelect(node.vbNumber, null, null)}
                  className={`flex-1 text-left px-1 py-1.5 text-[11px] font-semibold flex items-center gap-1 truncate transition-colors ${
                    isLevel1Active
                      ? "text-primary"
                      : "text-foreground/80 hover:text-foreground"
                  }`}
                >
                  <Package className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="truncate font-mono">{node.displayName}</span>
                  <span className="ml-auto text-[9px] tabular-nums text-muted-foreground shrink-0">{node.total}</span>
                </button>
              </div>

              {/* Level-2: VBSerialNumber (Contract #) */}
              {isExpanded && node.children.map((child) => {
                if (child.vbSerial === "none") return null;
                const serialKey = `${node.vbNumber}:${child.vbSerial}`;
                const isSerialExpanded = expandedSerials.has(serialKey);
                const isLevel2Active = activeVBNumber === node.vbNumber && activeVBSerial === child.vbSerial && !activeShipment;

                return (
                  <div key={child.vbSerial}>
                    <div className="flex items-center pl-4">
                      {child.shipments.length > 0 && (
                        <button
                          onClick={() => toggleSerialExpand(serialKey)}
                          className="px-1 py-1 text-muted-foreground hover:text-foreground"
                        >
                          {isSerialExpanded
                            ? <ChevronDown className="h-2.5 w-2.5" />
                            : <ChevronRight className="h-2.5 w-2.5" />}
                        </button>
                      )}
                      {child.shipments.length === 0 && <span className="w-5" />}
                      <button
                        onClick={() => onSelect(node.vbNumber, child.vbSerial, null)}
                        className={`flex-1 text-left px-1 py-1 text-[10px] flex items-center gap-1.5 truncate transition-colors ${
                          isLevel2Active
                            ? "bg-primary/10 text-primary font-semibold"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                        }`}
                      >
                        <Ship className="h-2.5 w-2.5 shrink-0" />
                        <span className="truncate font-mono">{child.displayName}</span>
                        <span className="ml-auto text-[9px] tabular-nums shrink-0">{child.count}</span>
                      </button>
                    </div>

                    {/* Level-3: VBShipmentNumber */}
                    {isSerialExpanded && child.shipments.map((shipment) => {
                      if (shipment.shipId === "none") return null;
                      const isLevel3Active = activeVBNumber === node.vbNumber && activeVBSerial === child.vbSerial && activeShipment === shipment.shipId;
                      return (
                        <button
                          key={shipment.shipId}
                          onClick={() => onSelect(node.vbNumber, child.vbSerial, shipment.shipId)}
                          className={`w-full text-left pl-12 pr-3 py-0.5 text-[10px] flex items-center gap-1.5 transition-colors ${
                            isLevel3Active
                              ? "bg-primary/10 text-primary font-semibold border-l-2 border-primary"
                              : "text-muted-foreground/70 hover:text-foreground hover:bg-muted/20 border-l-2 border-transparent"
                          }`}
                        >
                          <Anchor className="h-2 w-2 shrink-0" />
                          <span className="truncate font-mono">{shipment.displayName}</span>
                        </button>
                      );
                    })}
                  </div>
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
