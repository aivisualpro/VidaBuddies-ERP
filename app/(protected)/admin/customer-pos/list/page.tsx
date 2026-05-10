"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { SimpleDataTable } from "@/components/admin/simple-data-table";
import { toast } from "sonner";
import { ColumnDef } from "@tanstack/react-table";
import { Pencil, Trash2 } from "lucide-react";
import { TablePageSkeleton } from "@/components/skeletons";
import { ViewToggle } from "@/components/admin/view-toggle";
import { AddCustomerPODialog } from "@/components/admin/add-customer-po-dialog";
import { useUserDataStore } from "@/store/useUserDataStore";

interface CustomerPO {
  _id: string;
  vbpoNo?: string;
  poNo?: string;
  customer?: string;
  customerLocation?: string;
  customerPONo?: string;
  customerPODate?: string;
  requestedDeliveryDate?: string;
  qtyOrdered?: number;
  qtyReceived?: number;
  UOM?: string;
  warehouse?: string;
  createdAt?: string;
  updatedAt?: string;
}

export default function CustomerPOsListPage() {
  const router = useRouter();
  const [data, setData] = useState<CustomerPO[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CustomerPO | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { customers: storeCustomers } = useUserDataStore();
  const customers = storeCustomers || [];

  const fetchData = async () => {
    try {
      const res = await fetch("/api/admin/vb-customer-po");
      const items = await res.json();
      setData(Array.isArray(items) ? items : []);
    } catch {
      toast.error("Failed to fetch Customer POs");
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
    if (!confirm("Are you sure you want to delete this Customer PO?")) return;
    try {
      const response = await fetch(`/api/admin/vb-customer-po/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete");
      toast.success("Customer PO deleted");
      fetchData();
    } catch {
      toast.error("Failed to delete");
    }
  };

  const openAdd = () => {
    setEditingItem(null);
    setIsDialogOpen(true);
  };

  const openEdit = (item: CustomerPO) => {
    setEditingItem(item);
    setIsDialogOpen(true);
  };

  const filteredData = useMemo(() => {
    if (!searchQuery) return data;
    const q = searchQuery.toLowerCase();
    return data.filter(item => {
      const searchable = [item.vbpoNo, item.poNo, item.customer, item.customerPONo, item.warehouse].filter(Boolean).join(' ').toLowerCase();
      return searchable.includes(q);
    });
  }, [data, searchQuery]);

  const columns: ColumnDef<CustomerPO>[] = [
    { accessorKey: "vbpoNo", header: "VB PO #" },
    { accessorKey: "poNo", header: "PO #" },
    {
      accessorKey: "customer",
      header: "Customer",
      cell: ({ row }) => {
        const cust = customers.find((c: any) => c.vbId === row.original.customer);
        return cust?.name || row.original.customer || "-";
      },
    },
    { accessorKey: "customerPONo", header: "Customer PO #" },
    {
      accessorKey: "customerPODate",
      header: "CPO Date",
      cell: ({ row }) => formatDate(row.original.customerPODate),
    },
    {
      accessorKey: "requestedDeliveryDate",
      header: "Delivery Date",
      cell: ({ row }) => formatDate(row.original.requestedDeliveryDate),
    },
    {
      accessorKey: "qtyOrdered",
      header: "Qty Ordered",
      cell: ({ row }) => row.original.qtyOrdered?.toLocaleString() || "-",
    },
    {
      accessorKey: "qtyReceived",
      header: "Qty Received",
      cell: ({ row }) => row.original.qtyReceived?.toLocaleString() || "-",
    },
    { accessorKey: "UOM", header: "UOM" },
    { accessorKey: "warehouse", header: "Warehouse" },
    {
      id: "completion",
      header: "Completion",
      cell: ({ row }) => {
        const ordered = Number(row.original.qtyOrdered) || 0;
        const received = Number(row.original.qtyReceived) || 0;
        const percent = ordered > 0 ? Math.round((received / ordered) * 100) : 0;
        return (
          <div className="w-20 group relative">
            <div className="flex items-center justify-between text-[10px] font-bold mb-1">
              <span className={percent >= 100 ? "text-emerald-600 dark:text-emerald-400" : percent > 0 ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"}>
                {percent}%
              </span>
            </div>
            <div className="h-1.5 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden shadow-inner">
              <div
                className={`h-full transition-all duration-700 ease-out rounded-full ${percent >= 100 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : percent > 50 ? 'bg-blue-500' : percent > 0 ? 'bg-amber-400' : 'bg-transparent'}`}
                style={{ width: `${Math.min(percent, 100)}%` }}
              />
            </div>
          </div>
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
      <ViewToggle currentView="list" basePath="/admin/customer-pos" />
      <div className="h-5 w-px bg-border mx-1" />
      <input
        type="text"
        placeholder="Search..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="h-8 w-[160px] rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
    </div>
  );

  return (
    <div className="w-full h-full">
      <SimpleDataTable
        columns={columns}
        data={filteredData}
        onAdd={openAdd}
        showColumnToggle={false}
        headerExtra={headerFilters}
      />

      <AddCustomerPODialog
        open={isDialogOpen}
        onClose={() => { setIsDialogOpen(false); setEditingItem(null); }}
        editingData={editingItem}
        mode="standalone"
        existingCPOs={data}
        onSaved={fetchData}
      />
    </div>
  );
}
