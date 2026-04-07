"use client";

import { useEffect, useState, useMemo, useLayoutEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUserDataStore } from "@/store/useUserDataStore";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import TimelineModal from "@/components/admin/timeline-modal";
import { AttachmentsModal } from "@/components/attachments-modal";
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
  Pencil,
  Trash2,
  Box,
  FileText,
  User2,
  Boxes,
  Eye,
  Paperclip,
  Mail,
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

/* ── Individual Shipping Row (expandable detail card) ──── */

function ShippingDetailRow({
  ship,
  index,
  parentPoNo,
  customerName,
  productMap,
  supplierMap,
  supplierLocationMap,
}: {
  ship: Shipping;
  index: number;
  parentPoNo?: string;
  customerName?: string;
  productMap: Record<string, string>;
  supplierMap: Record<string, string>;
  supplierLocationMap: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const status = normalizeStatus(ship.status || "");
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;

  const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;
  const eta = fmtDate(ship.ETA);
  const updatedETA = fmtDate(ship.updatedETA);

  // Resolve products
  const productIds: string[] = Array.isArray(ship.products) ? ship.products
    : typeof ship.products === "string" ? ship.products.split(",").filter(Boolean)
    : ship.product ? [ship.product] : [];
  const productNames = productIds.map((id) => productMap[id] || id).filter(Boolean);

  // Resolve supplier name & location
  const supplierName = ship.supplier ? (supplierMap[ship.supplier] || ship.supplier) : null;
  const supplierLocName = ship.supplierLocation ? (supplierLocationMap[ship.supplierLocation] || ship.supplierLocation) : null;

  // Detail items to render in the grid
  const details = [
    { icon: Box, label: "Container", value: ship.containerNo },
    { icon: Hash, label: "BOL Number", value: ship.BOLNumber },
    { icon: Truck, label: "Carrier", value: ship.carrier },
    { icon: MapPin, label: "Supplier", value: [supplierName, supplierLocName].filter(Boolean).join(" · ") || null },
    { icon: User2, label: "Customer", value: customerName || null },
    { icon: Boxes, label: "Products", value: productNames.length > 0 ? productNames.join(", ") : null },
    { icon: Calendar, label: "ETA", value: eta },
    { icon: Calendar, label: "Updated ETA", value: updatedETA, highlight: true },
    { icon: Ship, label: "Vessel / Trip", value: ship.vessellTrip },
    { icon: Anchor, label: "Port of Lading", value: ship.portOfLading },
    { icon: MapPin, label: "Port of Entry", value: ship.portOfEntryShipTo },
    { icon: FileText, label: "Carrier Booking", value: ship.carrierBookingRef },
  ].filter((d) => d.value);

  return (
    <div className="rounded-lg overflow-hidden">
      {/* Compact header row — always visible */}
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="w-full flex items-center gap-2 py-1.5 px-2 rounded-lg bg-muted/30 hover:bg-muted/60 transition-colors text-left"
      >
        {/* Index dot */}
        <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-black shrink-0 ${cfg.bg} ${cfg.color}`}>
          {index + 1}
        </span>

        {/* SVBID only */}
        <span className="text-[10px] font-semibold text-foreground truncate min-w-0 max-w-[100px]" title={ship.svbid || ship.spoNo || ""}>
          {ship.svbid || ship.spoNo || `S-${index + 1}`}
        </span>

        {/* Status pill */}
        <MiniStatusDot status={status} />

        {/* Updated ETA or ETA — pushed to right */}
        <span className="text-[9px] text-muted-foreground ml-auto whitespace-nowrap flex items-center gap-0.5">
          {updatedETA ? (
            <><Calendar className="h-2.5 w-2.5 text-amber-500" /><span className="text-amber-600 dark:text-amber-400 font-semibold">{updatedETA}</span></>
          ) : eta ? (
            <><Calendar className="h-2.5 w-2.5" />{eta}</>
          ) : null}
        </span>

        {/* Expand indicator */}
        <ChevronDown className={`h-2.5 w-2.5 text-muted-foreground/40 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Expanded detail grid */}
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${open ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"}`}>
        {details.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 px-3 py-2 ml-6 bg-muted/20 rounded-b-lg border-t border-border/30">
            {details.map((d, i) => {
              const Icon = d.icon;
              return (
                <div key={i} className="flex items-start gap-1.5 min-w-0">
                  <Icon className={`h-3 w-3 mt-px shrink-0 ${d.highlight ? "text-amber-500" : "text-muted-foreground/50"}`} />
                  <div className="min-w-0">
                    <p className="text-[8px] uppercase tracking-wider text-muted-foreground/60 font-semibold leading-none">{d.label}</p>
                    <p className={`text-[10px] font-medium truncate leading-tight mt-px ${d.highlight ? "text-amber-600 dark:text-amber-400 font-bold" : "text-foreground/80"}`} title={String(d.value)}>
                      {d.value}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="px-3 py-2 ml-6 bg-muted/20 rounded-b-lg border-t border-border/30">
            <p className="text-[9px] text-muted-foreground/50 italic">No additional details</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── CPO Gauge Bar (expandable to show shippings) ──── */

function ExpandableCPORow({
  cpo,
  index,
  customerMap,
  productMap,
  supplierMap,
  supplierLocationMap,
}: {
  cpo: CustomerPO;
  index: number;
  customerMap: Record<string, string>;
  productMap: Record<string, string>;
  supplierMap: Record<string, string>;
  supplierLocationMap: Record<string, string>;
}) {
  const [expanded, setExpanded] = useState(false);
  const shippings = cpo.shipping || [];
  const hasShippings = shippings.length > 0;
  const percent = (cpo.qtyOrdered && cpo.qtyOrdered > 0)
    ? Math.round(((cpo.qtyReceived || 0) / cpo.qtyOrdered) * 100)
    : 0;

  const dominantStatus = getDominantStatus(shippings);
  const cfg = STATUS_CONFIG[dominantStatus] || STATUS_CONFIG.pending;
  const Icon = cfg.icon;

  const custName = cpo.customer ? (customerMap[cpo.customer] || cpo.customer) : undefined;

  return (
    <div className="group/cpo">
      {/* Main CPO gauge row */}
      <button
        onClick={(e) => { e.stopPropagation(); if (hasShippings) setExpanded(!expanded); }}
        className={`w-full text-left transition-colors rounded-md px-1 py-0.5 -mx-1 ${hasShippings ? "hover:bg-muted/40 cursor-pointer" : "cursor-default"}`}
      >
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground font-medium truncate max-w-[55%]">
            {hasShippings ? (
              <span className={`transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}>
                <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
              </span>
            ) : (
              <Icon className="h-3 w-3 shrink-0" />
            )}
            <span className="truncate font-semibold text-foreground/80">{cpo.customerPONo || cpo.poNo || `CPO-${index + 1}`}</span>
            {cpo.poNo && cpo.customerPONo && cpo.poNo !== cpo.customerPONo && (
              <span className="text-[9px] text-muted-foreground/50 truncate" title={cpo.poNo}>· {cpo.poNo}</span>
            )}
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
          expanded ? "max-h-[2000px] opacity-100 mt-1.5" : "max-h-0 opacity-0"
        }`}
      >
        <div className="ml-3 pl-2.5 border-l-2 border-primary/15 space-y-1">
          {shippings.map((ship, si) => (
            <ShippingDetailRow
              key={ship._id || si}
              ship={ship}
              index={si}
              parentPoNo={cpo.poNo}
              customerName={custName}
              productMap={productMap}
              supplierMap={supplierMap}
              supplierLocationMap={supplierLocationMap}
            />
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
  customerMap,
  productMap,
  supplierMap,
  supplierLocationMap,
  onToggleNigalu,
  onToggleArchive,
  onUpdateField,
  onDelete,
  onEdit,
  onViewDetails,
  onOpenTimeline,
  onOpenAttachments,
  onOpenEmails,
  userRole,
}: {
  po: PurchaseOrder;
  users: Record<string, string>;
  customerMap: Record<string, string>;
  productMap: Record<string, string>;
  supplierMap: Record<string, string>;
  supplierLocationMap: Record<string, string>;
  onToggleNigalu: (id: string, val: boolean) => void;
  onToggleArchive: (id: string, val: boolean) => void;
  onUpdateField: (id: string, field: string, value: string) => void;
  onDelete: (id: string) => void;
  onEdit: (po: PurchaseOrder) => void;
  onViewDetails: () => void;
  onOpenTimeline: (vbpoNo: string) => void;
  onOpenAttachments: (vbpoNo: string) => void;
  onOpenEmails: (vbpoNo: string) => void;
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
      <div className="relative px-4 pt-4 pb-3 cursor-pointer" onClick={(e) => { e.stopPropagation(); onViewDetails(); }}>
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
              <ExpandableCPORow
                key={cpo._id || i}
                cpo={cpo}
                index={i}
                customerMap={customerMap}
                productMap={productMap}
                supplierMap={supplierMap}
                supplierLocationMap={supplierLocationMap}
              />
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

      {/* Created by + action buttons */}
      <div className="relative px-4 pb-3">
        <div className="flex items-center justify-between">
          <p className="text-[9px] text-muted-foreground/60 font-medium truncate max-w-[45%]">
            Created by {users[po.createdBy?.toLowerCase()] || po.createdBy || "—"}
          </p>
          {userRole !== "NIGALU" && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <button
                onClick={(e) => { e.stopPropagation(); onViewDetails(); }}
                title="View Details"
                className="p-1 rounded-md text-muted-foreground hover:text-sky-500 hover:bg-sky-500/10 transition-colors"
              >
                <Eye className="h-3 w-3" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(po); }}
                title="Edit Purchase Order"
                className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              >
                <Pencil className="h-3 w-3" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onOpenTimeline(po.vbpoNo); }}
                title="Timeline"
                className="p-1 rounded-md text-muted-foreground hover:text-violet-500 hover:bg-violet-500/10 transition-colors"
              >
                <Clock className="h-3 w-3" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onOpenAttachments(po.vbpoNo); }}
                title="Attachments"
                className="p-1 rounded-md text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 transition-colors"
              >
                <Paperclip className="h-3 w-3" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onOpenEmails(po.vbpoNo); }}
                title="Emails"
                className="p-1 rounded-md text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 transition-colors"
              >
                <Mail className="h-3 w-3" />
              </button>
              {(po.customerPO?.length || 0) === 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(po._id); }}
                  title="Delete Purchase Order"
                  className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
        </div>
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
  const {
    purchaseOrders,
    users: rawUsers,
    customers: rawCustomers,
    products: rawProducts,
    suppliers: rawSuppliers,
    isLoading,
    refetchPurchaseOrders,
  } = useUserDataStore();
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

  // Build lookup maps for products, suppliers, customers
  const customerMap = useMemo(() => {
    const m: Record<string, string> = {};
    if (Array.isArray(rawCustomers)) {
      rawCustomers.forEach((c: any) => {
        if (c.vbId) m[c.vbId] = c.name;
        if (c._id) m[c._id] = c.name;
      });
    }
    return m;
  }, [rawCustomers]);

  const productMap = useMemo(() => {
    const m: Record<string, string> = {};
    if (Array.isArray(rawProducts)) {
      rawProducts.forEach((p: any) => {
        if (p._id) m[p._id] = p.name;
        if (p.vbId) m[p.vbId] = p.name;
      });
    }
    return m;
  }, [rawProducts]);

  const { supplierMap, supplierLocationMap } = useMemo(() => {
    const sm: Record<string, string> = {};
    const slm: Record<string, string> = {};
    if (Array.isArray(rawSuppliers)) {
      rawSuppliers.forEach((s: any) => {
        if (s._id) sm[s._id] = s.name;
        if (s.vbId) sm[s.vbId] = s.name;
        if (s.location && Array.isArray(s.location)) {
          s.location.forEach((loc: any) => {
            if (loc.vbId) {
              slm[loc.vbId] = loc.locationName || `${s.name} - ${loc.city}` || loc.vbId;
            }
          });
        }
      });
    }
    return { supplierMap: sm, supplierLocationMap: slm };
  }, [rawSuppliers]);

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

  // ── Edit dialog state ──
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPO, setEditingPO] = useState<PurchaseOrder | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<PurchaseOrder>>({});

  const openEditDialog = useCallback((po: PurchaseOrder) => {
    setEditingPO(po);
    setEditFormData({
      vbpoNo: po.vbpoNo,
      orderType: po.orderType,
      category: po.category,
      date: po.date ? po.date.split("T")[0] : "",
    });
    setEditDialogOpen(true);
  }, []);

  const handleEditSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPO) return;
    try {
      const res = await fetch(`/api/admin/purchase-orders/${editingPO._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editFormData),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Purchase Order updated");
      setEditDialogOpen(false);
      refetchPurchaseOrders();
    } catch {
      toast.error("Failed to update purchase order");
    }
  }, [editingPO, editFormData, refetchPurchaseOrders]);

  // ── Timeline & Attachments modal state ──
  const [timelineOpen, setTimelineOpen] = useState<{ vbpoNo?: string; title?: string } | null>(null);
  const [attachmentsOpen, setAttachmentsOpen] = useState<{ poNumber: string; defaultTab?: "internal" | "external" | "emails" } | null>(null);

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

  const handleDelete = useCallback(async (poId: string) => {
    if (!confirm("Are you sure you want to delete this purchase order?")) return;
    try {
      const res = await fetch(`/api/admin/purchase-orders/${poId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Purchase Order deleted");
      refetchPurchaseOrders();
    } catch {
      toast.error("Failed to delete purchase order");
    }
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
              customerMap={customerMap}
              productMap={productMap}
              supplierMap={supplierMap}
              supplierLocationMap={supplierLocationMap}
              onToggleNigalu={toggleNigalu}
              onToggleArchive={toggleArchive}
              onUpdateField={updateFieldInline}
              onDelete={handleDelete}
              onEdit={openEditDialog}
              onViewDetails={() => router.push(`/admin/purchase-orders/${po._id}`)}
              onOpenTimeline={(vbpoNo) => setTimelineOpen({ vbpoNo, title: `Timeline — ${vbpoNo}` })}
              onOpenAttachments={(vbpoNo) => setAttachmentsOpen({ poNumber: vbpoNo })}
              onOpenEmails={(vbpoNo) => setAttachmentsOpen({ poNumber: vbpoNo, defaultTab: "emails" })}
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

      {/* ─── Edit Dialog ─── */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Purchase Order</DialogTitle>
            <DialogDescription>Update the PO details below.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="grid gap-5 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-vbpoNo">VB PO #</Label>
                <div className="relative">
                  <ShoppingCart className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="edit-vbpoNo"
                    className="pl-9"
                    value={editFormData.vbpoNo || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, vbpoNo: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-date">Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="edit-date"
                    type="date"
                    className="pl-9"
                    value={editFormData.date || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                    required
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-orderType">Order Type</Label>
                <select
                  id="edit-orderType"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={editFormData.orderType || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, orderType: e.target.value })}
                  required
                >
                  <option value="" disabled>Select type...</option>
                  <option value="Export">Export</option>
                  <option value="Import">Import</option>
                  <option value="Dropship">Dropship</option>
                  <option value="Inventory">Inventory</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-category">Category</Label>
                <select
                  id="edit-category"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={editFormData.category || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                  required
                >
                  <option value="" disabled>Select category...</option>
                  <option value="CONVENTIONAL">Conventional</option>
                  <option value="ORGANIC">Organic</option>
                </select>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:space-x-0">
              <Button variant="outline" type="button" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Timeline Modal ─── */}
      <TimelineModal
        open={!!timelineOpen}
        onClose={() => setTimelineOpen(null)}
        vbpoNo={timelineOpen?.vbpoNo}
        title={timelineOpen?.title}
        users={users}
      />

      {/* ─── Attachments / Emails Modal ─── */}
      <AttachmentsModal
        open={!!attachmentsOpen}
        onClose={() => setAttachmentsOpen(null)}
        poNumber={attachmentsOpen?.poNumber || ""}
        defaultTab={attachmentsOpen?.defaultTab || "internal"}
      />
    </div>
  );
}
