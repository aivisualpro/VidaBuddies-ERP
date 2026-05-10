"use client";

import { useEffect, useState, useMemo, useLayoutEffect } from "react";
import { useRouter } from "next/navigation";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Search,
  Ship,
  Pencil,
  Trash2,
  Truck,
  MapPin,
  Calendar,
  Box,
  Anchor,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  Package,
} from "lucide-react";
import { TablePageSkeleton } from "@/components/skeletons";
import { ViewToggle } from "@/components/admin/view-toggle";
import { AddShippingDialog } from "@/components/admin/add-shipping-dialog";
import { ShipmentGroupSidebar } from "@/components/admin/shipment-group-sidebar";
import { ShipmentTrackingPanel } from "@/components/admin/shipment-tracking-panel";
import { ShipmentDetailPanel } from "@/components/admin/shipment-detail-panel";
import { AttachmentsModal } from "@/components/attachments-modal";
import TimelineModal from "@/components/admin/timeline-modal";
import { useUserDataStore } from "@/store/useUserDataStore";

interface ShipmentRecord {
  _id: string;
  customerPOId?: string;
  poNo?: string;
  spoNo?: string;
  svbid?: string;
  VBNumber?: string;
  VBSerialNumber?: string;
  VBShipmentNumber?: string;
  supplier?: string;
  supplierLocation?: string;
  carrier?: string;
  containerNo?: string;
  BOLNumber?: string;
  vessellTrip?: string;
  portOfLading?: string;
  portOfEntryShipTo?: string;
  ETA?: string;
  updatedETA?: string;
  status?: string;
  drums?: number;
  pallets?: number;
  gallons?: number;
  quickNote?: string;
  shippingTrackingRecords?: any[];
  createdAt?: string;
}

function normalizeStatus(raw: string): string {
  if (!raw) return 'pending';
  const s = raw.toLowerCase().trim();
  if (s === 'delivered' || s === 'arrived') return 'delivered';
  if (s === 'in transit' || s === 'in_transit' || s === 'on water') return 'in transit';
  if (s === 'planned' || s === 'booking confirmed') return 'planned';
  if (s === 'ordered') return 'ordered';
  return 'pending';
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; dotColor: string; icon: any }> = {
  delivered: { label: "Delivered", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", dotColor: "bg-emerald-500", icon: CheckCircle2 },
  "in transit": { label: "In Transit", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30", dotColor: "bg-blue-500", icon: Ship },
  planned: { label: "Planned", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", dotColor: "bg-amber-500", icon: Clock },
  ordered: { label: "Ordered", color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/30", dotColor: "bg-violet-500", icon: Package },
  pending: { label: "Pending", color: "text-zinc-500 dark:text-zinc-400", bg: "bg-zinc-500/10", border: "border-zinc-500/30", dotColor: "bg-zinc-400", icon: AlertCircle },
};

export default function ShipmentsCardPage() {
  const router = useRouter();
  const { setActions, setLeftContent } = useHeaderActions();
  const [data, setData] = useState<ShipmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ShipmentRecord | null>(null);
  const [sidebarVBNumber, setSidebarVBNumber] = useState<string | null>(null);
  const [sidebarVBSerial, setSidebarVBSerial] = useState<string | null>(null);
  const [trackingContainer, setTrackingContainer] = useState<string | null>(null);
  const [trackingRawJson, setTrackingRawJson] = useState<any>(null);

  const openTracking = (item: ShipmentRecord) => {
    const cn = item.containerNo;
    if (!cn) { toast.error('No container number on this shipment'); return; }
    const records = item.shippingTrackingRecords || [];
    const latest = records[records.length - 1];
    const rawStr = latest?.raw_json;
    if (rawStr) {
      try { setTrackingRawJson(JSON.parse(rawStr)); } catch { setTrackingRawJson(null); }
    } else {
      setTrackingRawJson(null);
    }
    setTrackingContainer(cn);
  };

  const [detailShipment, setDetailShipment] = useState<ShipmentRecord | null>(null);
  const [attachmentsOpen, setAttachmentsOpen] = useState<{ poNumber: string; spoNumber?: string; shipNumber?: string } | null>(null);
  const [timelineOpen, setTimelineOpen] = useState<{ VBNumber?: string; VBSerialNumber?: string; VBShipmentNumber?: string; title?: string } | null>(null);

  const { purchaseOrders } = useUserDataStore();

  // Build lookup maps to resolve ObjectIDs → display names
  const poLookup = useMemo(() => {
    const map: Record<string, string> = {};
    (purchaseOrders || []).forEach((po: any) => {
      if (po._id) map[po._id] = po.vbpoNo || po.VBNumber || po._id;
    });
    return map;
  }, [purchaseOrders]);

  // CPO lookup — must come from the standalone VBcustomerPO collection
  // (the embedded sub-doc _ids in VidaPO don't match VBcustomerPO _ids)
  const [cpoLookup, setCpoLookup] = useState<Record<string, string>>({});
  useEffect(() => {
    fetch('/api/admin/vb-customer-po?fields=_id,VBSerialNumber,poNo')
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

  const resolveShipNames = (ship: any) => {
    const vbNum = ship.VBNumber || '';
    const vbSer = ship.VBSerialNumber || ship.poNo || '';
    const vbShip = ship.VBShipmentNumber || ship.svbid || '';
    return {
      poNumber: poLookup[vbNum] || vbNum,
      spoNumber: cpoLookup[vbSer] || vbSer || undefined,
      shipNumber: vbShip || undefined,
    };
  };

  const fetchData = async () => {
    try {
      const res = await fetch("/api/admin/vb-shipping");
      const items = await res.json();
      setData(Array.isArray(items) ? items : []);
    } catch {
      toast.error("Failed to fetch Shipments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this Shipment?")) return;
    try {
      const res = await fetch(`/api/admin/vb-shipping/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Shipment deleted");
      fetchData();
    } catch {
      toast.error("Failed to delete");
    }
  };

  const openAdd = () => { setEditingItem(null); setIsDialogOpen(true); };
  const openEdit = (item: ShipmentRecord) => {
    setEditingItem(item);
    setIsDialogOpen(true);
  };

  // Status counts
  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { all: 0, delivered: 0, 'in transit': 0, planned: 0, ordered: 0, pending: 0 };
    data.forEach(item => { c.all++; const s = normalizeStatus(item.status || ''); if (s in c) c[s]++; });
    return c;
  }, [data]);

  const filteredData = useMemo(() => {
    let result = data;
    // Sidebar group filter
    if (sidebarVBNumber) {
      result = result.filter(item => (item.VBNumber || 'Unlinked') === sidebarVBNumber);
      if (sidebarVBSerial) {
        result = result.filter(item => (item.VBSerialNumber || 'none') === sidebarVBSerial);
      }
    }
    if (statusFilter !== "all") {
      result = result.filter(item => normalizeStatus(item.status || '') === statusFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(item => {
        const searchable = [item.VBNumber, item.VBSerialNumber, item.VBShipmentNumber, item.supplier, item.carrier, item.containerNo].filter(Boolean).join(' ').toLowerCase();
        return searchable.includes(q);
      });
    }
    return result;
  }, [data, searchQuery, statusFilter, sidebarVBNumber, sidebarVBSerial]);

  // Header
  useLayoutEffect(() => {
    const headerContent = (
      <div className="flex items-center gap-2">
        <ViewToggle currentView="card" basePath="/admin/shipments" />
        <div className="h-5 w-px bg-border mx-1" />
        <div className="relative">
          <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 w-[180px] rounded-md border border-input bg-background pl-8 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        <Button onClick={openAdd} size="sm" className="h-8">
          <Plus className="mr-2 h-4 w-4" /> Add New
        </Button>
      </div>
    );
    setActions(headerContent);
    const timer = setTimeout(() => setActions(headerContent), 50);
    return () => { clearTimeout(timer); setActions(null); setLeftContent(null); };
  }, [setActions, setLeftContent, searchQuery]);

  if (loading) return <TablePageSkeleton />;

  // Status filter pills
  const statusPills = [
    { key: "all", label: "All" },
    { key: "delivered", label: "Delivered" },
    { key: "in transit", label: "In Transit" },
    { key: "planned", label: "Planned" },
    { key: "ordered", label: "Ordered" },
    { key: "pending", label: "Pending" },
  ];

  return (
    <div className="w-full h-full flex">
      <ShipmentGroupSidebar
        data={data}
        activeVBNumber={sidebarVBNumber}
        activeVBSerial={sidebarVBSerial}
        onSelect={(vb, ser) => { setSidebarVBNumber(vb); setSidebarVBSerial(ser); }}
      />
      <div className="flex-1 min-w-0 overflow-auto p-4">
      {/* Status pills */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {statusPills.map(p => {
          const isActive = statusFilter === p.key;
          const cfg = STATUS_CONFIG[p.key] || {};
          const count = statusCounts[p.key] || 0;
          return (
            <button
              key={p.key}
              onClick={() => setStatusFilter(p.key)}
              className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all duration-200 ${
                isActive
                  ? `${cfg.bg || 'bg-primary/10'} ${cfg.color || 'text-primary'} ${cfg.border || 'border-primary'} shadow-sm`
                  : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
              }`}
            >
              {p.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredData.map((item) => {
          const norm = normalizeStatus(item.status || '');
          const cfg = STATUS_CONFIG[norm] || STATUS_CONFIG.pending;
          const StatusIcon = cfg.icon;
          const eta = formatDate(item.ETA);
          const updatedEta = formatDate(item.updatedETA);

          return (
            <div
              key={item._id}
              className="group relative overflow-hidden rounded-xl border border-border bg-card text-card-foreground transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-0.5 hover:border-primary/30"
            >
              <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-gradient-to-br ${cfg.bg} via-transparent to-transparent`} />

              {/* Header */}
              <div className="relative px-4 pt-4 pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${cfg.bg} border ${cfg.border} transition-transform duration-300 group-hover:scale-110`}>
                      <StatusIcon className={`h-4.5 w-4.5 ${cfg.color}`} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold tracking-tight leading-none">
                        <button
                          onClick={(e) => { e.stopPropagation(); setDetailShipment(item); }}
                          className="text-primary hover:text-primary/80 underline underline-offset-2 decoration-primary/30 hover:decoration-primary transition-colors"
                        >
                          {item.VBShipmentNumber || item.svbid || item.spoNo || "—"}
                        </button>
                      </h3>
                      <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{item.poNo || "—"}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                    <span className="relative flex h-1.5 w-1.5">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${cfg.dotColor}`} />
                      <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${cfg.dotColor}`} />
                    </span>
                    {cfg.label}
                  </span>
                </div>
              </div>

              {/* Details */}
              <div className="relative px-4 pb-2 space-y-1.5">
                {item.supplier && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Package className="h-3 w-3" />
                    <span className="truncate font-medium">{item.supplier}</span>
                  </div>
                )}
                {item.carrier && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Truck className="h-3 w-3" />
                    <span className="truncate">{item.carrier}</span>
                  </div>
                )}
                {item.containerNo && (
                  <button
                    onClick={(e) => { e.stopPropagation(); openTracking(item); }}
                    className="flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-400 transition-colors"
                  >
                    <Box className="h-3 w-3" />
                    <span className="font-mono font-bold underline underline-offset-2 decoration-blue-500/30">{item.containerNo}</span>
                  </button>
                )}
                {(item.portOfLading || item.portOfEntryShipTo) && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Anchor className="h-3 w-3" />
                    <span className="truncate">{[item.portOfLading, item.portOfEntryShipTo].filter(Boolean).join(" → ")}</span>
                  </div>
                )}
                {(eta || updatedEta) && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {updatedEta ? (
                      <>
                        <span className="line-through text-[10px]">{eta}</span>
                        <span className="text-amber-600 dark:text-amber-400 font-semibold">{updatedEta}</span>
                      </>
                    ) : (
                      <span>{eta}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Quantities */}
              {(item.drums || item.pallets || item.gallons) && (
                <div className="relative border-t border-border/50 px-4 py-2">
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    {item.drums ? <span><strong className="text-foreground">{item.drums}</strong> drums</span> : null}
                    {item.pallets ? <span><strong className="text-foreground">{item.pallets}</strong> pallets</span> : null}
                    {item.gallons ? <span><strong className="text-foreground">{item.gallons.toLocaleString()}</strong> gal</span> : null}
                  </div>
                </div>
              )}

              {/* Quick note */}
              {item.quickNote && (
                <div className="relative px-4 pb-2">
                  <p className="text-[10px] text-muted-foreground/70 italic line-clamp-2">{item.quickNote}</p>
                </div>
              )}

              {/* Actions */}
              <div className="relative px-4 pb-3">
                <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <button onClick={(e) => { e.stopPropagation(); openEdit(item); }} className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(item._id); }} className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {filteredData.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">No Shipments found</div>
        )}
      </div>

      {/* Unified Add/Edit Dialog */}
      <AddShippingDialog
        open={isDialogOpen}
        onClose={() => { setIsDialogOpen(false); setEditingItem(null); }}
        mode="standalone"
        editingData={editingItem}
        onSaved={fetchData}
        presetVBNumber={sidebarVBNumber}
        presetVBSerial={sidebarVBSerial}
      />

      <ShipmentTrackingPanel
        open={!!trackingContainer}
        onClose={() => { setTrackingContainer(null); setTrackingRawJson(null); }}
        containerNo={trackingContainer || ''}
        cachedRawJson={trackingRawJson}
      />

      <ShipmentDetailPanel
        open={!!detailShipment}
        onClose={() => setDetailShipment(null)}
        shipmentId={detailShipment?._id || null}
        shipmentData={detailShipment}
        onEdit={(ship) => { setEditingItem(ship); setIsDialogOpen(true); }}
        onDelete={(id) => { handleDelete(id); }}
        onTrack={(cn) => { openTracking({ containerNo: cn } as ShipmentRecord); }}
        onAttachments={(ship) => {
          const names = resolveShipNames(ship);
          setAttachmentsOpen(names);
        }}
        onTimeline={(ship) => {
          const names = resolveShipNames(ship);
          setTimelineOpen({
            VBNumber: ship.VBNumber || undefined,
            VBSerialNumber: ship.VBSerialNumber || ship.poNo || undefined,
            VBShipmentNumber: ship._id || undefined,
            title: `Timeline — ${names.shipNumber || 'Shipping'}`,
          });
        }}
      />

      <AttachmentsModal
        open={!!attachmentsOpen}
        onClose={() => setAttachmentsOpen(null)}
        poNumber={attachmentsOpen?.poNumber || ''}
        spoNumber={attachmentsOpen?.spoNumber}
        shipNumber={attachmentsOpen?.shipNumber}
      />

      <TimelineModal
        open={!!timelineOpen}
        onClose={() => setTimelineOpen(null)}
        VBNumber={timelineOpen?.VBNumber}
        VBSerialNumber={timelineOpen?.VBSerialNumber}
        VBShipmentNumber={timelineOpen?.VBShipmentNumber}
        title={timelineOpen?.title}
      />
      </div>
    </div>
  );
}
