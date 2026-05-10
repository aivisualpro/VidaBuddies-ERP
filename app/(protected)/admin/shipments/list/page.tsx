"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { SimpleDataTable } from "@/components/admin/simple-data-table";
import { toast } from "sonner";
import { ColumnDef } from "@tanstack/react-table";
import { Pencil, Trash2, Ship, CheckCircle2, Clock, AlertCircle, MessageCircle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { TablePageSkeleton } from "@/components/skeletons";
import { ViewToggle } from "@/components/admin/view-toggle";
import { AddShippingDialog } from "@/components/admin/add-shipping-dialog";
import { ShipmentGroupSidebar } from "@/components/admin/shipment-group-sidebar";
import { ShipmentTrackingPanel } from "@/components/admin/shipment-tracking-panel";
import { ShipmentDetailPanel } from "@/components/admin/shipment-detail-panel";
import { AttachmentsModal } from "@/components/attachments-modal";
import TimelineModal from "@/components/admin/timeline-modal";
import { useUserDataStore } from "@/store/useUserDataStore";
import { RecordChatDrawer } from "@/components/chat/record-chat-drawer";

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
  supplierPO?: string;
  carrier?: string;
  carrierBookingRef?: string;
  BOLNumber?: string;
  containerNo?: string;
  vessellTrip?: string;
  portOfLading?: string;
  portOfEntryShipTo?: string;
  ETA?: string;
  updatedETA?: string;
  status?: string;
  drums?: number;
  pallets?: number;
  gallons?: number;
  invValue?: number;
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

const STATUS_COLORS: Record<string, string> = {
  delivered: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  'in transit': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  planned: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  ordered: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  pending: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
};

export default function ShipmentsListPage() {
  const router = useRouter();
  const [data, setData] = useState<ShipmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ShipmentRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [sidebarVBNumber, setSidebarVBNumber] = useState<string | null>(null);
  const [sidebarVBSerial, setSidebarVBSerial] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [trackingContainer, setTrackingContainer] = useState<string | null>(null);
  const [trackingRawJson, setTrackingRawJson] = useState<any>(null);
  const [detailShipment, setDetailShipment] = useState<ShipmentRecord | null>(null);
  const [attachmentsOpen, setAttachmentsOpen] = useState<{ poNumber: string; spoNumber?: string; shipNumber?: string } | null>(null);
  const [timelineOpen, setTimelineOpen] = useState<{ VBNumber?: string; VBSerialNumber?: string; VBShipmentNumber?: string; title?: string } | null>(null);
  const [chatOpen, setChatOpen] = useState<{ refKind: "VBShipmentNumber"; refId: string; display: string } | null>(null);
  const [chatInfo, setChatInfo] = useState<Record<string, { unread: number; hasConversation: boolean }>>({});
  const [currentUserId, setCurrentUserId] = useState("");
  const [allUsers, setAllUsers] = useState<any[]>([]);

  const openTracking = (item: ShipmentRecord) => {
    const cn = item.containerNo;
    if (!cn) { toast.error('No container number on this shipment'); return; }
    // Use the latest stored raw_json if available
    const records = item.shippingTrackingRecords || [];
    const latest = records[records.length - 1];
    const rawStr = latest?.raw_json;
    if (rawStr) {
      try { setTrackingRawJson(JSON.parse(rawStr)); } catch { setTrackingRawJson(null); }
    } else {
      setTrackingRawJson(null); // will trigger live fetch
    }
    setTrackingContainer(cn);
  };

  const { suppliers: storeSuppliers, purchaseOrders } = useUserDataStore();
  const suppliers = storeSuppliers || [];

  // Build lookup maps to resolve ObjectIDs → display names (VBNumber, VBSerialNumber)
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

  /** Resolve VBNumber/VBSerialNumber — they might be ObjectIDs or display names */
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
    fetch("/api/admin/chat/unread-by-refs?kind=VBShipmentNumber")
      .then((r) => r.json())
      .then((d) => { if (d && typeof d === "object") setChatInfo(d); })
      .catch(() => {});
    fetch("/api/admin/chat")
      .then((r) => r.json())
      .then((d) => {
        setCurrentUserId(d.currentUser?.id || "");
        setAllUsers(d.users || []);
      })
      .catch(() => {});
  }, []);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/vb-shipping/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Shipment deleted");
      fetchData();
    } catch {
      toast.error("Failed to delete");
    } finally {
      setDeleteId(null);
    }
  };

  const openAdd = () => {
    setEditingItem(null);
    setIsDialogOpen(true);
  };

  const openEdit = (item: ShipmentRecord) => {
    setEditingItem(item);
    setIsDialogOpen(true);
  };

  const updateStatusInline = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/admin/vb-shipping/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Status updated");
      fetchData();
    } catch {
      toast.error("Failed to update status");
    }
  };

  const filteredData = useMemo(() => {
    let result = data;
    // Sidebar group filter
    if (sidebarVBNumber) {
      result = result.filter(item => (item.VBNumber || 'Unlinked') === sidebarVBNumber);
      if (sidebarVBSerial) {
        result = result.filter(item => (item.VBSerialNumber || 'none') === sidebarVBSerial);
      }
    }
    if (filterStatus) {
      result = result.filter(item => normalizeStatus(item.status || '') === filterStatus);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(item => {
        const searchable = [item.VBNumber, item.VBSerialNumber, item.VBShipmentNumber, item.supplier, item.carrier, item.containerNo, item.BOLNumber, item.quickNote].filter(Boolean).join(' ').toLowerCase();
        return searchable.includes(q);
      });
    }
    return result;
  }, [data, searchQuery, filterStatus, sidebarVBNumber, sidebarVBSerial]);

  // Build status counts for filter chips
  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { all: 0, delivered: 0, 'in transit': 0, planned: 0, ordered: 0, pending: 0 };
    data.forEach(item => {
      c.all++;
      const s = normalizeStatus(item.status || '');
      if (s in c) c[s]++;
    });
    return c;
  }, [data]);

  const columns: ColumnDef<ShipmentRecord>[] = [
    {
      id: "VBShipmentNumber",
      header: "VB Shipment Number",
      cell: ({ row }) => {
        const label = row.original.VBShipmentNumber || row.original.svbid || "-";
        if (label === "-") return "-";
        return (
          <button
            onClick={(e) => { e.stopPropagation(); setDetailShipment(row.original); }}
            className="text-primary hover:text-primary/80 font-bold text-xs underline underline-offset-2 decoration-primary/30 hover:decoration-primary transition-colors"
          >
            {label}
          </button>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const raw = row.original.status || '';
        const norm = normalizeStatus(raw);
        const color = STATUS_COLORS[norm] || STATUS_COLORS.pending;
        return (
          <select
            value={raw}
            onChange={(e) => { e.stopPropagation(); updateStatusInline(row.original._id, e.target.value); }}
            onClick={(e) => e.stopPropagation()}
            className={`appearance-none cursor-pointer text-[11px] font-medium px-2 py-0.5 rounded-full border-0 outline-none ${color}`}
          >
            <option value="Ordered">Ordered</option>
            <option value="Planned">Planned</option>
            <option value="In Transit">In Transit</option>
            <option value="Delivered">Delivered</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        );
      },
    },
    {
      accessorKey: "supplier",
      header: "Supplier",
      cell: ({ row }) => {
        const val = row.original.supplier || "";
        const sup = suppliers.find((s: any) => s._id === val || s.vbId === val);
        return sup?.name || val || "-";
      },
    },
    { accessorKey: "carrier", header: "Carrier" },
    {
      accessorKey: "containerNo",
      header: "Container #",
      cell: ({ row }) => {
        const cn = row.original.containerNo;
        if (!cn) return "-";
        return (
          <button
            onClick={(e) => { e.stopPropagation(); openTracking(row.original); }}
            className="text-blue-500 hover:text-blue-400 font-mono text-xs font-bold underline underline-offset-2 decoration-blue-500/30 hover:decoration-blue-400 transition-colors"
          >
            {cn}
          </button>
        );
      },
    },
    { accessorKey: "BOLNumber", header: "BOL #" },
    {
      accessorKey: "ETA",
      header: "ETA",
      cell: ({ row }) => {
        const eta = formatDate(row.original.ETA);
        const updatedEta = row.original.updatedETA ? formatDate(row.original.updatedETA) : null;
        if (updatedEta && updatedEta !== eta) {
          return (
            <div className="flex flex-col">
              <span className="text-[10px] line-through text-muted-foreground">{eta}</span>
              <span className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">{updatedEta}</span>
            </div>
          );
        }
        return eta;
      },
    },
    { accessorKey: "portOfLading", header: "Port of Lading" },
    { accessorKey: "portOfEntryShipTo", header: "Port of Entry" },
    {
      accessorKey: "drums",
      header: "Drums",
      cell: ({ row }) => row.original.drums?.toLocaleString() || "-",
    },
    {
      accessorKey: "gallons",
      header: "Gallons",
      cell: ({ row }) => row.original.gallons?.toLocaleString() || "-",
    },
    {
      id: "chat",
      header: "Chat",
      cell: ({ row }) => {
        const shipId = row.original._id;
        const display = row.original.VBShipmentNumber || row.original.svbid || shipId;
        const info = chatInfo[shipId];
        const count = info?.unread || 0;
        const hasConv = info?.hasConversation || false;
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setChatOpen({ refKind: "VBShipmentNumber", refId: shipId, display });
            }}
            className={`inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full transition-colors ${count > 0
              ? 'bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer'
              : hasConv
              ? 'text-primary/60 hover:bg-primary/10 cursor-pointer'
              : 'text-muted-foreground hover:bg-muted cursor-pointer'
              }`}
            aria-label={`Chat for ${display}`}
          >
            <MessageCircle className={`h-3 w-3 ${hasConv ? 'fill-current' : ''}`} />
            {count > 0 ? count : hasConv ? '' : '—'}
          </button>
        );
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); openEdit(row.original); }}
            className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setDeleteId(row.original._id); }}
            className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
      size: 80,
    },
  ];

  if (loading) return <TablePageSkeleton />;

  const headerFilters = (
    <div className="flex items-center gap-1.5">
      <ViewToggle currentView="list" basePath="/admin/shipments" />
      <div className="h-5 w-px bg-border mx-1" />
      <input
        type="text"
        placeholder="Search..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="h-8 w-[160px] rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      <select
        value={filterStatus}
        onChange={(e) => setFilterStatus(e.target.value)}
        className={`h-8 rounded-md border px-2 text-xs bg-background transition-colors ${filterStatus ? 'border-primary text-primary font-medium' : 'border-input text-muted-foreground'}`}
      >
        <option value="">All Statuses ({statusCounts.all})</option>
        <option value="ordered">Ordered ({statusCounts.ordered})</option>
        <option value="planned">Planned ({statusCounts.planned})</option>
        <option value="in transit">In Transit ({statusCounts['in transit']})</option>
        <option value="delivered">Delivered ({statusCounts.delivered})</option>
        <option value="pending">Pending ({statusCounts.pending})</option>
      </select>
      {filterStatus && (
        <button
          onClick={() => setFilterStatus("")}
          className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Clear
        </button>
      )}
    </div>
  );

  return (
    <div className="w-full h-full flex">
      <ShipmentGroupSidebar
        data={data}
        activeVBNumber={sidebarVBNumber}
        activeVBSerial={sidebarVBSerial}
        onSelect={(vb, ser) => { setSidebarVBNumber(vb); setSidebarVBSerial(ser); }}
      />
      <div className="flex-1 min-w-0">
        <SimpleDataTable
          columns={columns}
          data={filteredData}
          onAdd={openAdd}
          showColumnToggle={false}
          headerExtra={headerFilters}
        />
      </div>

      <AddShippingDialog
        open={isDialogOpen}
        onClose={() => { setIsDialogOpen(false); setEditingItem(null); }}
        mode="standalone"
        editingData={editingItem}
        onSaved={fetchData}
        presetVBNumber={sidebarVBNumber}
        presetVBSerial={sidebarVBSerial}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Shipment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this shipment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && handleDelete(deleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
        onDelete={(id) => { setDeleteId(id); }}
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

      {/* Record Chat Drawer */}
      {chatOpen && (
        <RecordChatDrawer
          open={!!chatOpen}
          onClose={() => {
            setChatOpen(null);
            fetch("/api/admin/chat/unread-by-refs?kind=VBShipmentNumber")
              .then((r) => r.json())
              .then((d) => { if (d && typeof d === "object") setChatInfo(d); })
              .catch(() => {});
          }}
          refKind={chatOpen.refKind}
          refId={chatOpen.refId}
          display={chatOpen.display}
          currentUserId={currentUserId}
          users={allUsers}
        />
      )}
    </div>
  );
}
