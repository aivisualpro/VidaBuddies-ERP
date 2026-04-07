"use client";

import { useEffect, useState, useMemo, useLayoutEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUserDataStore } from "@/store/useUserDataStore";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import { toast } from "sonner";
import {
  Ship,
  CheckCircle2,
  Clock,
  Package,
  Archive,
  Search,
  Truck,
  ShoppingCart,
  TrendingUp,
  AlertCircle,
  X,
  ChevronDown,
  ChevronRight,
  Anchor,
  MapPin,
  Calendar,
  Hash,
} from "lucide-react";
import { TablePageSkeleton } from "@/components/skeletons";

/* ───────────────────────── Types ───────────────────────── */

interface Shipping {
  _id?: string;
  spoNo?: string;
  status?: string;
  carrier?: string;
  ETA?: string;
  svbid?: string;
  containerNo?: string;
  bookingNo?: string;
  portOfLoading?: string;
  portOfDischarge?: string;
  [key: string]: any;
}

interface CustomerPO {
  _id?: string;
  poNo?: string;
  customer?: string;
  customerPONo?: string;
  qtyOrdered?: number;
  qtyReceived?: number;
  shipping?: Shipping[];
}

interface PurchaseOrder {
  _id: string;
  vbpoNo: string;
  orderType: string;
  category: string;
  date: string;
  createdBy: string;
  isArchived?: boolean;
  isNigalu?: boolean;
  customerPO?: CustomerPO[];
}

/* ───────────────────────── Helpers ───────────────────────── */

function normalizeStatus(raw: string): string {
  if (!raw) return "pending";
  const s = raw.toLowerCase().trim();
  if (s === "delivered" || s === "arrived") return "delivered";
  if (s === "in transit" || s === "in_transit" || s === "on water") return "in transit";
  if (s === "planned" || s === "booking confirmed") return "planned";
  if (s === "ordered") return "ordered";
  return "pending";
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; barColor: string; icon: any; dotColor: string }> = {
  delivered: {
    label: "Delivered",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    barColor: "bg-emerald-500",
    dotColor: "bg-emerald-500",
    icon: CheckCircle2,
  },
  "in transit": {
    label: "In Transit",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    barColor: "bg-blue-500",
    dotColor: "bg-blue-500",
    icon: Ship,
  },
  planned: {
    label: "Planned",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    barColor: "bg-amber-500",
    dotColor: "bg-amber-500",
    icon: Clock,
  },
  ordered: {
    label: "Ordered",
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/30",
    barColor: "bg-violet-500",
    dotColor: "bg-violet-500",
    icon: Package,
  },
  pending: {
    label: "Pending",
    color: "text-zinc-500 dark:text-zinc-400",
    bg: "bg-zinc-500/10",
    border: "border-zinc-500/30",
    barColor: "bg-zinc-400 dark:bg-zinc-600",
    dotColor: "bg-zinc-400",
    icon: AlertCircle,
  },
};

function getOverallCardStatus(po: PurchaseOrder): string {
  const statuses: string[] = [];
  po.customerPO?.forEach((cpo) => {
    cpo.shipping?.forEach((ship) => {
      statuses.push(normalizeStatus(ship.status || ""));
    });
  });
  if (statuses.length === 0) return "pending";
  if (statuses.every((s) => s === "delivered")) return "delivered";
  if (statuses.some((s) => s === "in transit")) return "in transit";
  if (statuses.some((s) => s === "planned")) return "planned";
  if (statuses.some((s) => s === "ordered")) return "ordered";
  return "pending";
}

function getDominantStatus(shippings: Shipping[]): string {
  if (shippings.length === 0) return "pending";
  let best = "pending";
  const priority = ["pending", "ordered", "planned", "in transit", "delivered"];
  shippings.forEach((ship) => {
    const norm = normalizeStatus(ship.status || "");
    if (priority.indexOf(norm) > priority.indexOf(best)) best = norm;
  });
  return best;
}

const ORDER_TYPE_COLORS: Record<string, string> = {
  Export: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/25",
  Import: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/25",
  Dropship: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/25",
  DROPSHIP: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/25",
  Inventory: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/25",
  INVENTORY: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/25",
  IMPORT: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/25",
};

const CATEGORY_COLORS: Record<string, string> = {
  CONVENTIONAL: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/25",
  ORGANIC: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25",
};

/* ───────────────────────── Sub Components ───────────────────────── */

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
      <span className="relative flex h-1.5 w-1.5">
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${cfg.dotColor}`} />
        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${cfg.dotColor}`} />
      </span>
      {cfg.label}
    </span>
  );
}

function MiniStatusDot({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-px rounded-md ${cfg.bg} ${cfg.color}`}>
      <span className={`inline-block h-1 w-1 rounded-full ${cfg.dotColor}`} />
      {cfg.label}
    </span>
  );
}

function ToggleSwitch({ checked, onChange, label, activeColor }: {
  checked: boolean; onChange: () => void; label: string; activeColor: string;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      className="flex items-center gap-1.5 group/toggle"
      title={`Toggle ${label}`}
    >
      <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground group-hover/toggle:text-foreground transition-colors">
        {label}
      </span>
      <div className={`relative w-7 h-4 rounded-full transition-all duration-300 shadow-inner ${checked ? `${activeColor} shadow-[0_0_6px_rgba(0,0,0,0.15)]` : "bg-zinc-300 dark:bg-zinc-700"}`}>
        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-md transition-all duration-300 ${checked ? "left-3.5" : "left-0.5"}`} />
      </div>
    </button>
  );
}

/* ── Inline select chip ─────────────────────────────── */

function InlineSelectChip({
  value,
  options,
  colorMap,
  onSave,
}: {
  value: string;
  options: string[];
  colorMap: Record<string, string>;
  onSave: (val: string) => void;
}) {
  const chipColor = colorMap[value] || "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700";
  return (
    <select
      value={value}
      onChange={(e) => { e.stopPropagation(); onSave(e.target.value); }}
      onClick={(e) => e.stopPropagation()}
      className={`appearance-none cursor-pointer text-[10px] font-semibold px-1.5 py-0.5 rounded-md border outline-none transition-all hover:ring-1 hover:ring-primary/30 ${chipColor}`}
    >
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}

/* ── Individual Shipping Row (inside expanded CPO) ──── */

function ShippingDetailRow({ ship, index }: { ship: Shipping; index: number }) {
  const status = normalizeStatus(ship.status || "");
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const eta = ship.ETA ? new Date(ship.ETA).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null;

  return (
    <div className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-muted/30 hover:bg-muted/60 transition-colors group/shiprow">
      {/* Index dot */}
      <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-black ${cfg.bg} ${cfg.color}`}>
        {index + 1}
      </span>

      {/* SVBID / SPO */}
      <span className="text-[10px] font-semibold text-foreground truncate min-w-0 max-w-[80px]" title={ship.svbid || ship.spoNo || ""}>
        {ship.svbid || ship.spoNo || `S-${index + 1}`}
      </span>

      {/* Status pill */}
      <MiniStatusDot status={status} />

      {/* Carrier */}
      {ship.carrier && (
        <span className="text-[9px] text-muted-foreground truncate max-w-[60px] hidden sm:inline" title={ship.carrier}>
          <Truck className="inline h-2.5 w-2.5 mr-0.5 -mt-px" />
          {ship.carrier}
        </span>
      )}

      {/* Container */}
      {ship.containerNo && (
        <span className="text-[9px] text-muted-foreground truncate max-w-[70px] hidden md:inline" title={ship.containerNo}>
          <Package className="inline h-2.5 w-2.5 mr-0.5 -mt-px" />
          {ship.containerNo}
        </span>
      )}

      {/* ETA */}
      {eta && (
        <span className="text-[9px] text-muted-foreground ml-auto whitespace-nowrap flex items-center gap-0.5">
          <Calendar className="h-2.5 w-2.5" />
          {eta}
        </span>
      )}
    </div>
  );
}

/* ── CPO Gauge Bar (expandable to show shippings) ──── */

function ExpandableCPORow({ cpo, index }: { cpo: CustomerPO; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const shippings = cpo.shipping || [];
  const hasShippings = shippings.length > 0;
  const percent = (cpo.qtyOrdered && cpo.qtyOrdered > 0)
    ? Math.round(((cpo.qtyReceived || 0) / cpo.qtyOrdered) * 100)
    : 0;

  const dominantStatus = getDominantStatus(shippings);
  const cfg = STATUS_CONFIG[dominantStatus] || STATUS_CONFIG.pending;
  const Icon = cfg.icon;

  return (
    <div className="group/cpo">
      {/* Main CPO gauge row */}
      <button
        onClick={(e) => { e.stopPropagation(); if (hasShippings) setExpanded(!expanded); }}
        className={`w-full text-left transition-colors rounded-md px-1 py-0.5 -mx-1 ${hasShippings ? "hover:bg-muted/40 cursor-pointer" : "cursor-default"}`}
      >
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground font-medium truncate max-w-[55%]">
            {/* Expand chevron */}
            {hasShippings ? (
              <span className={`transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}>
                <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
              </span>
            ) : (
              <Icon className="h-3 w-3 shrink-0" />
            )}
            <span className="truncate font-semibold text-foreground/80">{cpo.customerPONo || cpo.poNo || `CPO-${index + 1}`}</span>
            {hasShippings && (
              <span className={`text-[8px] font-black px-1 py-px rounded ${cfg.bg} ${cfg.color} tabular-nums`}>
                {shippings.length}
              </span>
            )}
          </span>
          <span className={`font-bold tabular-nums text-[11px] ${
            percent >= 100 ? "text-emerald-600 dark:text-emerald-400"
              : percent > 70 ? "text-blue-600 dark:text-blue-400"
              : percent > 0 ? "text-amber-600 dark:text-amber-400"
              : "text-muted-foreground"
          }`}>
            {percent}%
          </span>
        </div>
        <div className="h-1.5 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden shadow-inner mt-1">
          <div
            className={`h-full transition-all duration-1000 ease-out rounded-full ${
              percent >= 100 ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                : percent > 0 ? cfg.barColor
                : "bg-transparent"
            }`}
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        </div>
      </button>

      {/* Expanded: individual shippings */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          expanded ? "max-h-[500px] opacity-100 mt-1.5" : "max-h-0 opacity-0"
        }`}
      >
        <div className="ml-3 pl-2.5 border-l-2 border-primary/15 space-y-1">
          {shippings.map((ship, si) => (
            <ShippingDetailRow key={ship._id || si} ship={ship} index={si} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────── Shipping Card ────────────────────── */

function ShippingCard({
  po,
  users,
  onToggleNigalu,
  onToggleArchive,
  onUpdateField,
  onClick,
  userRole,
}: {
  po: PurchaseOrder;
  users: Record<string, string>;
  onToggleNigalu: (id: string, val: boolean) => void;
  onToggleArchive: (id: string, val: boolean) => void;
  onUpdateField: (id: string, field: string, value: string) => void;
  onClick: () => void;
  userRole: string;
}) {
  const [showAll, setShowAll] = useState(false);

  const overallStatus = getOverallCardStatus(po);
  const statusCfg = STATUS_CONFIG[overallStatus] || STATUS_CONFIG.pending;
  const totalCPOs = po.customerPO?.length || 0;
  const totalShippings = po.customerPO?.reduce((acc, cpo) => acc + (cpo.shipping?.length || 0), 0) || 0;

  // Overall completion
  let totalOrdered = 0;
  let totalReceived = 0;
  po.customerPO?.forEach((cpo: any) => {
    totalOrdered += Number(cpo.qtyOrdered) || 0;
    totalReceived += Number(cpo.qtyReceived) || 0;
  });
  const overallPercent = totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0;

  const VISIBLE_LIMIT = 4;
  const cpos = po.customerPO || [];
  const visibleCpos = showAll ? cpos : cpos.slice(0, VISIBLE_LIMIT);
  const hiddenCount = cpos.length - VISIBLE_LIMIT;

  return (
    <div
      className={`group relative overflow-hidden rounded-xl border transition-all duration-300
        hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-0.5
        bg-card text-card-foreground
        ${po.isArchived ? "opacity-60 border-amber-500/30" : "border-border hover:border-primary/30"}
      `}
    >
      {/* Hover gradient overlay */}
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-gradient-to-br ${statusCfg.bg} via-transparent to-transparent`} />

      {/* ─── Card Header ─── */}
      <div className="relative px-4 pt-4 pb-3 cursor-pointer" onClick={onClick}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${statusCfg.bg} border ${statusCfg.border} transition-transform duration-300 group-hover:scale-110`}>
              <Ship className={`h-4.5 w-4.5 ${statusCfg.color}`} />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight leading-none">{po.vbpoNo}</h3>
              <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                {po.date ? new Date(po.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
              </p>
            </div>
          </div>
          <StatusBadge status={overallStatus} />
        </div>
      </div>

      {/* ─── Meta row: Order Type & Category (inline editable) + counts ─── */}
      <div className="relative px-4 pb-2">
        <div className="flex items-center justify-between text-[10px]">
          <div className="flex items-center gap-1.5 flex-wrap">
            <InlineSelectChip
              value={po.orderType || "Export"}
              options={["Export", "Import", "Dropship", "Inventory"]}
              colorMap={ORDER_TYPE_COLORS}
              onSave={(val) => onUpdateField(po._id, "orderType", val)}
            />
            <InlineSelectChip
              value={po.category || "CONVENTIONAL"}
              options={["CONVENTIONAL", "ORGANIC"]}
              colorMap={CATEGORY_COLORS}
              onSave={(val) => onUpdateField(po._id, "category", val)}
            />
          </div>
          <div className="flex items-center gap-2.5 text-muted-foreground">
            <span className="flex items-center gap-0.5 font-semibold" title="Customer POs">
              <ShoppingCart className="h-3 w-3" />
              {totalCPOs}
            </span>
            <span className="flex items-center gap-0.5 font-semibold" title="Shippings">
              <Truck className="h-3 w-3" />
              {totalShippings}
            </span>
          </div>
        </div>
      </div>

      {/* ─── CPO rows (expandable gauge bars) ─── */}
      <div className="relative px-4 pb-1 space-y-1.5">
        {cpos.length > 0 ? (
          <>
            {visibleCpos.map((cpo, i) => (
              <ExpandableCPORow key={cpo._id || i} cpo={cpo} index={i} />
            ))}

            {/* Expand / Collapse toggle */}
            {hiddenCount > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowAll(!showAll); }}
                className="w-full text-center py-1.5 text-[10px] font-semibold text-primary/70 hover:text-primary transition-colors flex items-center justify-center gap-1 group/expand"
              >
                <ChevronDown className={`h-3 w-3 transition-transform duration-300 ${showAll ? "rotate-180" : ""}`} />
                {showAll ? "Show less" : `+${hiddenCount} more`}
              </button>
            )}
          </>
        ) : (
          <div className="text-[11px] text-muted-foreground text-center py-4 italic">
            No Customer POs yet
          </div>
        )}
      </div>

      {/* ─── Footer: Overall progress + toggles ─── */}
      <div className="relative border-t border-border/50 px-4 py-2.5 mt-1">
        <div className="flex items-center justify-between">
          {/* Overall completion */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
              <TrendingUp className="h-3 w-3" />
              <span className={`font-bold ${overallPercent >= 100 ? "text-emerald-600 dark:text-emerald-400" : overallPercent > 0 ? "text-foreground" : ""}`}>
                {overallPercent}%
              </span>
            </div>
            <div className="w-16 h-1 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  overallPercent >= 100 ? "bg-emerald-500"
                    : overallPercent > 50 ? "bg-blue-500"
                    : overallPercent > 0 ? "bg-amber-400"
                    : "bg-transparent"
                }`}
                style={{ width: `${Math.min(overallPercent, 100)}%` }}
              />
            </div>
          </div>

          {/* NIGALU & Archive toggles */}
          {userRole !== "NIGALU" && (
            <div className="flex items-center gap-3">
              <ToggleSwitch
                checked={!!po.isNigalu}
                onChange={() => onToggleNigalu(po._id, !po.isNigalu)}
                label="NIGALU"
                activeColor="bg-fuchsia-500"
              />
              <ToggleSwitch
                checked={!!po.isArchived}
                onChange={() => onToggleArchive(po._id, !po.isArchived)}
                label="Archive"
                activeColor="bg-amber-500"
              />
            </div>
          )}
        </div>
      </div>

      {/* Created by */}
      <div className="relative px-4 pb-3">
        <p className="text-[9px] text-muted-foreground/60 font-medium">
          Created by {users[po.createdBy?.toLowerCase()] || po.createdBy || "—"}
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────── Status Summary Pills ─────────────────────── */

function StatusSummaryPills({
  data,
  activeFilter,
  onFilterChange,
}: {
  data: PurchaseOrder[];
  activeFilter: string;
  onFilterChange: (f: string) => void;
}) {
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: 0, delivered: 0, "in transit": 0, planned: 0, ordered: 0, pending: 0 };
    data.forEach((po) => {
      c.all++;
      const status = getOverallCardStatus(po);
      if (status in c) c[status]++;
    });
    return c;
  }, [data]);

  const pills = [
    { key: "all", label: "All", activeBg: "bg-primary/10 border-primary text-primary" },
    { key: "delivered", label: "Delivered", activeBg: "bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400" },
    { key: "in transit", label: "In Transit", activeBg: "bg-blue-500/10 border-blue-500 text-blue-600 dark:text-blue-400" },
    { key: "planned", label: "Planned", activeBg: "bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-400" },
    { key: "ordered", label: "Ordered", activeBg: "bg-violet-500/10 border-violet-500 text-violet-600 dark:text-violet-400" },
    { key: "pending", label: "Pending", activeBg: "bg-zinc-500/10 border-zinc-500 text-zinc-500 dark:text-zinc-400" },
  ];

  return (
    <div className="flex flex-wrap gap-1.5 mb-4">
      {pills.map((p) => {
        const isActive = activeFilter === p.key;
        const count = counts[p.key] || 0;
        return (
          <button
            key={p.key}
            onClick={() => onFilterChange(p.key)}
            className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all duration-200 ${
              isActive ? `${p.activeBg} shadow-sm` : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
            }`}
          >
            {p.label} ({count})
          </button>
        );
      })}
    </div>
  );
}

/* ─────────────────────── Main Page ─────────────────────── */

export default function ShippingsPage() {
  const router = useRouter();
  const { purchaseOrders, users: rawUsers, customers: rawCustomers, isLoading, refetchPurchaseOrders } = useUserDataStore();
  const { setActions, setLeftContent } = useHeaderActions();

  const [userRole, setUserRole] = useState<string>("");
  useEffect(() => {
    fetch("/api/user/permissions")
      .then((r) => r.json())
      .then((d) => setUserRole(d.role || ""))
      .catch(() => {});
  }, []);

  const data = useMemo(() => {
    return [...purchaseOrders].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [purchaseOrders]);

  const users = useMemo(() => {
    const mapping: Record<string, string> = {};
    if (Array.isArray(rawUsers)) {
      rawUsers.forEach((u: any) => { if (u.email) mapping[u.email.toLowerCase()] = u.name; });
    }
    return mapping;
  }, [rawUsers]);

  // Filters
  const [filterOrderType, setFilterOrderType] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterShipStatus, setFilterShipStatus] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showArchived, setShowArchived] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const orderTypes = useMemo(() => [...new Set(data.map((d) => d.orderType).filter(Boolean))].sort(), [data]);
  const categories = useMemo(() => [...new Set(data.map((d) => d.category).filter(Boolean))].sort(), [data]);

  const filteredData = useMemo(() => {
    return data.filter((po) => {
      if (userRole === "NIGALU" && !po.isNigalu) return false;
      if (!showArchived && po.isArchived) return false;
      if (showArchived && !po.isArchived) return false;
      if (filterOrderType && po.orderType !== filterOrderType) return false;
      if (filterCategory && po.category !== filterCategory) return false;
      if (filterShipStatus) {
        const hasStatus = po.customerPO?.some((cpo: any) =>
          cpo.shipping?.some((ship: any) => normalizeStatus(ship.status || "") === filterShipStatus)
        );
        if (!hasStatus) return false;
      }
      if (statusFilter !== "all") {
        if (getOverallCardStatus(po) !== statusFilter) return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const createdByName = users[po.createdBy?.toLowerCase()] || po.createdBy || "";
        // Also search in customerPONo and shipping svbid
        const cpoSearchable = po.customerPO?.map((cpo: any) => [
          cpo.customerPONo, cpo.poNo,
          ...(cpo.shipping || []).map((s: any) => [s.svbid, s.spoNo, s.carrier, s.containerNo].join(" ")),
        ].join(" ")).join(" ") || "";
        const searchable = [po.vbpoNo, po.orderType, po.category, po.date, po.createdBy, createdByName, cpoSearchable].filter(Boolean).join(" ").toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      return true;
    });
  }, [data, userRole, showArchived, filterOrderType, filterCategory, filterShipStatus, statusFilter, searchQuery, users]);

  const hasActiveFilters = filterOrderType || filterCategory || filterShipStatus;
  const archivedCount = data.filter((po) => po.isArchived).length;

  // ── Mutation handlers ──

  const toggleArchive = useCallback(async (poId: string, archive: boolean) => {
    try {
      const res = await fetch(`/api/admin/purchase-orders/${poId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: archive }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(archive ? "Purchase Order archived" : "Purchase Order restored");
      refetchPurchaseOrders();
    } catch { toast.error("Failed to update archive status"); }
  }, [refetchPurchaseOrders]);

  const toggleNigalu = useCallback(async (poId: string, nigalu: boolean) => {
    try {
      const res = await fetch(`/api/admin/purchase-orders/${poId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isNigalu: nigalu }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(nigalu ? "Marked as NIGALU" : "Removed NIGALU flag");
      refetchPurchaseOrders();
    } catch { toast.error("Failed to update NIGALU status"); }
  }, [refetchPurchaseOrders]);

  const updateFieldInline = useCallback(async (poId: string, field: string, value: string) => {
    try {
      const res = await fetch(`/api/admin/purchase-orders/${poId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) throw new Error("Failed");
      refetchPurchaseOrders();
      toast.success(`Updated ${field}`);
    } catch { toast.error(`Failed to update ${field}`); }
  }, [refetchPurchaseOrders]);

  // ── Header filters (same as purchase-orders) ──

  useLayoutEffect(() => {
    const headerContent = (
      <div className="flex items-center gap-1.5">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 w-[160px] rounded-md border border-input bg-background pl-8 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        <select
          value={filterOrderType}
          onChange={(e) => setFilterOrderType(e.target.value)}
          className={`h-8 rounded-md border px-2 text-xs bg-background transition-colors ${filterOrderType ? "border-primary text-primary font-medium" : "border-input text-muted-foreground"}`}
        >
          <option value="">All Types</option>
          {orderTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className={`h-8 rounded-md border px-2 text-xs bg-background transition-colors ${filterCategory ? "border-primary text-primary font-medium" : "border-input text-muted-foreground"}`}
        >
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={filterShipStatus}
          onChange={(e) => setFilterShipStatus(e.target.value)}
          className={`h-8 rounded-md border px-2 text-xs bg-background transition-colors ${filterShipStatus ? "border-primary text-primary font-medium" : "border-input text-muted-foreground"}`}
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="ordered">Ordered</option>
          <option value="planned">Planned</option>
          <option value="in transit">In Transit</option>
          <option value="delivered">Delivered</option>
        </select>
        {hasActiveFilters && (
          <button onClick={() => { setFilterOrderType(""); setFilterCategory(""); setFilterShipStatus(""); }}
            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
            <X className="h-3 w-3" /> Clear
          </button>
        )}
        <div className="h-5 w-px bg-border mx-1" />
        <button
          onClick={() => setShowArchived(!showArchived)}
          className={`h-8 px-2.5 rounded-md border text-xs font-medium flex items-center gap-1.5 transition-colors ${
            showArchived ? "border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400" : "border-input text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <Archive className="h-3.5 w-3.5" />
          Archived{archivedCount > 0 ? ` (${archivedCount})` : ""}
        </button>
      </div>
    );

    setActions(headerContent);
    setLeftContent(
      <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Shippings</h1>
    );

    const timer = setTimeout(() => {
      setActions(headerContent);
      setLeftContent(
        <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Shippings</h1>
      );
    }, 50);

    return () => { clearTimeout(timer); setActions(null); setLeftContent(null); };
  }, [setActions, setLeftContent, searchQuery, filterOrderType, filterCategory, filterShipStatus, showArchived, orderTypes, categories, archivedCount, hasActiveFilters]);

  if (isLoading) return <TablePageSkeleton />;

  return (
    <div className="w-full h-full overflow-auto">
      {/* Status Filter Pills */}
      <StatusSummaryPills
        data={data.filter((po) => {
          if (userRole === "NIGALU" && !po.isNigalu) return false;
          if (!showArchived && po.isArchived) return false;
          if (showArchived && !po.isArchived) return false;
          return true;
        })}
        activeFilter={statusFilter}
        onFilterChange={setStatusFilter}
      />

      {/* Cards Grid */}
      {filteredData.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50 mb-4">
            <Ship className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold text-muted-foreground">No shipments found</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Try adjusting your filters or search criteria</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filteredData.map((po) => (
            <ShippingCard
              key={po._id}
              po={po}
              users={users}
              onToggleNigalu={toggleNigalu}
              onToggleArchive={toggleArchive}
              onUpdateField={updateFieldInline}
              onClick={() => router.push(`/admin/purchase-orders/${po._id}`)}
              userRole={userRole}
            />
          ))}
        </div>
      )}

      {/* Footer count */}
      <div className="flex items-center justify-end py-3 px-1">
        <div className="text-[11px] text-muted-foreground font-medium">
          {filteredData.length} shipment{filteredData.length !== 1 ? "s" : ""}
        </div>
      </div>
    </div>
  );
}
