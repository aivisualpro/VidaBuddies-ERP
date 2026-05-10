"use client";

import { useMemo, useState } from "react";
import { Search, ChevronRight, ChevronDown, AlertCircle, CheckCircle2, Clock, Layers, Package, Ship } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimelineEntry {
  _id: string;
  VBNumber?: string;
  VBSerialNumber?: string;
  VBShipmentNumber?: string;
  _VBNumberDisplay?: string;
  _VBSerialNumberDisplay?: string;
  _VBShipmentNumberDisplay?: string;
  status?: string;
  type?: string;
}

interface ActiveActionsGroupSidebarProps {
  data: TimelineEntry[];
  activeStatus: string | null;
  activeVBNumber: string | null;
  activeVBSerial: string | null;
  activeVBShipment: string | null;
  onSelect: (status: string | null, vbNumber: string | null, vbSerial: string | null, vbShipment: string | null) => void;
}

const STATUS_ICONS: Record<string, typeof AlertCircle> = {
  Open: AlertCircle,
  Done: CheckCircle2,
  "In Progress": Clock,
};

const STATUS_COLORS: Record<string, string> = {
  Open: "text-amber-500",
  Done: "text-emerald-500",
  "In Progress": "text-blue-500",
};

export function ActiveActionsGroupSidebar({
  data,
  activeStatus,
  activeVBNumber,
  activeVBSerial,
  activeVBShipment,
  onSelect,
}: ActiveActionsGroupSidebarProps) {
  const [search, setSearch] = useState("");
  const [expandedStatuses, setExpandedStatuses] = useState<Set<string>>(new Set(["Open"]));
  const [expandedVBNums, setExpandedVBNums] = useState<Set<string>>(new Set());
  const [expandedVBSerials, setExpandedVBSerials] = useState<Set<string>>(new Set());

  // Build tree: Status → VBNumber → VBSerialNumber → VBShipmentNumber
  const tree = useMemo(() => {
    // Level 1: status
    const statusMap = new Map<string, Map<string, Map<string, Map<string, number>>>>();

    data.forEach((item) => {
      const status = item.status || "Open";
      const vbNum = item.VBNumber || "Unlinked";
      const vbSer = item.VBSerialNumber || "";
      const vbShip = item.VBShipmentNumber || "";

      if (!statusMap.has(status)) statusMap.set(status, new Map());
      const vbMap = statusMap.get(status)!;

      if (!vbMap.has(vbNum)) vbMap.set(vbNum, new Map());
      const serMap = vbMap.get(vbNum)!;

      if (!serMap.has(vbSer)) serMap.set(vbSer, new Map());
      const shipMap = serMap.get(vbSer)!;

      shipMap.set(vbShip, (shipMap.get(vbShip) || 0) + 1);
    });

    // Sort: "Open" first, then "In Progress", then others
    const statusOrder = ["Open", "In Progress", "Done"];
    const sortedStatuses = Array.from(statusMap.keys()).sort((a, b) => {
      const ai = statusOrder.indexOf(a);
      const bi = statusOrder.indexOf(b);
      if (ai >= 0 && bi >= 0) return ai - bi;
      if (ai >= 0) return -1;
      if (bi >= 0) return 1;
      return a.localeCompare(b);
    });

    return sortedStatuses.map((status) => {
      const vbMap = statusMap.get(status)!;
      let statusTotal = 0;

      const vbNumbers = Array.from(vbMap.keys())
        .sort()
        .map((vbNum) => {
          const serMap = vbMap.get(vbNum)!;
          let vbTotal = 0;
          // Find display name for this ID from any entry
          const sampleEntry = data.find(d => (d.VBNumber || "Unlinked") === vbNum);
          const vbDisplay = sampleEntry?._VBNumberDisplay || vbNum;

          const serials = Array.from(serMap.keys())
            .sort()
            .map((vbSer) => {
              const shipMap = serMap.get(vbSer)!;
              let serTotal = 0;
              const serSample = data.find(d => d.VBSerialNumber === vbSer);
              const serDisplay = serSample?._VBSerialNumberDisplay || vbSer;

              const shipments = Array.from(shipMap.keys())
                .filter(k => k !== "")
                .sort()
                .map((vbShip) => {
                  const count = shipMap.get(vbShip)!;
                  serTotal += count;
                  const shipSample = data.find(d => d.VBShipmentNumber === vbShip);
                  const shipDisplay = shipSample?._VBShipmentNumberDisplay || vbShip;
                  return { vbShipment: vbShip, displayName: shipDisplay, count };
                });

              // Add entries without VBShipmentNumber
              const noShipCount = shipMap.get("") || 0;
              serTotal += noShipCount;
              vbTotal += serTotal;

              return { vbSerial: vbSer, displayName: serDisplay, total: serTotal, shipments };
            });

          statusTotal += vbTotal;
          return { vbNumber: vbNum, displayName: vbDisplay, total: vbTotal, serials };
        });

      return { status, total: statusTotal, vbNumbers };
    });
  }, [data]);

  // Filter tree by search
  const filteredTree = useMemo(() => {
    if (!search) return tree;
    const q = search.toLowerCase();
    return tree
      .map((statusNode) => ({
        ...statusNode,
        vbNumbers: statusNode.vbNumbers
          .filter((vb) =>
            vb.displayName.toLowerCase().includes(q) ||
            vb.serials.some((s) =>
              s.displayName.toLowerCase().includes(q) ||
              s.shipments.some((sh) => sh.displayName.toLowerCase().includes(q))
            )
          ),
      }))
      .filter((s) => s.vbNumbers.length > 0);
  }, [tree, search]);

  const toggleStatus = (status: string) =>
    setExpandedStatuses((prev) => {
      const next = new Set(prev);
      next.has(status) ? next.delete(status) : next.add(status);
      return next;
    });

  const toggleVBNum = (key: string) =>
    setExpandedVBNums((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const toggleVBSerial = (key: string) =>
    setExpandedVBSerials((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const totalEntries = data.length;

  return (
    <div className="w-[220px] min-w-[220px] border-r border-border bg-background/50 flex flex-col h-full">
      {/* Search */}
      <div className="p-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Filter..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      </div>

      {/* "All" button */}
      <button
        onClick={() => onSelect(null, null, null, null)}
        className={cn(
          "w-full text-left px-3 py-2 text-xs font-bold border-b border-border transition-colors",
          !activeStatus
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-3.5 w-3.5" />
            <span>All Actions</span>
          </div>
          <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full font-mono">{totalEntries}</span>
        </div>
      </button>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-muted py-1">
        {filteredTree.map((statusNode) => {
          const isStatusExpanded = expandedStatuses.has(statusNode.status);
          const StatusIcon = STATUS_ICONS[statusNode.status] || AlertCircle;
          const statusColor = STATUS_COLORS[statusNode.status] || "text-muted-foreground";
          const isStatusActive = activeStatus === statusNode.status && !activeVBNumber;

          return (
            <div key={statusNode.status}>
              {/* Status level */}
              <button
                onClick={() => {
                  toggleStatus(statusNode.status);
                  onSelect(statusNode.status, null, null, null);
                }}
                className={cn(
                  "w-full flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold transition-colors",
                  isStatusActive
                    ? "bg-primary/10 text-primary"
                    : "text-foreground/80 hover:bg-muted/30"
                )}
              >
                {isStatusExpanded ? (
                  <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                )}
                <StatusIcon className={cn("h-3.5 w-3.5 flex-shrink-0", statusColor)} />
                <span className="truncate">{statusNode.status}</span>
                <span className="ml-auto text-[10px] bg-muted/60 px-1.5 py-0.5 rounded-full font-mono text-muted-foreground">
                  {statusNode.total}
                </span>
              </button>

              {/* VBNumber level */}
              {isStatusExpanded &&
                statusNode.vbNumbers.map((vbNode) => {
                  const vbKey = `${statusNode.status}:${vbNode.vbNumber}`;
                  const isVBExpanded = expandedVBNums.has(vbKey);
                  const isVBActive = activeStatus === statusNode.status && activeVBNumber === vbNode.vbNumber && !activeVBSerial;

                  return (
                    <div key={vbKey}>
                      <button
                        onClick={() => {
                          toggleVBNum(vbKey);
                          onSelect(statusNode.status, vbNode.vbNumber, null, null);
                        }}
                        className={cn(
                          "w-full flex items-center gap-1.5 pl-7 pr-2.5 py-1 text-[11px] transition-colors",
                          isVBActive
                            ? "bg-primary/8 text-primary font-bold"
                            : "text-foreground/70 hover:bg-muted/20 hover:text-foreground"
                        )}
                      >
                        {vbNode.serials.length > 1 || vbNode.serials.some(s => s.shipments.length > 0) ? (
                          isVBExpanded ? (
                            <ChevronDown className="h-2.5 w-2.5 text-muted-foreground flex-shrink-0" />
                          ) : (
                            <ChevronRight className="h-2.5 w-2.5 text-muted-foreground flex-shrink-0" />
                          )
                        ) : (
                          <span className="w-2.5" />
                        )}
                        <Package className="h-3 w-3 text-primary/50 flex-shrink-0" />
                        <span className="truncate font-medium">{vbNode.displayName}</span>
                        <span className="ml-auto text-[9px] text-muted-foreground font-mono">{vbNode.total}</span>
                      </button>

                      {/* VBSerialNumber level */}
                      {isVBExpanded &&
                        vbNode.serials
                          .filter((s) => s.vbSerial !== "")
                          .map((serNode) => {
                            const serKey = `${vbKey}:${serNode.vbSerial}`;
                            const isSerExpanded = expandedVBSerials.has(serKey);
                            const isSerActive = activeStatus === statusNode.status && activeVBNumber === vbNode.vbNumber && activeVBSerial === serNode.vbSerial && !activeVBShipment;

                            return (
                              <div key={serKey}>
                                <button
                                  onClick={() => {
                                    if (serNode.shipments.length > 0) toggleVBSerial(serKey);
                                    onSelect(statusNode.status, vbNode.vbNumber, serNode.vbSerial, null);
                                  }}
                                  className={cn(
                                    "w-full flex items-center gap-1.5 pl-12 pr-2.5 py-1 text-[10px] transition-colors",
                                    isSerActive
                                      ? "bg-primary/5 text-primary font-bold"
                                      : "text-foreground/60 hover:bg-muted/15 hover:text-foreground"
                                  )}
                                >
                                  {serNode.shipments.length > 0 ? (
                                    isSerExpanded ? (
                                      <ChevronDown className="h-2.5 w-2.5 text-muted-foreground flex-shrink-0" />
                                    ) : (
                                      <ChevronRight className="h-2.5 w-2.5 text-muted-foreground flex-shrink-0" />
                                    )
                                  ) : (
                                    <span className="w-2.5" />
                                  )}
                                  <span className="truncate">{serNode.displayName}</span>
                                  <span className="ml-auto text-[9px] text-muted-foreground font-mono">{serNode.total}</span>
                                </button>

                                {/* VBShipmentNumber level */}
                                {isSerExpanded &&
                                  serNode.shipments.map((shipNode) => {
                                    const isShipActive = activeStatus === statusNode.status && activeVBNumber === vbNode.vbNumber && activeVBSerial === serNode.vbSerial && activeVBShipment === shipNode.vbShipment;
                                    return (
                                      <button
                                        key={shipNode.vbShipment}
                                        onClick={() => onSelect(statusNode.status, vbNode.vbNumber, serNode.vbSerial, shipNode.vbShipment)}
                                        className={cn(
                                          "w-full flex items-center gap-1.5 pl-[4.5rem] pr-2.5 py-0.5 text-[10px] transition-colors",
                                          isShipActive
                                            ? "bg-primary/5 text-primary font-bold"
                                            : "text-muted-foreground hover:bg-muted/10 hover:text-foreground"
                                        )}
                                      >
                                        <Ship className="h-2.5 w-2.5 text-violet-500/50 flex-shrink-0" />
                                        <span className="truncate">{shipNode.displayName}</span>
                                        <span className="ml-auto text-[9px] font-mono">{shipNode.count}</span>
                                      </button>
                                    );
                                  })}
                              </div>
                            );
                          })}
                    </div>
                  );
                })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
