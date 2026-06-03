"use client";

import { useEffect, useState, useMemo, useRef, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { SimpleDataTable } from "@/components/admin/simple-data-table";
import { toast } from "sonner";
import { ColumnDef } from "@tanstack/react-table";
import { Pencil, Trash2, ArrowRightLeft, X, RotateCcw, ChevronDown, Plus, Check, Loader2, Copy } from "lucide-react";
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
import { useProducts } from "@/hooks/queries/useProducts";
import { useSuppliers } from "@/hooks/queries/useSuppliers";
import { useShippings, shippingKeys } from "@/hooks/queries/useShippings";
import { useQueryClient } from "@tanstack/react-query";
import { AddShippingDialog } from "@/components/admin/add-shipping-dialog";

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

interface NewProductRow {
  productId: string;
  productName: string;
  serialNumber: string;
  qty: number;
  batchNumber: string;
  uom: string;
  weight: number;
}

const FILTER_DEFAULTS = { search: "", warehouse: "", dateFrom: "", dateTo: "" };

/* ── Searchable UOM Combobox — used outside Dialog so focus trap is not an issue ── */
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
        <span className={value ? "" : "text-muted-foreground"}>{value || "UOM"}</span>
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

/* ── Generic Searchable Select ── */
function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Select...",
  className = "",
}: {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
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

  const filtered = options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()));
  const selectedLabel = options.find((o) => o.value === value)?.label || "";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className={`h-9 w-full rounded-md border border-input bg-background px-2 text-sm flex items-center justify-between gap-1 hover:bg-muted/50 transition-colors ${className}`}
        onClick={() => { setOpen(!open); setSearch(""); }}
      >
        <span className={`truncate ${selectedLabel ? "" : "text-muted-foreground"}`}>{selectedLabel || placeholder}</span>
        <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 w-full min-w-[200px] bg-popover border rounded-md shadow-lg overflow-hidden">
          <div className="p-1.5 border-b">
            <input
              type="text"
              autoFocus
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-7 px-2 text-xs rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="max-h-[200px] overflow-y-auto p-1">
            {filtered.length > 0 ? (
              filtered.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`w-full text-left px-2 py-1.5 text-xs rounded-sm hover:bg-accent transition-colors flex items-center justify-between ${value === opt.value ? "bg-accent font-semibold" : ""}`}
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                >
                  <span className="truncate">{opt.label}</span>
                  {value === opt.value && <Check className="h-3 w-3 text-primary shrink-0" />}
                </button>
              ))
            ) : (
              <p className="text-[10px] text-muted-foreground text-center py-2">No matches</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Header Filters ── */
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
      <select
        value={inputs.warehouse}
        onChange={(e) => setFilter("warehouse", e.target.value)}
        className="h-8 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <option value="">All Warehouses</option>
        {warehouses.map((w: any) => (
          <option key={w._id} value={w._id}>{w.name}</option>
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

  // ── Edit dialog state ──
  const [editSaving, setEditSaving] = useState(false);
  const [editShipmentId, setEditShipmentId] = useState("");
  const [editWarehouseId, setEditWarehouseId] = useState("");
  const [editSupplierId, setEditSupplierId] = useState("");
  const [editTransferDate, setEditTransferDate] = useState("");
  const [editProductId, setEditProductId] = useState("");
  const [editSerialNumber, setEditSerialNumber] = useState("");
  const [editQty, setEditQty] = useState<number>(0);
  const [editBatchNumber, setEditBatchNumber] = useState("");
  const [editUom, setEditUom] = useState("");
  const [editWeight, setEditWeight] = useState<number>(0);

  // ── Add dialog state ──
  const [addOpen, setAddOpen] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [addShipmentId, setAddShipmentId] = useState("");
  const [addShipmentSearch, setAddShipmentSearch] = useState("");
  const [addShipmentOpen, setAddShipmentOpen] = useState(false);
  const [createShipmentLoading, setCreateShipmentLoading] = useState(false);
  const [createShipDialogOpen, setCreateShipDialogOpen] = useState(false);
  const [createShipPresetNumber, setCreateShipPresetNumber] = useState("");
  const shipmentDropRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const [addWarehouseId, setAddWarehouseId] = useState("");
  const [addSupplierId, setAddSupplierId] = useState("");
  const [addTransferDate, setAddTransferDate] = useState(new Date().toISOString().split("T")[0]);
  const [addRows, setAddRows] = useState<NewProductRow[]>([
    { productId: "", productName: "", serialNumber: "", qty: 0, batchNumber: "", uom: "", weight: 0 },
  ]);

  const { data: storeWarehouses = [] } = useWarehouses();
  const { data: storeProducts = [] } = useProducts();
  const { data: storeShippings = [] } = useShippings();
  const { data: storeSuppliers = [] } = useSuppliers();

  const [uomOptions, setUomOptions] = useState<string[]>([]);
  useEffect(() => {
    fetch("/api/admin/transfer-orders/uoms")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setUomOptions(d); })
      .catch(() => {});
  }, []);

  const { setLeftContent, setRightContent } = useHeaderActions();

  // Build header content — needs to re-run when inputs change
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

  // Close shipment dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (shipmentDropRef.current && !shipmentDropRef.current.contains(e.target as Node)) {
        setAddShipmentOpen(false);
      }
    };
    if (addShipmentOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [addShipmentOpen]);

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

  useEffect(() => { fetchData(); }, []);

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
          resolveStr(r.warehouse), resolveStr(r.product), resolveStr(r.supplier),
          r.serialNumber, r.batchNumber, r.uom,
          resolveStr(r.vbShipmentNumber, "VBShipmentNumber"),
          resolveStr(r.vbShipmentNumber, "svbid"),
          resolveStr(r.createdBy), String(r.qty), String(r.weight), formatDate(r.receivedDate),
        ].filter(Boolean).join(" ").toLowerCase();
        return searchable.includes(q);
      });
    }
    return result;
  }, [data, filters]);

  // ── Delete ──
  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/transfer-orders/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Transfer order deleted");
      fetchData();
    } catch {
      toast.error("Failed to delete");
    } finally {
      setDeleteId(null);
    }
  };

  // ── Populate edit state when editingItem changes ──
  useEffect(() => {
    if (editingItem) {
      const shipId = typeof editingItem.vbShipmentNumber === "object" ? editingItem.vbShipmentNumber?._id : (editingItem.vbShipmentNumber || "");
      const whId = typeof editingItem.warehouse === "object" ? editingItem.warehouse?._id : (editingItem.warehouse || "");
      const supId = typeof editingItem.supplier === "object" ? editingItem.supplier?._id : (editingItem.supplier || "");
      const prodId = typeof editingItem.product === "object" ? editingItem.product?._id : (editingItem.product || "");
      setEditShipmentId(shipId || "");
      setEditWarehouseId(whId || "");
      setEditSupplierId(supId || "");
      setEditProductId(prodId || "");
      setEditSerialNumber(editingItem.serialNumber || "");
      setEditQty(editingItem.qty || 0);
      setEditBatchNumber(editingItem.batchNumber || "");
      setEditUom(editingItem.uom || "");
      setEditWeight(editingItem.weight || 0);
      setEditTransferDate(editingItem.receivedDate ? new Date(editingItem.receivedDate).toISOString().split("T")[0] : "");
    }
  }, [editingItem]);

  // ── Edit ──
  const handleSaveEdit = async () => {
    if (!editingItem) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/admin/transfer-orders/${editingItem._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vbShipmentNumber: editShipmentId || null,
          warehouse: editWarehouseId || null,
          supplier: editSupplierId || null,
          product: editProductId || null,
          serialNumber: editSerialNumber,
          qty: editQty,
          batchNumber: editBatchNumber,
          uom: editUom,
          weight: editWeight,
          receivedDate: editTransferDate,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Transfer order updated");
      setEditingItem(null);
      fetchData();
    } catch {
      toast.error("Failed to update");
    } finally {
      setEditSaving(false);
    }
  };

  // ── Add ──
  const resetAddForm = () => {
    setAddShipmentId("");
    setAddShipmentSearch("");
    setAddWarehouseId("");
    setAddSupplierId("");
    setAddTransferDate(new Date().toISOString().split("T")[0]);
    setAddRows([{ productId: "", productName: "", serialNumber: "", qty: 0, batchNumber: "", uom: "", weight: 0 }]);
  };

  const handleAddSave = async () => {
    const validRows = addRows.filter((r) => r.productId && r.qty > 0);
    if (validRows.length === 0) {
      toast.error("Add at least one product with qty > 0");
      return;
    }
    setAddSaving(true);
    try {
      const res = await fetch("/api/admin/transfer-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vbShipmentNumber: addShipmentId || null,
          warehouse: addWarehouseId || null,
          supplier: addSupplierId || selectedShipment?.supplier || null,
          transferDate: addTransferDate,
          products: validRows.map((r) => ({
            product: r.productId,
            serialNumber: r.serialNumber,
            qty: r.qty,
            batchNumber: r.batchNumber,
            uom: r.uom,
            weight: r.weight,
          })),
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Transfer order(s) created");
      setAddOpen(false);
      resetAddForm();
      fetchData();
    } catch {
      toast.error("Failed to create transfer order");
    } finally {
      setAddSaving(false);
    }
  };

  const updateRow = (i: number, field: keyof NewProductRow, val: any) => {
    setAddRows((prev) => { const u = [...prev]; u[i] = { ...u[i], [field]: val }; return u; });
  };
  const duplicateRow = (i: number) => {
    setAddRows((prev) => {
      const dup = { ...prev[i], serialNumber: "", qty: 0, batchNumber: "", weight: 0 };
      const u = [...prev]; u.splice(i + 1, 0, dup); return u;
    });
  };
  const removeRow = (i: number) => {
    setAddRows((prev) => prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i));
  };

  const filteredShipments = useMemo(() => {
    if (!addShipmentSearch) return storeShippings.slice(0, 50);
    const q = addShipmentSearch.toLowerCase();
    return storeShippings.filter((s: any) =>
      (s.VBShipmentNumber || "").toLowerCase().includes(q) || (s.svbid || "").toLowerCase().includes(q)
    ).slice(0, 50);
  }, [storeShippings, addShipmentSearch]);

  const shipmentSearchExactMatch = addShipmentSearch.trim()
    ? storeShippings.some((s: any) =>
        (s.VBShipmentNumber || "").toLowerCase() === addShipmentSearch.trim().toLowerCase()
      )
    : true;

  const handleCreateShipment = async (shipmentNumber: string) => {
    if (!shipmentNumber.trim()) return;
    // Open the full AddShippingDialog pre-filled with the typed number
    setCreateShipPresetNumber(shipmentNumber.trim().toUpperCase());
    setAddShipmentOpen(false); // close the picker dropdown
    setCreateShipDialogOpen(true);
  };

  const selectedShipment = storeShippings.find((s: any) => s._id === addShipmentId);
  const selectedShipmentLabel = selectedShipment
    ? (selectedShipment.VBShipmentNumber || selectedShipment.svbid || selectedShipment._id)
    : "";
  // Auto-derive supplier from selected shipment
  const derivedSupplierLabel = selectedShipment
    ? (selectedShipment._displaySupplier || selectedShipment.supplier || "")
    : "";

  // Auto-set supplier and products when a shipment is selected
  useEffect(() => {
    if (selectedShipment) {
      // Auto-set supplier
      const shipSupplier = typeof selectedShipment.supplier === "object"
        ? (selectedShipment.supplier as any)?._id
        : selectedShipment.supplier;
      if (shipSupplier) {
        setAddSupplierId(shipSupplier);
      }

      // Auto-populate product rows from the shipment's products
      const shipProducts = selectedShipment.products as any[];
      const displayProducts = (selectedShipment as any)._displayProducts as string[] | undefined;
      if (Array.isArray(shipProducts) && shipProducts.length > 0) {
        const newRows: NewProductRow[] = shipProducts.map((pid: any, idx: number) => {
          const productId = typeof pid === "object" ? pid._id || pid.toString() : String(pid);
          // Try to get display name from _displayProducts or from storeProducts
          const displayName = displayProducts?.[idx] || storeProducts.find((p: any) => p._id === productId)?.name || "";
          return {
            productId,
            productName: displayName,
            serialNumber: "",
            qty: 0,
            batchNumber: "",
            uom: "",
            weight: 0,
          };
        });
        setAddRows(newRows);
      }
    }
  }, [addShipmentId]);

  // ── Columns ──
  const columns: ColumnDef<TransferOrder>[] = [
    {
      id: "shipment", header: "Shipment #",
      accessorFn: (row) => resolveStr(row.vbShipmentNumber, "VBShipmentNumber") || resolveStr(row.vbShipmentNumber, "svbid"),
      cell: ({ row }) => {
        const val = resolveStr(row.original.vbShipmentNumber, "VBShipmentNumber") || resolveStr(row.original.vbShipmentNumber, "svbid");
        return <span className="font-mono font-semibold text-primary">{val}</span>;
      },
    },
    { id: "warehouse", header: "Warehouse", accessorFn: (row) => resolveStr(row.warehouse), cell: ({ row }) => resolveStr(row.original.warehouse) },
    {
      id: "product", header: "Product", accessorFn: (row) => resolveStr(row.product),
      cell: ({ row }) => {
        const p = row.original.product;
        if (typeof p === "object" && p) return <span>{p.name}{p.vbId && <span className="text-[10px] text-muted-foreground ml-1">({p.vbId})</span>}</span>;
        return resolveStr(p);
      },
    },
    { id: "supplier", header: "Supplier", accessorFn: (row) => resolveStr(row.supplier), cell: ({ row }) => resolveStr(row.original.supplier) },
    { accessorKey: "serialNumber", header: "Serial #", cell: ({ row }) => row.original.serialNumber || "-" },
    { accessorKey: "qty", header: "Qty", cell: ({ row }) => <span className="font-bold">{row.original.qty?.toLocaleString() || "-"}</span> },
    { accessorKey: "batchNumber", header: "Batch #", cell: ({ row }) => row.original.batchNumber || "-" },
    { accessorKey: "uom", header: "UOM", cell: ({ row }) => row.original.uom || "-" },
    { accessorKey: "weight", header: "Weight", cell: ({ row }) => row.original.weight || "-" },
    { id: "receivedDate", header: "Received Date", accessorFn: (row) => row.receivedDate ? new Date(row.receivedDate).getTime() : 0, cell: ({ row }) => formatDate(row.original.receivedDate) },
    { id: "createdBy", header: "Created By", accessorFn: (row) => resolveStr(row.createdBy), cell: ({ row }) => resolveStr(row.original.createdBy) },
    { id: "createdAt", header: "Created", accessorFn: (row) => row.createdAt ? new Date(row.createdAt).getTime() : 0, cell: ({ row }) => formatDate(row.original.createdAt) },
    {
      id: "actions", header: "",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); setEditingItem(row.original); }} className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setDeleteId(row.original._id); }} className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
      size: 80,
    },
  ];


  // Use refs to break the render cycle (setRightContent updates context → re-render → effect fires again)
  const headerRefs = useRef({ inputs, setFilter, resetFilters, hasActiveFilters, storeWarehouses, setAddOpen });
  headerRefs.current = { inputs, setFilter, resetFilters, hasActiveFilters, storeWarehouses, setAddOpen };

  // Derive a stable key that changes only when the actual values change
  const headerKey = `${inputs.search}|${inputs.warehouse}|${inputs.dateFrom}|${inputs.dateTo}|${hasActiveFilters}|${storeWarehouses.length}`;

  // Set right content with search, filters, and add button
  useEffect(() => {
    const { inputs: i, setFilter: sf, resetFilters: rf, hasActiveFilters: haf, storeWarehouses: sw, setAddOpen: sao } = headerRefs.current;
    setRightContent(
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="text"
          placeholder="Search..."
          value={i.search}
          onChange={(e) => sf("search", e.target.value)}
          className="h-8 w-[180px] rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <select
          value={i.warehouse}
          onChange={(e) => sf("warehouse", e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">All Warehouses</option>
          {sw.map((w: any) => (
            <option key={w._id} value={w._id}>{w.name}</option>
          ))}
        </select>
        <input
          type="date"
          value={i.dateFrom}
          onChange={(e) => sf("dateFrom", e.target.value)}
          className="h-8 w-[130px] text-xs rounded-md border border-input bg-background px-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          title="From Date"
        />
        <input
          type="date"
          value={i.dateTo}
          onChange={(e) => sf("dateTo", e.target.value)}
          className="h-8 w-[130px] text-xs rounded-md border border-input bg-background px-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          title="To Date"
        />
        {haf && (
          <button
            className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 rounded-md hover:bg-destructive/10 transition-colors"
            onClick={() => headerRefs.current.resetFilters()}
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
        )}
        <Button size="sm" className="flex items-center gap-1.5" onClick={() => headerRefs.current.setAddOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Transfer Order
        </Button>
      </div>
    );
  }, [headerKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <TablePageSkeleton />;

  return (
    <div className="w-full h-full">
      <SimpleDataTable columns={columns} data={filteredData} showColumnToggle={false} />

      {/* ── Add Transfer Order Dialog ── */}
      <Dialog open={addOpen} onOpenChange={(o) => { if (!o) { setAddOpen(false); resetAddForm(); } else setAddOpen(true); }}>
        <DialogContent className="max-w-5xl min-h-[550px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-primary" />
              Add Transfer Order
            </DialogTitle>
            <DialogDescription>Create one or more transfer order records.</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-5 p-1">
            <div className="grid grid-cols-2 gap-4">
              {/* Shipment picker */}
              <div className="space-y-1.5">
                <Label className="text-xs">Shipment # (optional)</Label>
                <div className="relative" ref={shipmentDropRef}>
                  <button
                    type="button"
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm flex items-center justify-between gap-1 hover:bg-muted/50 transition-colors"
                    onClick={() => { setAddShipmentOpen(!addShipmentOpen); setAddShipmentSearch(""); }}
                  >
                    <span className={selectedShipmentLabel ? "font-mono font-semibold text-primary" : "text-muted-foreground"}>
                      {selectedShipmentLabel || "Select shipment..."}
                    </span>
                    <div className="flex items-center gap-1">
                      {addShipmentId && <X className="h-3 w-3 text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); setAddShipmentId(""); }} />}
                      <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                    </div>
                  </button>
                  {addShipmentOpen && (
                    <div className="absolute z-50 top-full mt-1 left-0 w-full min-w-[240px] bg-popover border rounded-md shadow-lg overflow-hidden">
                      <div className="p-1.5 border-b">
                        <input
                          type="text"
                          autoFocus
                          placeholder="Search shipment..."
                          value={addShipmentSearch}
                          onChange={(e) => setAddShipmentSearch(e.target.value)}
                          className="w-full h-7 px-2 text-xs rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                      <div className="max-h-[200px] overflow-y-auto p-1">
                        {filteredShipments.length > 0 ? filteredShipments.map((s: any) => (
                          <button key={s._id} type="button"
                            className={`w-full text-left px-2 py-1.5 text-xs rounded-sm hover:bg-accent transition-colors flex items-center justify-between ${addShipmentId === s._id ? "bg-accent font-semibold" : ""}`}
                            onClick={() => { setAddShipmentId(s._id); setAddShipmentOpen(false); }}
                          >
                            <span className="font-mono">{s.VBShipmentNumber || s.svbid || s._id}</span>
                            {addShipmentId === s._id && <Check className="h-3 w-3 text-primary" />}
                          </button>
                        )) : (
                          <p className="text-[10px] text-muted-foreground text-center py-2">No shipments found</p>
                        )}
                        {addShipmentSearch.trim() && !shipmentSearchExactMatch && (
                          <>
                            {filteredShipments.length > 0 && <div className="border-t my-1" />}
                            <button
                              type="button"
                              disabled={createShipmentLoading}
                              className="w-full text-left px-2 py-1.5 text-xs rounded-sm hover:bg-accent transition-colors flex items-center gap-1.5 text-primary font-medium disabled:opacity-60"
                              onClick={() => handleCreateShipment(addShipmentSearch.trim())}
                            >
                              {createShipmentLoading
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : <Plus className="h-3 w-3" />
                              }
                              Create &ldquo;{addShipmentSearch.trim().toUpperCase()}&rdquo;
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Transfer Date */}
              <div className="space-y-1.5">
                <Label className="text-xs">Transfer Date</Label>
                <Input type="date" value={addTransferDate} onChange={(e) => setAddTransferDate(e.target.value)} className="h-9" />
              </div>

              {/* Warehouse */}
              <div className="space-y-1.5">
                <Label className="text-xs">Warehouse</Label>
                <SearchableSelect
                  value={addWarehouseId}
                  onChange={setAddWarehouseId}
                  options={storeWarehouses.map((w: any) => ({ value: w._id, label: w.name }))}
                  placeholder="— Select Warehouse —"
                />
              </div>

              {/* Supplier — auto-filled from shipment or manually selectable */}
              <div className="space-y-1.5">
                <Label className="text-xs">Supplier</Label>
                <SearchableSelect
                  value={addSupplierId}
                  onChange={setAddSupplierId}
                  options={storeSuppliers.map((s: any) => ({ value: s._id, label: s.name }))}
                  placeholder="— Select Supplier —"
                />
              </div>
            </div>

            {/* Products table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Products</p>
                <button type="button"
                  className="h-7 px-2 text-xs rounded-md border border-dashed border-primary/50 text-primary hover:bg-primary/10 transition-colors flex items-center gap-1"
                  onClick={() => setAddRows((prev) => [...prev, { productId: "", productName: "", serialNumber: "", qty: 0, batchNumber: "", uom: "", weight: 0 }])}
                >
                  <Plus className="h-3 w-3" /> Add Row
                </button>
              </div>
              <div className="border rounded-lg overflow-visible">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Product</th>
                      <th className="text-center px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-28">Serial #</th>
                      <th className="text-center px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-20">Qty</th>
                      <th className="text-center px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-28">Batch #</th>
                      <th className="text-center px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-28">UOM</th>
                      <th className="text-center px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-24">Weight</th>
                      <th className="w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {addRows.map((row, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="px-2 py-1.5">
                          <SearchableSelect
                            value={row.productId}
                            onChange={(val) => {
                              const prod = storeProducts.find((p: any) => p._id === val);
                              updateRow(i, "productId", val);
                              updateRow(i, "productName", prod?.name || "");
                            }}
                            options={storeProducts.map((p: any) => ({ value: p._id, label: p.name }))}
                            placeholder="— Select product —"
                            className="h-8"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input value={row.serialNumber} onChange={(e) => updateRow(i, "serialNumber", e.target.value)} className="h-8 text-center text-sm" placeholder="—" />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input type="number" min={0} value={row.qty || ""} onChange={(e) => updateRow(i, "qty", Number(e.target.value))} className="h-8 text-center text-sm" placeholder="0" />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input value={row.batchNumber} onChange={(e) => updateRow(i, "batchNumber", e.target.value)} className="h-8 text-center text-sm" placeholder="—" />
                        </td>
                        <td className="px-2 py-1.5">
                          <UomCombobox value={row.uom} onChange={(val) => updateRow(i, "uom", val)} options={uomOptions} onAddNew={(val) => setUomOptions((prev) => [...new Set([...prev, val])].sort())} />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input type="number" min={0} step="0.01" value={row.weight || ""} onChange={(e) => updateRow(i, "weight", Number(e.target.value))} className="h-8 text-center text-sm" placeholder="0" />
                        </td>
                        <td className="px-1 py-1.5">
                          <div className="flex items-center gap-0.5">
                            <button type="button" title="Duplicate row" className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" onClick={() => duplicateRow(i)}>
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                            {addRows.length > 1 && (
                              <button type="button" title="Remove row" className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" onClick={() => removeRow(i)}>
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t pt-4 mt-auto">
            <Button variant="outline" onClick={() => { setAddOpen(false); resetAddForm(); }}>Cancel</Button>
            <Button onClick={handleAddSave} disabled={addSaving}>
              {addSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Transfer Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Full Shipment Create Dialog ── */}
      <AddShippingDialog
        open={createShipDialogOpen}
        onClose={() => setCreateShipDialogOpen(false)}
        mode="standalone"
        editingData={createShipPresetNumber ? { VBShipmentNumber: createShipPresetNumber } : null}
        onSaved={async () => {
          // Refresh shipments cache, then auto-select the newly created one
          await queryClient.invalidateQueries({ queryKey: shippingKeys.all });
          // Find the newly created shipment by its number
          const refreshed = await fetch("/api/admin/vb-shipping").then(r => r.json()).catch(() => []);
          const match = Array.isArray(refreshed)
            ? refreshed.find((s: any) => s.VBShipmentNumber === createShipPresetNumber)
            : null;
          if (match) {
            setAddShipmentId(match._id);
            setAddShipmentSearch("");
          }
          setCreateShipPresetNumber("");
        }}
      />


      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transfer Order</AlertDialogTitle>
            <AlertDialogDescription>Are you sure? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteId && handleDelete(deleteId)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit */}
      <Dialog open={!!editingItem} onOpenChange={(open) => { if (!open) setEditingItem(null); }}>
        <DialogContent className="max-w-5xl min-h-[550px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              Edit Transfer Order
            </DialogTitle>
            <DialogDescription>Update the details of this transfer order.</DialogDescription>
          </DialogHeader>

          {editingItem && (
            <div className="flex-1 overflow-y-auto space-y-5 p-1">
              <div className="grid grid-cols-2 gap-4">
                {/* Shipment picker */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Shipment # (optional)</Label>
                  <SearchableSelect
                    value={editShipmentId}
                    onChange={setEditShipmentId}
                    options={storeShippings.map((s: any) => ({ value: s._id, label: s.VBShipmentNumber || s.svbid || s._id }))}
                    placeholder="Select shipment..."
                  />
                </div>

                {/* Transfer Date */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Transfer Date</Label>
                  <Input type="date" value={editTransferDate} onChange={(e) => setEditTransferDate(e.target.value)} className="h-9" />
                </div>

                {/* Warehouse */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Warehouse</Label>
                  <SearchableSelect
                    value={editWarehouseId}
                    onChange={setEditWarehouseId}
                    options={storeWarehouses.map((w: any) => ({ value: w._id, label: w.name }))}
                    placeholder="— Select Warehouse —"
                  />
                </div>

                {/* Supplier */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Supplier</Label>
                  <SearchableSelect
                    value={editSupplierId}
                    onChange={setEditSupplierId}
                    options={storeSuppliers.map((s: any) => ({ value: s._id, label: s.name }))}
                    placeholder="— Select Supplier —"
                  />
                </div>
              </div>

              {/* Product details */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Product</p>
                <div className="border rounded-lg overflow-visible">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Product</th>
                        <th className="text-center px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-28">Serial #</th>
                        <th className="text-center px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-20">Qty</th>
                        <th className="text-center px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-28">Batch #</th>
                        <th className="text-center px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-28">UOM</th>
                        <th className="text-center px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-24">Weight</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="px-2 py-1.5">
                          <SearchableSelect
                            value={editProductId}
                            onChange={setEditProductId}
                            options={storeProducts.map((p: any) => ({ value: p._id, label: p.name }))}
                            placeholder="— Select product —"
                            className="h-8"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input value={editSerialNumber} onChange={(e) => setEditSerialNumber(e.target.value)} className="h-8 text-center text-sm" placeholder="—" />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input type="number" min={0} value={editQty || ""} onChange={(e) => setEditQty(Number(e.target.value))} className="h-8 text-center text-sm" placeholder="0" />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input value={editBatchNumber} onChange={(e) => setEditBatchNumber(e.target.value)} className="h-8 text-center text-sm" placeholder="—" />
                        </td>
                        <td className="px-2 py-1.5">
                          <UomCombobox value={editUom} onChange={setEditUom} options={uomOptions} onAddNew={(val) => setUomOptions((prev) => [...new Set([...prev, val])].sort())} />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input type="number" min={0} step="0.01" value={editWeight || ""} onChange={(e) => setEditWeight(Number(e.target.value))} className="h-8 text-center text-sm" placeholder="0" />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="border-t pt-4 mt-auto">
            <Button variant="outline" onClick={() => setEditingItem(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={editSaving}>
              {editSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
