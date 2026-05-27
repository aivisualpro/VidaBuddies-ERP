"use client";

import { useState, useEffect, useRef } from "react";
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
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2, Package, ArrowRightLeft, Calendar, Hash, Warehouse, Truck, ChevronDown, Plus, Check } from "lucide-react";

interface TransferProduct {
  product: string; // ObjectId
  productName: string;
  serialNumber: string;
  qty: number;
  batchNumber: string;
  uom: string;
  weight: number;
}

interface ExistingTransfer {
  _id: string;
  product: { _id: string; name: string; vbId?: string } | null;
  warehouse: { _id: string; name: string } | null;
  supplier: { _id: string; name: string; vbId?: string } | null;
  serialNumber: string;
  qty: number;
  batchNumber: string;
  uom: string;
  weight: number;
  receivedDate: string;
  createdBy: { _id: string; name: string; email?: string } | string | null;
  createdAt: string;
}

interface TransferOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shipmentId: string;
  /** Warehouse name resolved from VBSerialNumber.warehouse */
  warehouseName?: string;
  /** Warehouse ObjectId — if the CPO warehouse is an ObjectId ref */
  warehouseId?: string;
  /** Supplier ObjectId from vbshippings.supplier */
  supplierId?: string;
  /** Supplier name for display */
  supplierName?: string;
  /** Products array: [{_id, name}] from vbshippings.products (already resolved) */
  shipmentProducts?: { _id: string; name: string }[];
  /** VBShipmentNumber label for display */
  shipmentLabel?: string;
}

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

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const filtered = options.filter((o) =>
    o.toLowerCase().includes(search.toLowerCase())
  );
  const exactMatch = options.some((o) => o.toLowerCase() === search.toLowerCase());

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm text-center flex items-center justify-between gap-1 hover:bg-muted/50 transition-colors"
        onClick={() => { setOpen(!open); setSearch(""); }}
      >
        <span className={value ? "" : "text-muted-foreground"}>{value || "—"}</span>
        <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 w-[180px] bg-popover border rounded-md shadow-lg overflow-hidden">
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
                  className={`w-full text-left px-2 py-1.5 text-xs rounded-sm hover:bg-accent transition-colors flex items-center justify-between ${
                    value === opt ? "bg-accent font-semibold" : ""
                  }`}
                  onClick={() => {
                    onChange(opt);
                    setOpen(false);
                  }}
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
                  onClick={() => {
                    const val = search.trim().toUpperCase();
                    onAddNew(val);
                    onChange(val);
                    setOpen(false);
                  }}
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

export function TransferOrderDialog({
  open,
  onOpenChange,
  shipmentId,
  warehouseName = "",
  warehouseId = "",
  supplierId = "",
  supplierName = "",
  shipmentProducts = [],
  shipmentLabel = "",
}: TransferOrderDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existingTransfers, setExistingTransfers] = useState<ExistingTransfer[]>([]);
  const [hasExisting, setHasExisting] = useState(false);

  // Form state

  const [transferDate, setTransferDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [products, setProducts] = useState<TransferProduct[]>([]);

  // Fetch distinct UOM values from the collection
  const [uomOptions, setUomOptions] = useState<string[]>([]);
  useEffect(() => {
    fetch("/api/admin/transfer-orders/uoms")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setUomOptions(d); })
      .catch(() => {});
  }, []);

  // Fetch existing transfers when dialog opens
  useEffect(() => {
    if (!open || !shipmentId) return;

    const fetchExisting = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/admin/transfer-orders?shipmentId=${shipmentId}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data.length > 0) {
            setExistingTransfers(data);
            setHasExisting(true);
          } else {
            setHasExisting(false);
            setExistingTransfers([]);
            // Initialize products from shipment
            setProducts(
              shipmentProducts.map((p) => ({
                product: p._id,
                productName: p.name,
                serialNumber: "",
                qty: 0,
                batchNumber: "",
                uom: "",
                weight: 0,
              }))
            );
          }
        }
      } catch (error) {
        console.error("Failed to fetch transfer orders:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchExisting();

    setTransferDate(new Date().toISOString().split("T")[0]);
  }, [open, shipmentId]);

  const updateProduct = (
    index: number,
    field: keyof TransferProduct,
    value: any
  ) => {
    setProducts((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSave = async () => {
    // Validate at least one product has qty
    const hasQty = products.some((p) => p.qty > 0);
    if (!hasQty) {
      toast.error("Please enter qty for at least one product");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        vbShipmentNumber: shipmentId,
        warehouse: warehouseId || null,
        supplier: supplierId || null,
        transferDate,
        products: products
          .filter((p) => p.qty > 0) // Only send products with qty > 0
          .map((p) => ({
            product: p.product,
            serialNumber: p.serialNumber,
            qty: p.qty,
            batchNumber: p.batchNumber,
            uom: p.uom,
            weight: p.weight,
          })),
      };

      const res = await fetch("/api/admin/transfer-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to save");

      toast.success("Transfer order created successfully");

      // Refresh to show existing
      const freshRes = await fetch(
        `/api/admin/transfer-orders?shipmentId=${shipmentId}`
      );
      if (freshRes.ok) {
        const data = await freshRes.json();
        setExistingTransfers(data);
        setHasExisting(true);
      }
    } catch (error) {
      toast.error("Failed to create transfer order");
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            Transfer Order
            {shipmentLabel && (
              <span className="ml-2 text-xs font-mono px-2 py-0.5 rounded-md border border-border bg-muted/50">
                {shipmentLabel}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            {hasExisting
              ? `Showing ${existingTransfers.length} transfer record(s) for this shipment.`
              : "Create a transfer order to move inventory from this shipment."}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : hasExisting ? (
          /* ── EXISTING TRANSFERS VIEW ── */
          <div className="flex-1 max-h-[60vh] overflow-y-auto">
            <div className="space-y-3 p-1">
              {/* Summary Row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-muted/40 rounded-lg p-3 border">
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">Warehouse</p>
                  <p className="text-sm font-bold mt-0.5">{existingTransfers[0]?.warehouse?.name || warehouseName || "-"}</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-3 border">
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">Supplier</p>
                  <p className="text-sm font-bold mt-0.5">{existingTransfers[0]?.supplier?.name || supplierName || "-"}</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-3 border">
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">Serial Number</p>
                  <p className="text-sm font-bold mt-0.5">{existingTransfers[0]?.serialNumber || "-"}</p>
                </div>
              </div>

              <Separator />

              {/* Product Table */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Product</th>
                      <th className="text-center px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Qty</th>
                      <th className="text-center px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Batch #</th>
                      <th className="text-center px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">UOM</th>
                      <th className="text-center px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Weight</th>
                      <th className="text-center px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {existingTransfers.map((t, i) => (
                      <tr key={t._id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-3 py-2.5">
                          <span className="font-medium">{t.product?.name || "-"}</span>
                          {t.product?.vbId && (
                            <span className="text-[10px] text-muted-foreground ml-1.5">({t.product.vbId})</span>
                          )}
                        </td>
                        <td className="text-center px-3 py-2.5 font-bold">{t.qty}</td>
                        <td className="text-center px-3 py-2.5">{t.batchNumber || "-"}</td>
                        <td className="text-center px-3 py-2.5">{t.uom || "-"}</td>
                        <td className="text-center px-3 py-2.5">{t.weight || "-"}</td>
                        <td className="text-center px-3 py-2.5 text-xs text-muted-foreground">{formatDate(t.receivedDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-[10px] text-muted-foreground text-right">
                Created by {typeof existingTransfers[0]?.createdBy === 'object' && existingTransfers[0]?.createdBy ? (existingTransfers[0].createdBy as any).name || (existingTransfers[0].createdBy as any).email : existingTransfers[0]?.createdBy || "-"} on {formatDate(existingTransfers[0]?.createdAt)}
              </p>
            </div>
          </div>
        ) : (
          /* ── CREATE TRANSFER ORDER FORM ── */
          <div className="flex-1 max-h-[60vh] overflow-y-auto">
            <div className="space-y-5 p-1">
              {/* Auto-populated Info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/40 rounded-lg p-3 border">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Warehouse className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">Warehouse</p>
                  </div>
                  <p className="text-sm font-bold">{warehouseName || "-"}</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-3 border">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">Supplier</p>
                  </div>
                  <p className="text-sm font-bold">{supplierName || "-"}</p>
                </div>
              </div>

              {/* Manual fields */}
              <div className="space-y-1.5">
                <Label htmlFor="transferDate" className="text-xs flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" /> Transfer Date
                </Label>
                <Input
                  id="transferDate"
                  type="date"
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                  className="h-9 max-w-[200px]"
                />
              </div>

              <Separator />

              {/* Products Table */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Package className="h-4 w-4 text-primary" />
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Products</p>
                </div>
                <div className="border rounded-lg overflow-visible">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Product Name</th>
                        <th className="text-center px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-32">Serial #</th>
                        <th className="text-center px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-20">Qty</th>
                        <th className="text-center px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-28">Batch #</th>
                        <th className="text-center px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-24">UOM</th>
                        <th className="text-center px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-24">Weight</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.length > 0 ? (
                        products.map((p, i) => (
                          <tr key={p.product} className="border-b last:border-0">
                            <td className="px-3 py-2">
                              <span className="font-medium text-sm">{p.productName}</span>
                            </td>
                            <td className="px-2 py-1.5">
                              <Input
                                value={p.serialNumber}
                                onChange={(e) => updateProduct(i, "serialNumber", e.target.value)}
                                className="h-8 text-center text-sm"
                                placeholder="—"
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <Input
                                type="number"
                                min={0}
                                value={p.qty || ""}
                                onChange={(e) => updateProduct(i, "qty", Number(e.target.value))}
                                className="h-8 text-center text-sm"
                                placeholder="0"
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <Input
                                value={p.batchNumber}
                                onChange={(e) => updateProduct(i, "batchNumber", e.target.value)}
                                className="h-8 text-center text-sm"
                                placeholder="—"
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <UomCombobox
                                value={p.uom}
                                onChange={(val) => updateProduct(i, "uom", val)}
                                options={uomOptions}
                                onAddNew={(val) => setUomOptions((prev) => [...new Set([...prev, val])].sort())}
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <Input
                                type="number"
                                min={0}
                                step="0.01"
                                value={p.weight || ""}
                                onChange={(e) => updateProduct(i, "weight", Number(e.target.value))}
                                className="h-8 text-center text-sm"
                                placeholder="0"
                              />
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="text-center py-8 text-muted-foreground text-sm">
                            No products found in this shipment
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="border-t pt-4 mt-auto">
          {hasExisting ? (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Transfer Order
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
