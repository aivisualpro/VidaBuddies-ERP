"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRightLeft, Check, ChevronDown, Copy, Loader2, Plus, X } from "lucide-react";
import { useWarehouses } from "@/hooks/queries/useWarehouses";
import { useProducts } from "@/hooks/queries/useProducts";
import { useSuppliers } from "@/hooks/queries/useSuppliers";
import { useShippings } from "@/hooks/queries/useShippings";
import { toast } from "sonner";

interface NewProductRow {
  productId: string;
  productName: string;
  serialNumber: string;
  qty: number;
  batchNumber: string;
  uom: string;
  weight: number;
}

/* ── Mini SearchableSelect (self-contained) ── */
function MiniSelect({ value, onChange, options, placeholder = "Select..." }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }; if (open) document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, [open]);
  const filtered = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()));
  const label = options.find(o => o.value === value)?.label || "";
  return (
    <div className="relative" ref={ref}>
      <button type="button" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm flex items-center justify-between gap-1 hover:bg-muted/50 transition-colors" onClick={() => { setOpen(!open); setSearch(""); }}>
        <span className={`truncate ${label ? "" : "text-muted-foreground"}`}>{label || placeholder}</span>
        <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 w-full min-w-[200px] bg-popover border rounded-md shadow-lg overflow-hidden">
          <div className="p-1.5 border-b"><input type="text" autoFocus placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="w-full h-7 px-2 text-xs rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring" /></div>
          <div className="max-h-[200px] overflow-y-auto p-1">
            {filtered.length > 0 ? filtered.map(opt => (
              <button key={opt.value} type="button" className={`w-full text-left px-2 py-1.5 text-xs rounded-sm hover:bg-accent transition-colors flex items-center justify-between ${value === opt.value ? "bg-accent font-semibold" : ""}`} onClick={() => { onChange(opt.value); setOpen(false); }}>
                <span className="truncate">{opt.label}</span>
                {value === opt.value && <Check className="h-3 w-3 text-primary shrink-0" />}
              </button>
            )) : <p className="text-[10px] text-muted-foreground text-center py-2">No matches</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export function AddTransferOrderDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; onSaved?: () => void }) {
  const { data: storeWarehouses = [] } = useWarehouses();
  const { data: storeProducts = [] } = useProducts();
  const { data: storeShippings = [] } = useShippings();
  const { data: storeSuppliers = [] } = useSuppliers();

  const [saving, setSaving] = useState(false);
  const [shipmentId, setShipmentId] = useState("");
  const [shipmentSearch, setShipmentSearch] = useState("");
  const [shipmentOpen, setShipmentOpen] = useState(false);
  const [warehouseId, setWarehouseId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split("T")[0]);
  const [rows, setRows] = useState<NewProductRow[]>([{ productId: "", productName: "", serialNumber: "", qty: 0, batchNumber: "", uom: "", weight: 0 }]);
  const shipRef = useRef<HTMLDivElement>(null);

  useEffect(() => { const h = (e: MouseEvent) => { if (shipRef.current && !shipRef.current.contains(e.target as Node)) setShipmentOpen(false); }; if (shipmentOpen) document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, [shipmentOpen]);

  const reset = () => { setShipmentId(""); setShipmentSearch(""); setWarehouseId(""); setSupplierId(""); setTransferDate(new Date().toISOString().split("T")[0]); setRows([{ productId: "", productName: "", serialNumber: "", qty: 0, batchNumber: "", uom: "", weight: 0 }]); };

  const filteredShipments = useMemo(() => {
    if (!shipmentSearch) return storeShippings.slice(0, 50);
    const q = shipmentSearch.toLowerCase();
    return storeShippings.filter((s: any) => (s.VBShipmentNumber || "").toLowerCase().includes(q) || (s.svbid || "").toLowerCase().includes(q)).slice(0, 50);
  }, [storeShippings, shipmentSearch]);

  const selectedShipment = storeShippings.find((s: any) => s._id === shipmentId);
  const selectedLabel = selectedShipment ? (selectedShipment.VBShipmentNumber || selectedShipment.svbid || selectedShipment._id) : "";

  // Auto-derive from shipment
  useEffect(() => {
    if (selectedShipment) {
      const sup = typeof selectedShipment.supplier === "object" ? (selectedShipment.supplier as any)?._id : selectedShipment.supplier;
      if (sup) setSupplierId(sup);
      const prods = selectedShipment.products as any[];
      if (Array.isArray(prods) && prods.length > 0) {
        setRows(prods.map((pid: any) => {
          const id = typeof pid === "object" ? pid._id || pid.toString() : String(pid);
          const name = storeProducts.find((p: any) => p._id === id)?.name || "";
          return { productId: id, productName: name, serialNumber: "", qty: 0, batchNumber: "", uom: "", weight: 0 };
        }));
      }
    }
  }, [shipmentId]);

  const updateRow = (i: number, field: keyof NewProductRow, val: any) => { setRows(prev => { const u = [...prev]; u[i] = { ...u[i], [field]: val }; return u; }); };
  const removeRow = (i: number) => { setRows(prev => prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)); };
  const duplicateRow = (i: number) => { setRows(prev => { const dup = { ...prev[i], serialNumber: "", qty: 0, batchNumber: "", weight: 0 }; const u = [...prev]; u.splice(i + 1, 0, dup); return u; }); };

  const handleSave = async () => {
    const valid = rows.filter(r => r.productId && r.qty > 0);
    if (valid.length === 0) { toast.error("Add at least one product with qty > 0"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/transfer-orders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vbShipmentNumber: shipmentId || null, warehouse: warehouseId || null, supplier: supplierId || null, transferDate, products: valid.map(r => ({ product: r.productId, serialNumber: r.serialNumber, qty: r.qty, batchNumber: r.batchNumber, uom: r.uom, weight: r.weight })) }),
      });
      if (!res.ok) throw new Error();
      toast.success("Transfer order(s) created");
      onOpenChange(false); reset(); onSaved?.();
    } catch { toast.error("Failed to create transfer order"); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onOpenChange(false); reset(); } else onOpenChange(true); }}>
      <DialogContent className="max-w-5xl min-h-[550px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ArrowRightLeft className="h-5 w-5 text-primary" /> Add Transfer Order</DialogTitle>
          <DialogDescription>Create one or more transfer order records.</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-5 p-1">
          <div className="grid grid-cols-2 gap-4">
            {/* Shipment picker */}
            <div className="space-y-1.5">
              <Label className="text-xs">Shipment # (optional)</Label>
              <div className="relative" ref={shipRef}>
                <button type="button" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm flex items-center justify-between gap-1 hover:bg-muted/50 transition-colors" onClick={() => { setShipmentOpen(!shipmentOpen); setShipmentSearch(""); }}>
                  <span className={selectedLabel ? "font-mono font-semibold text-primary" : "text-muted-foreground"}>{selectedLabel || "Select shipment..."}</span>
                  <div className="flex items-center gap-1">
                    {shipmentId && <X className="h-3 w-3 text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); setShipmentId(""); }} />}
                    <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                  </div>
                </button>
                {shipmentOpen && (
                  <div className="absolute z-50 top-full mt-1 left-0 w-full min-w-[240px] bg-popover border rounded-md shadow-lg overflow-hidden">
                    <div className="p-1.5 border-b"><input type="text" autoFocus placeholder="Search shipment..." value={shipmentSearch} onChange={e => setShipmentSearch(e.target.value)} className="w-full h-7 px-2 text-xs rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring" /></div>
                    <div className="max-h-[200px] overflow-y-auto p-1">
                      {filteredShipments.length > 0 ? filteredShipments.map((s: any) => (
                        <button key={s._id} type="button" className={`w-full text-left px-2 py-1.5 text-xs rounded-sm hover:bg-accent transition-colors flex items-center justify-between ${shipmentId === s._id ? "bg-accent font-semibold" : ""}`} onClick={() => { setShipmentId(s._id); setShipmentOpen(false); }}>
                          <span className="font-mono">{s.VBShipmentNumber || s.svbid || s._id}</span>
                          {shipmentId === s._id && <Check className="h-3 w-3 text-primary" />}
                        </button>
                      )) : <p className="text-[10px] text-muted-foreground text-center py-2">No shipments found</p>}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Transfer Date</Label><Input type="date" value={transferDate} onChange={e => setTransferDate(e.target.value)} className="h-9" /></div>
            <div className="space-y-1.5"><Label className="text-xs">Warehouse</Label><MiniSelect value={warehouseId} onChange={setWarehouseId} options={storeWarehouses.map((w: any) => ({ value: w._id, label: w.name }))} placeholder="— Select Warehouse —" /></div>
            <div className="space-y-1.5"><Label className="text-xs">Supplier</Label><MiniSelect value={supplierId} onChange={setSupplierId} options={storeSuppliers.map((s: any) => ({ value: s._id, label: s.name }))} placeholder="— Select Supplier —" /></div>
          </div>
          {/* Products */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Products</p>
              <button type="button" className="h-7 px-2 text-xs rounded-md border border-dashed border-primary/50 text-primary hover:bg-primary/10 transition-colors flex items-center gap-1" onClick={() => setRows(prev => [...prev, { productId: "", productName: "", serialNumber: "", qty: 0, batchNumber: "", uom: "", weight: 0 }])}><Plus className="h-3 w-3" /> Add Row</button>
            </div>
            <div className="border rounded-lg overflow-visible">
              <table className="w-full text-sm">
                <thead><tr className="bg-muted/50 border-b">
                  <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Product</th>
                  <th className="text-center px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-28">Serial #</th>
                  <th className="text-center px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-20">Qty</th>
                  <th className="text-center px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-28">Batch #</th>
                  <th className="text-center px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-24">Weight</th>
                  <th className="w-16"></th>
                </tr></thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="px-2 py-1.5"><MiniSelect value={row.productId} onChange={val => { const p = storeProducts.find((pr: any) => pr._id === val); updateRow(i, "productId", val); updateRow(i, "productName", p?.name || ""); }} options={storeProducts.map((p: any) => ({ value: p._id, label: p.name }))} placeholder="— Select product —" /></td>
                      <td className="px-2 py-1.5"><Input value={row.serialNumber} onChange={e => updateRow(i, "serialNumber", e.target.value)} className="h-8 text-center text-sm" placeholder="—" /></td>
                      <td className="px-2 py-1.5"><Input type="number" min={0} value={row.qty || ""} onChange={e => updateRow(i, "qty", Number(e.target.value))} className="h-8 text-center text-sm" placeholder="0" /></td>
                      <td className="px-2 py-1.5"><Input value={row.batchNumber} onChange={e => updateRow(i, "batchNumber", e.target.value)} className="h-8 text-center text-sm" placeholder="—" /></td>
                      <td className="px-2 py-1.5"><Input type="number" min={0} step="0.01" value={row.weight || ""} onChange={e => updateRow(i, "weight", Number(e.target.value))} className="h-8 text-center text-sm" placeholder="0" /></td>
                      <td className="px-1 py-1.5">
                        <div className="flex items-center gap-0.5">
                          <button type="button" title="Duplicate" className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" onClick={() => duplicateRow(i)}><Copy className="h-3.5 w-3.5" /></button>
                          {rows.length > 1 && <button type="button" title="Remove" className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" onClick={() => removeRow(i)}><X className="h-3.5 w-3.5" /></button>}
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
          <Button variant="outline" onClick={() => { onOpenChange(false); reset(); }}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Transfer Order</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
