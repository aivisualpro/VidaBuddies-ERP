"use client";

import { useEffect, useState, useMemo, useRef, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { SimpleDataTable } from "@/components/admin/simple-data-table";
import { toast } from "sonner";
import { ColumnDef } from "@tanstack/react-table";
import { Pencil, Trash2, ArrowRightLeft, X, RotateCcw, ChevronDown, Plus, Check } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TablePageSkeleton } from "@/components/skeletons";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import { useWarehouses } from "@/hooks/queries/useWarehouses";


interface TransferOrder {
  _id: string;
  vbShipmentNumber?: { _id: string; VBShipmentNumber?: string; svbid?: string } | string;
  warehouse?: { _id: string; name: string } | string;
  product?: { _id: string; name: string; vbId?: string } | string;
  supplier?: { _id: string; name: string; vbId?: string } | string;
  serialNumber?: string;
  qty?: number;
  batchNumber?: string;
  uom?: string;
  weight?: number;
  receivedDate?: string;
  createdBy?: { _id: string; name: string; email?: string } | string;
  createdAt?: string;
}

const FILTER_DEFAULTS = { search: "", warehouse: "", dateFrom: "", dateTo: "" };

/* ── Searchable UOM Combobox ── */
function UomCombobox({
  value,
  onChange,
  options,
  onAddNew,
}: {
  value: string;
  onChange: (val: string) => void;
  options: string[];
  onAddNew: (val: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const filtered = options.filter((o) => o.toLowerCase().includes(search.toLowerCase()));
  const exactMatch = options.some((o) => o.toLowerCase() === search.toLowerCase());

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm flex items-center justify-between gap-1 hover:bg-muted/50 transition-colors"
        onClick={() => { setOpen(!open); setSearch(""); }}
      >
        <span className={value ? "" : "text-muted-foreground"}>{value || "Select UOM"}</span>
        <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 w-full min-w-[160px] bg-popover border rounded-md shadow-lg overflow-hidden">
          <div className="p-1.5 border-b">
            <input
              type="text"
              autoFocus
              placeholder="Search or type new..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-7 px-2 text-xs rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              onKeyDown={(e) => {
                if (e.key === "Enter" && search.trim()) {
                  if (!exactMatch) onAddNew(search.trim().toUpperCase());
                  onChange(search.trim().toUpperCase());
                  setOpen(false);
                }
              }}
            />
          </div>
          <div className="max-h-[160px] overflow-y-auto p-1">
            {filtered.length > 0 ? (
              filtered.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={`w-full text-left px-2 py-1.5 text-xs rounded-sm hover:bg-accent transition-colors flex items-center justify-between ${value === opt ? "bg-accent font-semibold" : ""}`}
                  onClick={() => { onChange(opt); setOpen(false); }}
                >
                  {opt}
                  {value === opt && <Check className="h-3 w-3 text-primary" />}
                </button>
              ))
            ) : (
              <p className="text-[10px] text-muted-foreground text-center py-2">No matches</p>
            )}
            {search.trim() && !exactMatch && (
              <>
                <div className="border-t my-1" />
                <button
                  type="button"
                  className="w-full text-left px-2 py-1.5 text-xs rounded-sm hover:bg-accent transition-colors flex items-center gap-1.5 text-primary font-medium"
                  onClick={() => { const val = search.trim().toUpperCase(); onAddNew(val); onChange(val); setOpen(false); }}
                >
                  <Plus className="h-3 w-3" />
                  Add &ldquo;{search.trim().toUpperCase()}&rdquo;
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Header Filters (extracted to avoid re-render loop) ── */
function HeaderFilters({
  inputs,
  setFilter,
  resetFilters,
  hasActiveFilters,
  warehouses,
}: {
  inputs: Record<string, string>;
  setFilter: (key: any, value: string) => void;
  resetFilters: () => void;
  hasActiveFilters: boolean;
  warehouses: any[];
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <input
        type="text"
        placeholder="Search..."
        value={inputs.search}
        onChange={(e) => setFilter("search", e.target.value)}
        className="h-8 w-[140px] rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      <select
        value={inputs.warehouse}
        onChange={(e) => setFilter("warehouse", e.target.value)}
        className="h-8 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <option value="">All Warehouses</option>
        {warehouses.map((w: any) => (
          <option key={w._id} value={w._id}>
            {w.name}
          </option>
        ))}
      </select>

      <input
        type="date"
        value={inputs.dateFrom}
        onChange={(e) => setFilter("dateFrom", e.target.value)}
        className="h-8 w-[130px] text-xs rounded-md border border-input bg-background px-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        title="From Date"
      />
      <input
        type="date"
        value={inputs.dateTo}
        onChange={(e) => setFilter("dateTo", e.target.value)}
        className="h-8 w-[130px] text-xs rounded-md border border-input bg-background px-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        title="To Date"
      />
      {hasActiveFilters && (
        <button
          className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 rounded-md hover:bg-destructive/10 transition-colors"
          onClick={resetFilters}
        >
          <RotateCcw className="h-3 w-3" />
          Reset
        </button>
      )}
    </div>
  );
}

export default function TransferOrdersPage() {
  return (
    <Suspense>
      <TransferOrdersContent />
    </Suspense>
  );
}

function TransferOrdersContent() {
  const router = useRouter();
  const { filters, inputs, setFilter, resetFilters, hasActiveFilters } = useUrlFilters(
    FILTER_DEFAULTS,
    ["search"],
    300
  );
  const [data, setData] = useState<TransferOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<TransferOrder | null>(null);

  const { data: storeWarehouses = [] } = useWarehouses();


  // Fetch distinct UOM values from the collection
  const [uomOptions, setUomOptions] = useState<string[]>([]);
  useEffect(() => {
    fetch("/api/admin/transfer-orders/uoms")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setUomOptions(d); })
      .catch(() => {});
  }, []);

  const { setLeftContent, setRightContent } = useHeaderActions();

  // ── Header (static — only runs once) ──
  useEffect(() => {
    setLeftContent(
      <div className="flex items-center gap-2">
        <ArrowRightLeft className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          Transfer Orders
        </h1>
      </div>
    );
    return () => {
      setLeftContent(null);
      setRightContent(null);
    };
  }, []);

  // ── Fetch ──
  const fetchData = async () => {
    try {
      const res = await fetch("/api/admin/transfer-orders");
      const items = await res.json();
      setData(Array.isArray(items) ? items : []);
    } catch {
      toast.error("Failed to fetch transfer orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ── Helpers ──
  const resolveStr = (val: any, field: string = "name"): string => {
    if (!val) return "-";
    if (typeof val === "object") return val[field] || val._id || "-";
    return val;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  // ── Filtering ──
  const filteredData = useMemo(() => {
    let result = data;

    if (filters.warehouse) {
      result = result.filter((r) => {
        const wId = typeof r.warehouse === "object" ? r.warehouse?._id : r.warehouse;
        return wId === filters.warehouse;
      });
    }



    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom);
      result = result.filter((r) => r.receivedDate && new Date(r.receivedDate) >= from);
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter((r) => r.receivedDate && new Date(r.receivedDate) <= to);
    }

    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter((r) => {
        const searchable = [
          resolveStr(r.warehouse),
          resolveStr(r.product),
          resolveStr(r.supplier),
          r.serialNumber,
          r.batchNumber,
          r.uom,
          resolveStr(r.vbShipmentNumber, "VBShipmentNumber"),
          resolveStr(r.vbShipmentNumber, "svbid"),
          resolveStr(r.createdBy),
          String(r.qty),
          String(r.weight),
          formatDate(r.receivedDate),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return searchable.includes(q);
      });
    }

    return result;
  }, [data, filters]);

  // ── CRUD: Delete ──
  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/transfer-orders/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Transfer order deleted");
      fetchData();
    } catch {
      toast.error("Failed to delete");
    } finally {
      setDeleteId(null);
    }
  };

  // ── CRUD: Edit (inline dialog) ──
  const handleSaveEdit = async () => {
    if (!editingItem) return;
    try {
      const payload = {
        serialNumber: editingItem.serialNumber,
        qty: editingItem.qty,
        batchNumber: editingItem.batchNumber,
        uom: editingItem.uom,
        weight: editingItem.weight,
        receivedDate: editingItem.receivedDate,
      };
      const res = await fetch(`/api/admin/transfer-orders/${editingItem._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to update");
      toast.success("Transfer order updated");
      setEditingItem(null);
      fetchData();
    } catch {
      toast.error("Failed to update");
    }
  };

  // ── Columns ──
  const columns: ColumnDef<TransferOrder>[] = [
    {
      id: "shipment",
      header: "Shipment #",
      accessorFn: (row) => resolveStr(row.vbShipmentNumber, "VBShipmentNumber") || resolveStr(row.vbShipmentNumber, "svbid"),
      cell: ({ row }) => {
        const val = resolveStr(row.original.vbShipmentNumber, "VBShipmentNumber") || resolveStr(row.original.vbShipmentNumber, "svbid");
        return <span className="font-mono font-semibold text-primary">{val}</span>;
      },
    },
    {
      id: "warehouse",
      header: "Warehouse",
      accessorFn: (row) => resolveStr(row.warehouse),
      cell: ({ row }) => resolveStr(row.original.warehouse),
    },
    {
      id: "product",
      header: "Product",
      accessorFn: (row) => resolveStr(row.product),
      cell: ({ row }) => {
        const p = row.original.product;
        if (typeof p === "object" && p) {
          return (
            <span>
              {p.name}
              {p.vbId && <span className="text-[10px] text-muted-foreground ml-1">({p.vbId})</span>}
            </span>
          );
        }
        return resolveStr(p);
      },
    },
    {
      id: "supplier",
      header: "Supplier",
      accessorFn: (row) => resolveStr(row.supplier),
      cell: ({ row }) => resolveStr(row.original.supplier),
    },
    {
      accessorKey: "serialNumber",
      header: "Serial #",
      cell: ({ row }) => row.original.serialNumber || "-",
    },
    {
      accessorKey: "qty",
      header: "Qty",
      cell: ({ row }) => (
        <span className="font-bold">{row.original.qty?.toLocaleString() || "-"}</span>
      ),
    },
    {
      accessorKey: "batchNumber",
      header: "Batch #",
      cell: ({ row }) => row.original.batchNumber || "-",
    },
    {
      accessorKey: "uom",
      header: "UOM",
      cell: ({ row }) => row.original.uom || "-",
    },
    {
      accessorKey: "weight",
      header: "Weight",
      cell: ({ row }) => row.original.weight || "-",
    },
    {
      id: "receivedDate",
      header: "Received Date",
      accessorFn: (row) => row.receivedDate ? new Date(row.receivedDate).getTime() : 0,
      cell: ({ row }) => formatDate(row.original.receivedDate),
    },
    {
      id: "createdBy",
      header: "Created By",
      accessorFn: (row) => resolveStr(row.createdBy),
      cell: ({ row }) => resolveStr(row.original.createdBy),
    },
    {
      id: "createdAt",
      header: "Created",
      accessorFn: (row) => row.createdAt ? new Date(row.createdAt).getTime() : 0,
      cell: ({ row }) => formatDate(row.original.createdAt),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditingItem(row.original);
            }}
            className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDeleteId(row.original._id);
            }}
            className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
      size: 80,
    },
  ];

  const headerFilters = useMemo(() => (
    <HeaderFilters
      inputs={inputs}
      setFilter={setFilter}
      resetFilters={resetFilters}
      hasActiveFilters={hasActiveFilters}
      warehouses={storeWarehouses}
    />
  ), [inputs, setFilter, resetFilters, hasActiveFilters, storeWarehouses]);

  if (loading) return <TablePageSkeleton />;

  return (
    <div className="w-full h-full">
      <SimpleDataTable
        columns={columns}
        data={filteredData}
        showColumnToggle={false}
        headerExtra={headerFilters}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transfer Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this transfer order? This action cannot be undone.
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

      {/* Edit Dialog */}
      <Dialog open={!!editingItem} onOpenChange={(open) => { if (!open) setEditingItem(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4 text-primary" />
              Edit Transfer Order
            </DialogTitle>
            <DialogDescription>
              Update the details of this transfer order.
            </DialogDescription>
          </DialogHeader>
          {editingItem && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Serial Number</Label>
                  <Input
                    value={editingItem.serialNumber || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, serialNumber: e.target.value })}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Qty</Label>
                  <Input
                    type="number"
                    value={editingItem.qty || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, qty: Number(e.target.value) })}
                    className="h-9"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Batch #</Label>
                  <Input
                    value={editingItem.batchNumber || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, batchNumber: e.target.value })}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">UOM</Label>
                  <UomCombobox
                    value={editingItem.uom || ""}
                    onChange={(val) => setEditingItem({ ...editingItem, uom: val })}
                    options={uomOptions}
                    onAddNew={(val) => setUomOptions((prev) => [...new Set([...prev, val])].sort())}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Weight</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editingItem.weight || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, weight: Number(e.target.value) })}
                    className="h-9"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Received Date</Label>
                <Input
                  type="date"
                  value={editingItem.receivedDate ? new Date(editingItem.receivedDate).toISOString().split("T")[0] : ""}
                  onChange={(e) => setEditingItem({ ...editingItem, receivedDate: e.target.value })}
                  className="h-9"
                />
              </div>
            </div>
          )}
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setEditingItem(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
