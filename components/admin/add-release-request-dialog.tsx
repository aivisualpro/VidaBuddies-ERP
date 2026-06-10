"use client";

import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Check, ChevronsUpDown, Hash, MapPin, Plus, Truck, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProducts } from "@/hooks/queries/useProducts";
import { useWarehouses } from "@/hooks/queries/useWarehouses";
import { useCustomers } from "@/hooks/queries/useCustomers";
import { useUsers } from "@/hooks/queries/useUsers";
import { useCarriers } from "@/hooks/queries/useCarriers";
import { useCustomerPOs } from "@/hooks/queries/useCustomerPOs";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

/* ── Mini ProductCombobox (self-contained) ── */
function ProductCombobox({ products, value, onChange }: { products: any[]; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const label = products.find(p => p._id === value)?.name || "";
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal h-8 text-sm">
          <span className="truncate">{label || "Select product..."}</span>
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search products..." value={search} onValueChange={setSearch} />
          <CommandList className="pointer-events-auto" onWheel={e => e.stopPropagation()} onTouchMove={e => e.stopPropagation()}>
            <CommandEmpty>No products found.</CommandEmpty>
            <CommandGroup>
              {products.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase())).slice(0, 50).map((p: any) => (
                <CommandItem key={p._id} value={p._id} onSelect={() => { onChange(p._id); setOpen(false); setSearch(""); }}>
                  <Check className={cn("mr-2 h-4 w-4", value === p._id ? "opacity-100" : "opacity-0")} />
                  {p.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface ReleaseFormData {
  poNo: string;
  transferOrder: string;
  date: string;
  warehouse: string;
  requestedBy: string;
  customer: string;
  contact: string;
  releaseOrderProducts: { product: string; qty: number; lotSerial: string }[];
  hasPickupInfo: boolean;
  carrier: string;
  requestedPickupTime: string;
  scheduledPickupDate: string;
  scheduledPickupTime: string;
  instructions: string;
}

const defaultFormData: ReleaseFormData = {
  poNo: "", transferOrder: "", date: new Date().toISOString().split("T")[0], warehouse: "", requestedBy: "", customer: "", contact: "",
  releaseOrderProducts: [{ product: "", qty: 0, lotSerial: "" }, { product: "", qty: 0, lotSerial: "" }, { product: "", qty: 0, lotSerial: "" }],
  hasPickupInfo: false, carrier: "", requestedPickupTime: "", scheduledPickupDate: "", scheduledPickupTime: "", instructions: ""
};

export function AddReleaseRequestDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; onSaved?: () => void }) {
  const { data: products = [] } = useProducts();
  const { data: warehouses = [] } = useWarehouses();
  const { data: customers = [] } = useCustomers();
  const { data: users = [] } = useUsers();
  const { data: carriers = [] } = useCarriers();
  const { data: customerPOs = [] } = useCustomerPOs();
  const queryClient = useQueryClient();
  const refetchCarriers = () => queryClient.invalidateQueries({ queryKey: ["carriers"] });

  const [formData, setFormData] = useState<ReleaseFormData>({ ...defaultFormData });
  const [carrierSearch, setCarrierSearch] = useState("");
  const [carrierPopoverOpen, setCarrierPopoverOpen] = useState(false);
  const [cpoSearch, setCpoSearch] = useState("");
  const [cpoPopoverOpen, setCpoPopoverOpen] = useState(false);
  const [toSearch, setToSearch] = useState("");
  const [toPopoverOpen, setToPopoverOpen] = useState(false);

  // Transfer orders — for Shipment # picker
  const [uniqueShipments, setUniqueShipments] = useState<any[]>([]);
  useEffect(() => {
    if (!open) return;
    fetch("/api/admin/transfer-orders").then(r => r.json()).then(d => {
      if (!Array.isArray(d)) return;
      const seen = new Map<string, any>();
      for (const to of d) {
        const ship = to.vbShipmentNumber;
        if (!ship) continue;
        const shipId = typeof ship === "object" ? ship._id : ship;
        if (shipId && !seen.has(String(shipId))) {
          seen.set(String(shipId), {
            shipId: String(shipId),
            label: typeof ship === "object" ? (ship.VBShipmentNumber || ship.svbid || String(shipId)) : String(shipId),
          });
        }
      }
      setUniqueShipments(Array.from(seen.values()));
    }).catch(() => {});
  }, [open]);

  const reset = () => { setFormData({ ...defaultFormData }); };
  const selectedCustomer = customers.find(c => c._id === formData.customer);

  const updateProductRow = (i: number, field: string, value: any) => {
    const rows = [...formData.releaseOrderProducts]; rows[i] = { ...rows[i], [field]: value }; setFormData({ ...formData, releaseOrderProducts: rows });
  };
  const addProductRow = () => { setFormData({ ...formData, releaseOrderProducts: [...formData.releaseOrderProducts, { product: "", qty: 0, lotSerial: "" }] }); };
  const removeProductRow = (i: number) => { if (formData.releaseOrderProducts.length > 1) { const rows = [...formData.releaseOrderProducts]; rows.splice(i, 1); setFormData({ ...formData, releaseOrderProducts: rows }); } };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...formData, releaseOrderProducts: formData.releaseOrderProducts.filter(p => p.product) };
    if (!payload.releaseOrderProducts.length) { toast.error("Please add at least one product"); return; }
    try {
      const res = await fetch("/api/admin/release-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error();
      toast.success("Release request created");
      onOpenChange(false); reset(); onSaved?.();
    } catch { toast.error("Failed to create release request"); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onOpenChange(false); reset(); } else onOpenChange(true); }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Release Request</DialogTitle>
          <DialogDescription>Fill in the details below to create a release request.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-8 py-4">
          {/* General Info */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2"><Hash className="w-4 h-4" /> General Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2"><Label>Date</Label><Input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} required /></div>
              <div className="space-y-2">
                <Label>Shipment #</Label>
                <Popover open={toPopoverOpen} onOpenChange={setToPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                      <span className="truncate">{formData.transferOrder ? (uniqueShipments.find((s: any) => s.shipId === formData.transferOrder)?.label || "Selected") : "Select Shipment..."}</span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput placeholder="Search shipments..." value={toSearch} onValueChange={setToSearch} />
                      <CommandList className="pointer-events-auto" onWheel={e => e.stopPropagation()} onTouchMove={e => e.stopPropagation()}>
                        <CommandEmpty>No shipments found.</CommandEmpty>
                        <CommandGroup>
                          {uniqueShipments.filter((s: any) => !toSearch || s.label.toLowerCase().includes(toSearch.toLowerCase())).slice(0, 50).map((s: any) => (
                            <CommandItem key={s.shipId} value={s.shipId} onSelect={async () => { setFormData({ ...formData, transferOrder: s.shipId }); setToPopoverOpen(false); setToSearch(""); try { const res = await fetch('/api/admin/inventory-management'); const invData = await res.json(); if (Array.isArray(invData)) { const matching = invData.filter((row: any) => { const sid = row.vbShipmentNumber?._id ? String(row.vbShipmentNumber._id) : String(row.vbShipmentNumber || ''); return sid === s.shipId && (row.availableQty || 0) > 0; }); if (matching.length > 0) { const autoProducts = matching.map((row: any) => ({ product: row.product?._id ? String(row.product._id) : String(row.product || ''), qty: row.availableQty || 0, lotSerial: row.serialNumber || '' })); const whId = matching[0].warehouse?._id ? String(matching[0].warehouse._id) : String(matching[0].warehouse || ''); setFormData(prev => ({ ...prev, transferOrder: s.shipId, warehouse: whId || prev.warehouse, releaseOrderProducts: autoProducts })); } } } catch {} }}>
                              <Check className={cn("mr-2 h-4 w-4", formData.transferOrder === s.shipId ? "opacity-100" : "opacity-0")} />
                              <span className="font-mono">{s.label}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Warehouse</Label>
                <Select value={formData.warehouse} onValueChange={val => setFormData({ ...formData, warehouse: val })} required>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select Warehouse" /></SelectTrigger>
                  <SelectContent>{warehouses.map(w => <SelectItem key={w._id} value={w._id}>{w.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Requested By</Label>
                <Select value={formData.requestedBy} onValueChange={val => setFormData({ ...formData, requestedBy: val })}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select User" /></SelectTrigger>
                  <SelectContent>{users.map(u => <SelectItem key={u._id} value={u._id}>{u.name || u.email}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Customer</Label>
                <Select value={formData.customer} onValueChange={val => setFormData({ ...formData, customer: val, contact: "" })} required>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select Customer" /></SelectTrigger>
                  <SelectContent>{customers.map(c => <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Contact / Location</Label>
                <Select value={formData.contact} onValueChange={val => { const loc = selectedCustomer?.location?.find((l: any) => l._id === val); setFormData({ ...formData, contact: loc?.locationName || loc?.fullAddress || val }); }} disabled={!selectedCustomer}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select Location" /></SelectTrigger>
                  <SelectContent>{selectedCustomer?.location?.map((loc: any, i: number) => <SelectItem key={`loc-${i}`} value={loc._id || `loc-${i}`}>{loc.locationName || loc.fullAddress || `Location ${i + 1}`}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Customer PO #</Label>
                <Popover open={cpoPopoverOpen} onOpenChange={setCpoPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                      <span className="truncate">{formData.poNo ? (customerPOs.find((c: any) => c._id === formData.poNo)?.customerPONo || String(formData.poNo)) : "Select or type Customer PO..."}</span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput placeholder="Search or type PO #..." value={cpoSearch} onValueChange={setCpoSearch} />
                      <CommandList className="pointer-events-auto" onWheel={e => e.stopPropagation()} onTouchMove={e => e.stopPropagation()}>
                        {cpoSearch && !customerPOs.find((c: any) => (c.customerPONo || "").toLowerCase() === cpoSearch.toLowerCase()) && (
                          <CommandItem value={`custom:${cpoSearch}`} onSelect={() => { setFormData({ ...formData, poNo: cpoSearch }); setCpoPopoverOpen(false); setCpoSearch(""); }}>
                            <span className="text-muted-foreground mr-2">Use:</span><span className="font-semibold">&quot;{cpoSearch}&quot;</span>
                          </CommandItem>
                        )}
                        <CommandGroup heading="From Customer POs">
                          {customerPOs.filter((c: any) => !cpoSearch || (c.customerPONo || "").toLowerCase().includes(cpoSearch.toLowerCase())).slice(0, 50).map((c: any) => (
                            <CommandItem key={c._id} value={c._id} onSelect={() => { setFormData({ ...formData, poNo: c._id }); setCpoPopoverOpen(false); setCpoSearch(""); }}>
                              <Check className={cn("mr-2 h-4 w-4", formData.poNo === c._id ? "opacity-100" : "opacity-0")} />
                              <span>{c.customerPONo || c.VBSerialNumber || c._id}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          {/* Products */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg flex items-center gap-2"><X className="w-4 h-4" /> Order Details</h3>
              <Button type="button" size="sm" variant="outline" onClick={addProductRow}><Plus className="w-4 h-4 mr-2" /> Add Product</Button>
            </div>
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50"><tr><th className="p-3 text-left w-[40%]">Product</th><th className="p-3 text-left w-[20%]">Release Qty</th><th className="p-3 text-left w-[30%]">Lot / Serial #</th><th className="p-3 w-[10%]"></th></tr></thead>
                <tbody className="divide-y">
                  {formData.releaseOrderProducts.map((row, i) => (
                    <tr key={i} className="bg-background">
                      <td className="p-2"><ProductCombobox products={products} value={row.product} onChange={val => updateProductRow(i, "product", val)} /></td>
                      <td className="p-2"><Input type="number" value={row.qty} onChange={e => updateProductRow(i, "qty", Number(e.target.value))} className="h-8 shadow-none" /></td>
                      <td className="p-2"><Input value={row.lotSerial} onChange={e => updateProductRow(i, "lotSerial", e.target.value)} className="h-8 shadow-none" /></td>
                      <td className="p-2 text-center"><Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500" onClick={() => removeProductRow(i)}><X className="w-4 h-4" /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pickup */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg flex items-center gap-2"><Truck className="w-4 h-4" /> Pickup Information</h3>
              <div className="flex items-center gap-2">
                <Label htmlFor="pickup-toggle-add" className="text-sm text-muted-foreground">Include Pickup & Instructions</Label>
                <Switch id="pickup-toggle-add" checked={formData.hasPickupInfo} onCheckedChange={checked => setFormData({ ...formData, hasPickupInfo: checked })} />
              </div>
            </div>
            {formData.hasPickupInfo && (
              <div className="border rounded-lg p-4 space-y-6 bg-muted/20">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Carrier</Label>
                    <Popover open={carrierPopoverOpen} onOpenChange={setCarrierPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                          {formData.carrier || "Select Carrier..."}<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command shouldFilter={false}>
                          <CommandInput placeholder="Search carriers..." value={carrierSearch} onValueChange={setCarrierSearch} />
                          <CommandList className="pointer-events-auto" onWheel={e => e.stopPropagation()} onTouchMove={e => e.stopPropagation()}>
                            <CommandEmpty className="p-0" />
                            <CommandGroup>
                              {carriers.filter((c: any) => c.name.toLowerCase().includes(carrierSearch.toLowerCase())).map((c: any) => (
                                <CommandItem key={c._id} value={c._id} onSelect={() => { setFormData({ ...formData, carrier: c.name }); setCarrierPopoverOpen(false); setCarrierSearch(""); }}>
                                  <Check className={cn("mr-2 h-4 w-4", formData.carrier === c.name ? "opacity-100" : "opacity-0")} />{c.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                            {carrierSearch.trim() && !carriers.some((c: any) => c.name.toLowerCase() === carrierSearch.trim().toLowerCase()) && (
                              <>
                                <CommandSeparator />
                                <CommandGroup>
                                  <CommandItem onSelect={async () => {
                                    try { const res = await fetch("/api/admin/carriers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: carrierSearch.trim() }) }); if (!res.ok) throw new Error(); const nc = await res.json(); await refetchCarriers(); setFormData({ ...formData, carrier: nc.name }); setCarrierPopoverOpen(false); setCarrierSearch(""); toast.success(`Carrier "${nc.name}" added`); } catch { toast.error("Failed to add carrier"); }
                                  }} className="text-primary"><Plus className="mr-2 h-4 w-4" /> Add &quot;{carrierSearch.trim()}&quot;</CommandItem>
                                </CommandGroup>
                              </>
                            )}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2"><Label>Requested Date/Time</Label><Input type="datetime-local" value={formData.requestedPickupTime ? new Date(formData.requestedPickupTime).toISOString().slice(0, 16) : ""} onChange={e => setFormData({ ...formData, requestedPickupTime: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Confirmed Date</Label><Input type="date" value={formData.scheduledPickupDate} onChange={e => setFormData({ ...formData, scheduledPickupDate: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Confirmed Time</Label><Input type="time" value={formData.scheduledPickupTime} onChange={e => setFormData({ ...formData, scheduledPickupTime: e.target.value })} /></div>
                </div>
                <div className="space-y-3">
                  <h4 className="font-semibold text-base flex items-center gap-2"><MapPin className="w-4 h-4" /> Instructions</h4>
                  <Textarea value={formData.instructions} onChange={e => setFormData({ ...formData, instructions: e.target.value })} placeholder="Additional delivery or handling instructions..." className="min-h-[100px]" />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" type="button" onClick={() => { onOpenChange(false); reset(); }}>Cancel</Button>
            <Button type="submit" size="lg" className="min-w-[150px]">Create Request</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
