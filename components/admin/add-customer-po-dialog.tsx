"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { toast } from "sonner";
import { usePurchaseOrders } from "@/hooks/queries/usePurchaseOrders";
import { useCustomers } from "@/hooks/queries/useCustomers";
import { useWarehouses } from "@/hooks/queries/useWarehouses";
import { useProducts } from "@/hooks/queries/useProducts";
import { useQueryClient } from "@tanstack/react-query";
import { purchaseOrderKeys } from "@/hooks/queries/usePurchaseOrders";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/* ──────────────────────────────────────────────────────────────
 * Shared UOM options — single source of truth
 * ────────────────────────────────────────────────────────────── */
export const UOM_OPTIONS = [
  { value: "EA", label: "EA (Each)" },
  { value: "CS", label: "CS (Case)" },
  { value: "PL", label: "PL (Pallet)" },
  { value: "DR", label: "DR (Drum)" },
  { value: "GL", label: "GL (Gallon)" },
  { value: "LB", label: "LB (Pound)" },
  { value: "KG", label: "KG (Kilogram)" },
  { value: "LT", label: "LT (Liter)" },
  { value: "BX", label: "BX (Box)" },
  { value: "BG", label: "BG (Bag)" },
  { value: "RL", label: "RL (Roll)" },
  { value: "FT", label: "FT (Foot)" },
  { value: "MT", label: "MT (Meter)" },
  { value: "PC", label: "PC (Piece)" },
  { value: "SET", label: "SET" },
  { value: "TON", label: "TON" },
];

/* ──────────────────────────────────────────────────────────────
 * Props
 * ────────────────────────────────────────────────────────────── */
export interface AddCustomerPODialogProps {
  open: boolean;
  onClose: () => void;
  /** Pre-selected VB PO ID (for PO-detail context) */
  defaultVbpoId?: string;
  /** Editing existing record — if supplied, dialog is in EDIT mode */
  editingData?: Record<string, any> | null;
  /**
   * "standalone" → writes to /api/admin/vb-customer-po
   * "embedded"   → pushes into the parent PO's nested customerPO array
   * Default: "standalone"
   */
  mode?: "standalone" | "embedded";
  /** Called after successful save so parent can refetch data */
  onSaved?: () => void;
  /** For auto PO # generation — all existing CPOs for counting */
  existingCPOs?: { VBNumber?: string }[];
}

export function AddCustomerPODialog({
  open,
  onClose,
  defaultVbpoId,
  editingData,
  mode = "standalone",
  onSaved,
  existingCPOs = [],
}: AddCustomerPODialogProps) {
  const { data: purchaseOrders = [] } = usePurchaseOrders();
  const { data: customers = [] } = useCustomers();
  const { data: warehouses = [] } = useWarehouses();
  const { data: products = [] } = useProducts();
  const queryClient = useQueryClient();

  const [actionLoading, setActionLoading] = useState(false);
  const [selectedVBPO, setSelectedVBPO] = useState("");
  const [poNo, setPoNo] = useState("");
  const [customerPONo, setCustomerPONo] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [selectedUOM, setSelectedUOM] = useState("");
  const [customerPODate, setCustomerPODate] = useState("");
  const [requestedDeliveryDate, setRequestedDeliveryDate] = useState("");
  const [qtyOrdered, setQtyOrdered] = useState("");
  const [qtyReceived, setQtyReceived] = useState(0);
  const [isDirectShipment, setIsDirectShipment] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [productPopoverOpen, setProductPopoverOpen] = useState(false);
  const productListRef = useRef<HTMLDivElement>(null);

  /* ──── Options ──── */
  const vbpoOptions = useMemo(
    () =>
      (purchaseOrders || []).map((po: any) => ({
        value: po._id || "",
        label: po.VBNumber || po.vbpoNo || "—",
      })),
    [purchaseOrders]
  );

  const customerOptions = useMemo(
    () =>
      (customers || []).map((c: any) => ({
        value: c._id,
        label: c.name || c.companyName || c.email || c.vbId,
      })),
    [customers]
  );

  const locationOptions = useMemo(() => {
    const selected = (customers || []).find(
      (c: any) => c._id === selectedCustomer
    );
    if (selected?.location?.length) {
      return selected.location.map((l: any) => ({
        value: l._id,
        label: l.locationName || l.vbId,
      }));
    }
    // Fallback — show all locations
    const all: { value: string; label: string }[] = [];
    (customers || []).forEach((c: any) => {
      (c.location || []).forEach((l: any) => {
        if (l._id)
          all.push({ value: l._id, label: l.locationName || l.vbId });
      });
    });
    return all;
  }, [customers, selectedCustomer]);

  const warehouseOptions = useMemo(
    () =>
      (warehouses || []).map((w: any) => ({
        value: w._id,
        label: w.name,
      })),
    [warehouses]
  );

  const productOptions = useMemo(
    () =>
      (products || []).map((p: any) => ({
        value: p._id as string,
        label: p.name || p.vbId || p._id,
      })),
    [products]
  );

  const filteredProductOptions = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return productOptions;
    return productOptions.filter((o) => o.label.toLowerCase().includes(q));
  }, [productOptions, productSearch]);

  const toggleProduct = (id: string) => {
    setSelectedProducts((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const removeProduct = (id: string) => {
    setSelectedProducts((prev) => prev.filter((p) => p !== id));
  };

  /* ──── Reset form on open / edit change ──── */
  useEffect(() => {
    if (!open) return;
    if (editingData) {
      setSelectedVBPO(editingData.VBNumber || "");
      setPoNo(editingData.VBSerialNumber || "");
      setCustomerPONo(editingData.customerPONo || "");
      setSelectedCustomer(editingData.customer || "");
      setSelectedLocation(editingData.customerLocation || "");
      setSelectedWarehouse(editingData.warehouse || "");
      setSelectedUOM(editingData.UOM || "");
      setCustomerPODate(
        editingData.customerPODate
          ? new Date(editingData.customerPODate).toISOString().split("T")[0]
          : ""
      );
      setRequestedDeliveryDate(
        editingData.requestedDeliveryDate
          ? new Date(editingData.requestedDeliveryDate)
              .toISOString()
              .split("T")[0]
          : ""
      );
      setQtyOrdered(editingData.qtyOrdered?.toString() || "");
      setQtyReceived(editingData.qtyReceived || 0);
      setIsDirectShipment(!!editingData.isDirectShipment);
      setSelectedProducts(
        Array.isArray(editingData.products)
          ? editingData.products.map((p: any) => (typeof p === "string" ? p : p?._id?.toString() || p?.toString()))
          : []
      );
    } else {
      setSelectedVBPO(defaultVbpoId || "");
      // Auto-generate Contract # when a default VB PO is provided
      if (defaultVbpoId) {
        const matchedPO = (purchaseOrders || []).find(
          (p: any) => p._id === defaultVbpoId
        );
        const displayName = matchedPO?.VBNumber || defaultVbpoId;
        const count = existingCPOs.filter(
          (cpo) => cpo.VBNumber === defaultVbpoId
        ).length;
        setPoNo(`${displayName}-${count + 1}`);
      } else {
        setPoNo("");
      }
      setCustomerPONo("");
      setSelectedCustomer("");
      setSelectedLocation("");
      setSelectedWarehouse("");
      setSelectedUOM("");
      setCustomerPODate("");
      setRequestedDeliveryDate("");
      setQtyOrdered("");
      setQtyReceived(0);
      setSelectedProducts([]);
      setIsDirectShipment(false);
    }
    setProductSearch("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingData, defaultVbpoId]);

  /* ──── Auto-select single location when customer changes ──── */
  useEffect(() => {
    if (selectedCustomer) {
      const cust = (customers || []).find(
        (c: any) => c._id === selectedCustomer
      );
      if (cust?.location?.length === 1 && !editingData) {
        setSelectedLocation(cust.location[0]._id);
      } else if (!editingData) {
        setSelectedLocation("");
      }
    } else if (!editingData) {
      setSelectedLocation("");
    }
  }, [selectedCustomer, customers]);

  /* ──── Auto PO # when VB PO changes (new records only) ──── */
  const handleVBPOChange = (val: string) => {
    setSelectedVBPO(val);
    if (!editingData && val) {
      // val is now the VidaPO _id — find the display name (VBNumber) for generating the serial
      const matchedPO = (purchaseOrders || []).find((p: any) => p._id === val);
      const displayName = matchedPO?.VBNumber || val;
      const count = existingCPOs.filter((cpo) => cpo.VBNumber === val).length;
      setPoNo(`${displayName}-${count + 1}`);
    } else if (!val) {
      setPoNo("");
    }
  };

  /* ──── Save ──── */
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);

    // selectedVBPO is now the VidaPO _id directly
    const matchedPO = (purchaseOrders || []).find(
      (p: any) => p._id === selectedVBPO
    );

    const payload: Record<string, any> = {
      VBNumber: selectedVBPO || null,                   // vidapos._id as ObjectId
      VBSerialNumber: poNo,                           // e.g. "VB-1"
      customerPONo,
      customer: selectedCustomer,
      customerLocation: selectedLocation,
      warehouse: isDirectShipment ? null : (selectedWarehouse || null),
      UOM: selectedUOM,
      customerPODate: customerPODate || undefined,
      requestedDeliveryDate: requestedDeliveryDate || undefined,
      qtyOrdered: Number(qtyOrdered) || 0,
      qtyReceived,
      products: selectedProducts,
      isDirectShipment,
    };

    try {
      if (mode === "standalone") {
        const url = editingData?._id
          ? `/api/admin/vb-customer-po/${editingData._id}`
          : "/api/admin/vb-customer-po";
        const method = editingData?._id ? "PUT" : "POST";

        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed");
        toast.success(
          editingData ? "Customer PO updated" : "Customer PO created"
        );
      } else {
        // Embedded mode — push into parent PO
        const targetPO = (purchaseOrders || []).find(
          (p: any) => p._id === selectedVBPO
        );
        if (!targetPO) {
          toast.error("Parent PO not found");
          setActionLoading(false);
          return;
        }
        const updatedPO = JSON.parse(JSON.stringify(targetPO));
        if (!updatedPO.customerPO) updatedPO.customerPO = [];
        updatedPO.customerPO.unshift({
          _id: Math.random().toString(36).substr(2, 9),
          ...payload,
          shipping: [],
        });
        const res = await fetch(
          `/api/admin/purchase-orders/${targetPO._id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatedPO),
          }
        );
        if (!res.ok) throw new Error("Failed");
        toast.success("Customer PO added");
        queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.all });
      }

      onSaved?.();
      onClose();
    } catch {
      toast.error("An error occurred");
    } finally {
      setActionLoading(false);
    }
  };

  const isEditing = !!editingData;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="max-w-2xl overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Customer PO" : "Add Customer PO"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isEditing
              ? "Update customer PO details"
              : "Create a new customer PO"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="grid gap-5 py-4">
          {/* Row 1: VB Number (PO) + VB Serial Number */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label>VB # (from Purchase Orders)</Label>
              <SearchableSelect
                options={vbpoOptions}
                value={selectedVBPO}
                onChange={handleVBPOChange}
                placeholder="Select VB PO..."
                searchPlaceholder="Search PO numbers..."
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Contract #</Label>
              <Input
                value={poNo}
                onChange={(e) => setPoNo(e.target.value)}
                placeholder="Auto-generated"
              />
            </div>
          </div>

          {/* Row 2: Customer + Location */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label>Customer</Label>
              <SearchableSelect
                options={customerOptions}
                value={selectedCustomer}
                onChange={(val) => {
                  setSelectedCustomer(val);
                  if (!editingData) setSelectedLocation("");
                }}
                placeholder="Select Customer"
                searchPlaceholder="Search customers..."
                emptyMessage="No customers found."
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Customer Location</Label>
              <SearchableSelect
                options={locationOptions}
                value={selectedLocation}
                onChange={setSelectedLocation}
                placeholder="Select Location"
                searchPlaceholder="Search locations..."
                emptyMessage="No locations found."
              />
            </div>
          </div>

          {/* Row 3: Customer PO # + Customer PO Date */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label>Customer PO #</Label>
              <Input
                value={customerPONo}
                onChange={(e) => setCustomerPONo(e.target.value)}
                placeholder="e.g. CPO-2024-001"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Customer PO Date</Label>
              <Input
                type="date"
                value={customerPODate}
                onChange={(e) => setCustomerPODate(e.target.value)}
              />
            </div>
          </div>

          {/* Row 4: Delivery Date + UOM */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label>Requested Delivery Date</Label>
              <Input
                type="date"
                value={requestedDeliveryDate}
                onChange={(e) => setRequestedDeliveryDate(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>UOM</Label>
              <SearchableSelect
                options={UOM_OPTIONS}
                value={selectedUOM}
                onChange={setSelectedUOM}
                placeholder="Select UOM"
                searchPlaceholder="Search units..."
                emptyMessage="No units found."
              />
            </div>
          </div>

          {/* Products multi-select */}
          <div className="grid gap-1.5">
            <Label>Products</Label>
            <Popover
              open={productPopoverOpen}
              onOpenChange={(v) => { setProductPopoverOpen(v); if (!v) setProductSearch(""); }}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={productPopoverOpen}
                  className="w-full justify-between h-9 px-3 text-sm font-normal bg-background"
                >
                  <span className={cn("truncate", selectedProducts.length === 0 && "text-muted-foreground")}>
                    {selectedProducts.length === 0
                      ? "Select products…"
                      : `${selectedProducts.length} product${selectedProducts.length > 1 ? "s" : ""} selected`}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[--radix-popover-trigger-width] p-0"
                align="start"
                onWheel={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
              >
                <div className="flex flex-col">
                  {/* Search */}
                  <div className="flex items-center border-b px-3">
                    <svg className="mr-2 h-4 w-4 shrink-0 opacity-50" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                    <input
                      className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                      placeholder="Search products…"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      autoFocus
                    />
                    {productSearch && (
                      <button onClick={() => setProductSearch("")} className="text-muted-foreground hover:text-foreground p-1">
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  {/* Options */}
                  <div
                    ref={productListRef}
                    className="max-h-[200px] overflow-y-auto overflow-x-hidden scrollbar-thin"
                  >
                    {filteredProductOptions.length === 0 ? (
                      <div className="py-6 text-center text-sm text-muted-foreground">No products found.</div>
                    ) : (
                      filteredProductOptions.map((opt) => {
                        const isSelected = selectedProducts.includes(opt.value);
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => toggleProduct(opt.value)}
                            className={cn(
                              "relative flex w-full cursor-pointer select-none items-center rounded-sm px-3 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground",
                              isSelected && "bg-accent"
                            )}
                          >
                            <Check className={cn("mr-2 h-4 w-4 shrink-0", isSelected ? "opacity-100" : "opacity-0")} />
                            <span className="truncate">{opt.label}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Selected pills */}
            {selectedProducts.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {selectedProducts.map((id) => {
                  const label = productOptions.find((o) => o.value === id)?.label || id;
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs font-medium px-2.5 py-0.5"
                    >
                      {label}
                      <button
                        type="button"
                        onClick={() => removeProduct(id)}
                        className="ml-0.5 hover:text-destructive transition-colors"
                        aria-label={`Remove ${label}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Row: Qty Ordered + Direct Shipment + Warehouse */}
          <div className="grid gap-4" style={{ gridTemplateColumns: isDirectShipment ? '1fr 1fr' : '1fr 1fr 1fr' }}>
            <div className="grid gap-1.5">
              <Label>Qty Ordered</Label>
              <Input
                type="number"
                min="0"
                value={qtyOrdered}
                onChange={(e) => setQtyOrdered(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Direct Shipment</Label>
              <div className="flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3">
                <button
                  type="button"
                  id="direct-shipment-no"
                  onClick={() => { setIsDirectShipment(false); }}
                  className={cn(
                    "flex-1 rounded py-0.5 text-sm font-medium transition-colors",
                    !isDirectShipment
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  No
                </button>
                <button
                  type="button"
                  id="direct-shipment-yes"
                  onClick={() => { setIsDirectShipment(true); setSelectedWarehouse(""); }}
                  className={cn(
                    "flex-1 rounded py-0.5 text-sm font-medium transition-colors",
                    isDirectShipment
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Yes
                </button>
              </div>
            </div>
            {!isDirectShipment && (
              <div className="grid gap-1.5">
                <Label>Warehouse</Label>
                <SearchableSelect
                  options={warehouseOptions}
                  value={selectedWarehouse}
                  onChange={setSelectedWarehouse}
                  placeholder="Select Warehouse"
                  searchPlaceholder="Search warehouses..."
                  emptyMessage="No warehouses found."
                />
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:space-x-0">
            <Button
              variant="outline"
              type="button"
              onClick={onClose}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={actionLoading}>
              {actionLoading
                ? "Saving..."
                : isEditing
                ? "Save Changes"
                : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
