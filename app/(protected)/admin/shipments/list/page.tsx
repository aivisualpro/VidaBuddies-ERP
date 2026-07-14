"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useUrlFilters } from "@/hooks/use-url-filters";
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
import { DriveDocumentsModal } from "@/components/drive-documents-modal";
import { AttachmentsModal } from "@/components/attachments-modal";
import TimelineModal from "@/components/admin/timeline-modal";
import { usePurchaseOrders } from "@/hooks/queries/usePurchaseOrders";
import { useSuppliers } from "@/hooks/queries/useSuppliers";
import { useCustomerPOs } from "@/hooks/queries/useCustomerPOs";
import { RecordChatDrawer } from "@/components/chat/record-chat-drawer";
import { AddCustomerPODialog } from "@/components/admin/add-customer-po-dialog";
import { CustomerInfoPanel } from "@/components/admin/customer-info-panel";

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
  // Denormalized display fields from API
  _displayVBNumber?: string;
  _displayVBSerialNumber?: string;
  _displaySupplier?: string;
  _displaySupplierLocation?: string;
  _displayProducts?: string[];
  _customerId?: string | null;
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

// Default export wraps in Suspense for useSearchParams
export default function ShipmentsListPage() {
  return (
    <Suspense>
      <ShipmentsListContent />
    </Suspense>
  );
}

const FILTER_DEFAULTS = { search: "", status: "" };

function ShipmentsListContent() {
  const router = useRouter();
  const { filters, inputs, setFilter, resetFilters, hasActiveFilters } = useUrlFilters(
    FILTER_DEFAULTS,
    ["search"],  // debounce search input
    300,
  );
  const [data, setData] = useState<ShipmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ShipmentRecord | null>(null);
  const [sidebarVBNumber, setSidebarVBNumber] = useState<string | null>(null);
  const [sidebarVBSerial, setSidebarVBSerial] = useState<string | null>(null);
  const [sidebarShipment, setSidebarShipment] = useState<string | null>(null);
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
  const [editingCPO, setEditingCPO] = useState<Record<string, any> | null>(null);
  const [timelineCounts, setTimelineCounts] = useState<Record<string, number>>({});
  const [customerPanelId, setCustomerPanelId] = useState<string | null>(null);
  const [legacyAttachmentsOpen, setLegacyAttachmentsOpen] = useState<{ poNumber: string; spoNumber?: string; shipNumber?: string } | null>(null);

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

  const { data: storeSuppliers = [] } = useSuppliers();
  const { data: purchaseOrders = [] } = usePurchaseOrders();
  const { data: allCPOs = [] } = useCustomerPOs();
  const suppliers = storeSuppliers;

  /** Quick O(1) lookup: CPO _id → isDirectShipment */
  const cpoDirectShipMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    allCPOs.forEach((c: any) => { if (c._id) map[c._id] = !!c.isDirectShipment; });
    return map;
  }, [allCPOs]);

  /** Resolve display names — now returned directly from denormalized API */
  const resolveShipNames = (ship: any) => ({
    poNumber: ship._displayVBNumber || ship.VBNumber || '',
    spoNumber: ship._displayVBSerialNumber || ship.VBSerialNumber || undefined,
    shipNumber: ship.VBShipmentNumber || ship.svbid || undefined,
  });

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
    fetch("/api/admin/timeline")
      .then((r) => r.json())
      .then((items) => {
        if (Array.isArray(items)) {
          const counts: Record<string, number> = {};
          items.forEach((t: any) => {
            // VBShipmentNumber is stored as ObjectId ref to shipping._id
            const shipKey = (t.VBShipmentNumber || '')?.toString();
            const serialKey = (t.VBSerialNumber || '')?.toString();
            if (shipKey) counts[shipKey] = (counts[shipKey] || 0) + 1;
            else if (serialKey) counts[serialKey] = (counts[serialKey] || 0) + 1;
          });
          setTimelineCounts(counts);
        }
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
        if (sidebarShipment) {
          result = result.filter(item => (item.VBShipmentNumber || item.svbid || 'none') === sidebarShipment);
        }
      }
    }
    if (filters.status) {
      result = result.filter(item => normalizeStatus(item.status || '') === filters.status);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(item => {
        const searchable = [item._displayVBNumber, item._displayVBSerialNumber, item.VBShipmentNumber, item._displaySupplier, item.carrier, item.containerNo, item.BOLNumber, item.quickNote, (item as any)._displayCustomer, (item as any)._displayCustomerPONo, (item as any)._displayWarehouse, item.portOfLading, item.portOfEntryShipTo, item.svbid].filter(Boolean).join(' ').toLowerCase();
        return searchable.includes(q);
      });
    }
    return result;
  }, [data, filters.search, filters.status, sidebarVBNumber, sidebarVBSerial, sidebarShipment]);

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
      header: "Shipment #",
      accessorFn: (row) => row.VBShipmentNumber || row.svbid || "",
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
      id: "status",
      header: "Status",
      accessorFn: (row) => normalizeStatus(row.status || ""),
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
      id: "customer",
      header: "Customer",
      accessorFn: (row) => (row as any)._displayCustomer || "",
      cell: ({ row }) => {
        const name = (row.original as any)._displayCustomer;
        const id = (row.original as any)._customerId;
        if (!name) return "-";
        return (
          <button
            onClick={(e) => { e.stopPropagation(); if (id) setCustomerPanelId(id); }}
            className="text-left font-medium text-xs hover:text-primary transition-colors underline underline-offset-2 decoration-muted-foreground/30 hover:decoration-primary"
          >
            {name}
          </button>
        );
      },
    },
    {
      id: "customerPONo",
      header: "Customer PO #",
      accessorFn: (row) => (row as any)._displayCustomerPONo || "",
      cell: ({ row }) => {
        const val = (row.original as any)._displayCustomerPONo;
        if (!val) return "-";
        const cpoId = row.original.VBSerialNumber;
        return (
          <button
            onClick={async (e) => {
              e.stopPropagation();
              if (!cpoId) return;
              try {
                const res = await fetch(`/api/admin/vb-customer-po/${cpoId}`);
                if (res.ok) {
                  const cpoData = await res.json();
                  setEditingCPO(cpoData);
                } else {
                  toast.error("Failed to load Customer PO");
                }
              } catch {
                toast.error("Failed to load Customer PO");
              }
            }}
            className="text-primary hover:text-primary/80 font-bold text-xs underline underline-offset-2 decoration-primary/30 hover:decoration-primary transition-colors"
          >
            {val}
          </button>
        );
      },
    },
    {
      id: "warehouse",
      header: "Warehouse",
      accessorFn: (row) => (row as any)._displayWarehouse || "",
      cell: ({ row }) => (row.original as any)._displayWarehouse || "-",
    },
    {
      id: "supplier",
      header: "Supplier",
      accessorFn: (row) => (row as any)._displaySupplier || row.supplier || "",
      cell: ({ row }) => {
        const val = row.original.supplier || "";
        return (row.original as any)._displaySupplier || val || "-";
      },
    },
    {
      id: "carrier",
      header: "Carrier",
      accessorFn: (row) => row.carrier || "",
      cell: ({ row }) => row.original.carrier || "-",
    },
    {
      id: "containerNo",
      header: "Container #",
      accessorFn: (row) => row.containerNo || "",
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
    {
      id: "BOLNumber",
      header: "BOL #",
      accessorFn: (row) => row.BOLNumber || "",
      cell: ({ row }) => row.original.BOLNumber || "-",
    },
    {
      id: "ETA",
      header: "ETA",
      accessorFn: (row) => {
        const d = row.updatedETA || row.ETA;
        return d ? new Date(d).getTime() : 0;
      },
      sortingFn: "basic",
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
    {
      id: "portOfLading",
      header: "Port of Lading",
      accessorFn: (row) => row.portOfLading || "",
      cell: ({ row }) => row.original.portOfLading || "-",
    },
    {
      id: "portOfEntryShipTo",
      header: "Port of Entry",
      accessorFn: (row) => row.portOfEntryShipTo || "",
      cell: ({ row }) => row.original.portOfEntryShipTo || "-",
    },
    {
      id: "drums",
      header: "Drums",
      accessorFn: (row) => row.drums ?? 0,
      sortingFn: "basic",
      cell: ({ row }) => row.original.drums?.toLocaleString() || "-",
    },
    {
      id: "gallons",
      header: "Gallons",
      accessorFn: (row) => row.gallons ?? 0,
      sortingFn: "basic",
      cell: ({ row }) => row.original.gallons?.toLocaleString() || "-",
    },
    {
      id: "timeline",
      header: "Timeline",
      enableSorting: false,
      cell: ({ row }) => {
        const shipId = row.original._id;
        const count = timelineCounts[shipId] || 0;
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              const names = {
                vbNumber: row.original.VBNumber,
                serial: row.original.VBSerialNumber,
                shipNumber: row.original.VBShipmentNumber || row.original.svbid,
              };
              setTimelineOpen({
                VBNumber: row.original.VBNumber?.toString() || undefined,
                VBSerialNumber: row.original.VBSerialNumber?.toString() || undefined,
                VBShipmentNumber: shipId?.toString() || undefined,
                title: `Timeline — ${names.shipNumber || 'Shipping'}`,
              });
            }}
            className={`inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full transition-colors ${count > 0
              ? 'bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer'
              : 'text-muted-foreground hover:bg-muted cursor-pointer'
              }`}
          >
            <Clock className="h-3 w-3" />
            {count > 0 ? count : '—'}
          </button>
        );
      },
    },
    {
      id: "chat",
      header: "Chat",
      enableSorting: false,
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
      enableSorting: false,
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
        value={inputs.search}
        onChange={(e) => setFilter("search", e.target.value)}
        className="h-8 w-[160px] rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      <select
        value={filters.status}
        onChange={(e) => setFilter("status", e.target.value)}
        className={`h-8 rounded-md border px-2 text-xs bg-background transition-colors ${filters.status ? 'border-primary text-primary font-medium' : 'border-input text-muted-foreground'}`}
      >
        <option value="">All Statuses ({statusCounts.all})</option>
        <option value="ordered">Ordered ({statusCounts.ordered})</option>
        <option value="planned">Planned ({statusCounts.planned})</option>
        <option value="in transit">In Transit ({statusCounts['in transit']})</option>
        <option value="delivered">Delivered ({statusCounts.delivered})</option>
        <option value="pending">Pending ({statusCounts.pending})</option>
      </select>
      {hasActiveFilters && (
        <button
          onClick={() => resetFilters()}
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
        activeShipment={sidebarShipment}
        onSelect={(vb, ser, ship) => { setSidebarVBNumber(vb); setSidebarVBSerial(ser); setSidebarShipment(ship); }}
      />
      <div className="flex-1 min-w-0">
        <SimpleDataTable
          columns={columns}
          data={filteredData}
          onAdd={openAdd}
          onRowClick={(row) => setDetailShipment(row)}
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
        isDirectShipment={!!(detailShipment?.VBSerialNumber && cpoDirectShipMap[detailShipment.VBSerialNumber])}
        onUpdate={(updatedShip) => {
          setData((prev) => prev.map((s) => (s._id === updatedShip._id ? { ...s, ...updatedShip } : s)));
          setDetailShipment(updatedShip);
        }}
      />

      {/* Drive Documents Modal (new rich file manager) */}
      <DriveDocumentsModal
        open={!!attachmentsOpen}
        onClose={() => setAttachmentsOpen(null)}
        poNumber={attachmentsOpen?.poNumber || ''}
        spoNumber={attachmentsOpen?.spoNumber}
        shipNumber={attachmentsOpen?.shipNumber}
        onOpenLegacy={() => {
          const saved = attachmentsOpen;
          setAttachmentsOpen(null);
          setTimeout(() => setLegacyAttachmentsOpen(saved), 100);
        }}
      />

      {/* Legacy Attachments Modal (Google Drive upload/folder fallback) */}
      <AttachmentsModal
        open={!!legacyAttachmentsOpen}
        onClose={() => setLegacyAttachmentsOpen(null)}
        poNumber={legacyAttachmentsOpen?.poNumber || ''}
        spoNumber={legacyAttachmentsOpen?.spoNumber}
        shipNumber={legacyAttachmentsOpen?.shipNumber}
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

      {/* Customer PO Edit Dialog */}
      <AddCustomerPODialog
        open={!!editingCPO}
        onClose={() => setEditingCPO(null)}
        editingData={editingCPO}
        onSaved={fetchData}
      />

      {/* Customer Info Panel */}
      <CustomerInfoPanel
        customerId={customerPanelId}
        open={!!customerPanelId}
        onClose={() => setCustomerPanelId(null)}
      />
    </div>
  );
}
