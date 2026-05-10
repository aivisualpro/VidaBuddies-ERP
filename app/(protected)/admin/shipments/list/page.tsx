"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { SimpleDataTable } from "@/components/admin/simple-data-table";
import { toast } from "sonner";
import { ColumnDef } from "@tanstack/react-table";
import { Pencil, Trash2, Ship, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { TablePageSkeleton } from "@/components/skeletons";
import { ViewToggle } from "@/components/admin/view-toggle";
import { AddShippingDialog } from "@/components/admin/add-shipping-dialog";
import { ShipmentGroupSidebar } from "@/components/admin/shipment-group-sidebar";
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

  const { suppliers: storeSuppliers } = useUserDataStore();
  const suppliers = storeSuppliers || [];

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
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this Shipment?")) return;
    try {
      const res = await fetch(`/api/admin/vb-shipping/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Shipment deleted");
      fetchData();
    } catch {
      toast.error("Failed to delete");
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
      cell: ({ row }) => row.original.VBShipmentNumber || row.original.svbid || "-",
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
    { accessorKey: "containerNo", header: "Container #" },
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
            onClick={(e) => { e.stopPropagation(); handleDelete(row.original._id); }}
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
      />
    </div>
  );
}
