"use client";

import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { ProductMultiSelect } from "@/components/admin/product-multi-select";
import { toast } from "sonner";
import { useUserDataStore } from "@/store/useUserDataStore";

interface AddShippingDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  /** "standalone" writes to /api/admin/vb-shipping; "embedded" pushes into PO nested array */
  mode?: "standalone" | "embedded";
  /** If provided, dialog is in edit mode */
  editingData?: Record<string, any> | null;
  /** Called after successful save */
  onSaved?: () => void;
  /** Pre-fill VB Number from sidebar Level-1 selection */
  presetVBNumber?: string | null;
  /** Pre-fill VB Number Serial from sidebar Level-2 selection */
  presetVBSerial?: string | null;
}

export function AddShippingDialog({ open, onClose, onSuccess, mode = "embedded", editingData, onSaved, presetVBNumber, presetVBSerial }: AddShippingDialogProps) {
  const { purchaseOrders, suppliers, products: pList } = useUserDataStore();
  const [actionLoading, setActionLoading] = useState(false);

  const [selectedVBPO, setSelectedVBPO] = useState("");
  const [selectedCPO, setSelectedCPO] = useState("");
  const [selectedSupplierForShipping, setSelectedSupplierForShipping] = useState("");
  const [selectedSupplierLocation, setSelectedSupplierLocation] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("Ordered");
  const [selectedCarrier, setSelectedCarrier] = useState("");
  const [autoShipmentNumber, setAutoShipmentNumber] = useState("");

  // For standalone mode: VB PO options from purchaseOrders & CPO options from API
  const [standaloneCPOs, setStandaloneCPOs] = useState<any[]>([]);

  const SHIPPING_SECTIONS = [
    { id: 'core', label: 'Core Info', icon: '📦' },
    { id: 'supplier', label: 'Supplier', icon: '🏭' },
    { id: 'logistics', label: 'Logistics', icon: '🚢' },
    { id: 'weights', label: 'Weights', icon: '⚖️' },
    { id: 'financials', label: 'Financials', icon: '💰' },
    { id: 'inventory', label: 'Inventory', icon: '📋' },
  ];

  const CARRIER_OPTIONS = ['MAERSK', 'MSC', 'CMA CGM', 'COSCO', 'ONE', 'Evergreen', 'Hapag-Lloyd', 'ZIM', 'Yang Ming', 'HMM'];

  const products = (pList || []).reduce((acc: any, p: any) => {
    if (p._id && p.name) acc[p._id] = p.name;
    return acc;
  }, {});

  const supplierLocationOptions = useMemo(() => {
    const selected = (suppliers || []).find((s: any) => s._id === selectedSupplierForShipping || s.vbId === selectedSupplierForShipping);
    if (!selected?.location) return [];
    return selected.location.map((l: any) => ({
      value: l.vbId,
      label: l.locationName || l.vbId,
    }));
  }, [suppliers, selectedSupplierForShipping]);

  // VB PO options for standalone mode — value is _id (ObjectId) for VBNumber
  const vbpoOptions = useMemo(() =>
    (purchaseOrders || []).map((po: any) => ({ value: po._id || '', label: po.VBNumber || po.vbpoNo || '—' })),
    [purchaseOrders]
  );

  // Filtered CPOs based on selected VB PO _id (standalone)
  const filteredStandaloneCPOs = useMemo(() => {
    if (!selectedVBPO) return standaloneCPOs;
    return standaloneCPOs.filter((cpo: any) =>
      (cpo.VBNumber || cpo.vidaPOId) === selectedVBPO
    );
  }, [standaloneCPOs, selectedVBPO]);

  const supplierOptions = useMemo(() =>
    (suppliers || []).map((s: any) => ({ value: s._id, label: `${s.name} (${s.vbId})` })),
    [suppliers]
  );

  const carrierOptions = useMemo(() =>
    CARRIER_OPTIONS.map(c => ({ value: c, label: c })),
    []
  );

  const statusOptions = useMemo(() =>
    ['Ordered', 'Pending', 'Planned', 'In Transit', 'Delivered', 'Cancelled'].map(s => ({ value: s, label: s })),
    []
  );

  // Fetch standalone CPOs on mount
  useEffect(() => {
    if (mode === 'standalone' && open) {
      fetch('/api/admin/vb-customer-po')
        .then(r => r.json())
        .then(items => { if (Array.isArray(items)) setStandaloneCPOs(items); })
        .catch(() => {});
    }
  }, [mode, open]);

  // Auto-generate VBShipmentNumber when CPO is selected
  useEffect(() => {
    if (!selectedCPO || !open) {
      setAutoShipmentNumber("");
      return;
    }
    // Only auto-generate for new records, not editing
    if (editingData) return;
    fetch(`/api/admin/vb-shipping/next-number?vbSerialNumber=${selectedCPO}`)
      .then(r => r.json())
      .then(res => {
        if (res.nextNumber) setAutoShipmentNumber(res.nextNumber);
      })
      .catch(() => {});
  }, [selectedCPO, open, editingData]);

  // Reset form when editing data changes
  useEffect(() => {
    if (!open) return;
    if (editingData) {
      setSelectedSupplierForShipping(editingData.supplier || "");
      setSelectedSupplierLocation(editingData.supplierLocation || "");
      setSelectedStatus(editingData.status || "Ordered");
      setSelectedCarrier(editingData.carrier || "");
      setSelectedVBPO(editingData.VBNumber || editingData.vbpoNo || editingData.poNo || "");
      setSelectedCPO(editingData.VBSerialNumber || editingData.customerPOId || "");
      setAutoShipmentNumber(editingData.VBShipmentNumber || editingData.svbid || "");
    } else {
      // Pre-fill from sidebar context if available
      setSelectedVBPO(presetVBNumber || "");
      setSelectedCPO(presetVBSerial || "");
      setSelectedSupplierForShipping("");
      setSelectedSupplierLocation("");
      setSelectedStatus("Ordered");
      setSelectedCarrier("");
      setAutoShipmentNumber("");
    }
  }, [open, editingData, presetVBNumber, presetVBSerial]);

  const handleSaveShipping = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === "embedded" && (!selectedVBPO || !selectedCPO)) {
      toast.error("Please select a VBPO and Customer PO first");
      return;
    }

    setActionLoading(true);
    const formData = new FormData(e.target as HTMLFormElement);
    const data = Object.fromEntries(formData.entries());
    const formattedData: any = { ...data };

    // Inject controlled state values
    formattedData.supplier = selectedSupplierForShipping;
    formattedData.supplierLocation = selectedSupplierLocation;
    formattedData.status = selectedStatus || 'Ordered';
    formattedData.carrier = selectedCarrier;

    // For standalone, inject the new linking fields only
    if (mode === 'standalone') {
      if (selectedVBPO) {
        formattedData.VBNumber = selectedVBPO;    // vidapos._id as string
      }
      if (selectedCPO) {
        formattedData.VBSerialNumber = selectedCPO; // vbcustomerpos._id as string
      }
      // VBShipmentNumber: use the controlled input value (already auto-populated or user-edited)
      formattedData.VBShipmentNumber = autoShipmentNumber || formattedData.svbid?.trim() || '';
      // Clean up legacy form field
      delete formattedData.svbid;
    }

    ['drums', 'pallets', 'gallons', 'netWeightKG', 'grossWeightKG', 'invValue', 'estTrumpDuties', 'feesAmount', 'estimatedDuties', 'qty'].forEach(k => {
      if (formattedData[k]) formattedData[k] = Number(formattedData[k]);
    });

    if (typeof formattedData.products === 'string') {
      formattedData.products = formattedData.products.split(',').filter(Boolean);
    }

    try {
      if (mode === "standalone") {
        // Standalone: write directly to VBshipping collection
        const url = editingData?._id
          ? `/api/admin/vb-shipping/${editingData._id}`
          : "/api/admin/vb-shipping";
        const method = editingData?._id ? "PUT" : "POST";
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formattedData),
        });
        if (!res.ok) throw new Error("Failed");
        toast.success(editingData ? "Shipment updated" : "Shipment created");
      } else {
        // Embedded: push into PO nested array
        const po = purchaseOrders.find(p => p._id === selectedVBPO);
        const cpoIdx = po?.customerPO?.findIndex((c: any) => c._id === selectedCPO || c.customerPONo === selectedCPO);
        if (!po || cpoIdx === undefined || cpoIdx === -1) {
          toast.error("Invalid state");
          setActionLoading(false);
          return;
        }
        const cpo = po.customerPO[cpoIdx];
        if (!formattedData.svbid || formattedData.svbid.trim() === '') {
          formattedData.svbid = `${cpo.poNo}-${(cpo?.shipping?.length || 0) + 1}`;
        }
        const res = await fetch(`/api/admin/purchase-orders/${po._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ $push: { [`customerPO.${cpoIdx}.shipping`]: formattedData } })
        });
        if (!res.ok) throw new Error("Failed to add shipping");
        toast.success("Shipping added successfully");
      }

      onClose();
      onSuccess?.();
      onSaved?.();
    } catch(err) {
      toast.error("Error saving shipping record");
    } finally {
      setActionLoading(false);
    }
  };

  const activePO = purchaseOrders?.find(p => p._id === selectedVBPO);
  const activeCPOs = activePO?.customerPO || [];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-[90vw] w-[1100px] h-[85vh] p-0 gap-0 overflow-hidden flex flex-col">
        <form key={editingData?._id || 'new'} onSubmit={handleSaveShipping} className="flex flex-col flex-1 min-h-0">
          <div className="px-6 py-4 border-b bg-gradient-to-r from-background to-muted/30 shrink-0">
            <DialogHeader>
              <DialogTitle className="text-lg">{editingData ? "Edit Shipping Record" : "Add Shipping Record"}</DialogTitle>
              <DialogDescription className="text-xs">
                Create a new shipment and attach it to a VBPO / Customer PO context.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex flex-1 min-h-0 overflow-hidden">
            <div className="w-[160px] border-r bg-muted/20 py-2 flex-shrink-0">
              <button disabled type="button" className="w-full text-left px-4 py-2.5 text-xs font-medium bg-primary/10 transition-colors flex items-center gap-2 border-l-2 border-primary text-foreground mb-4">
                <span className="text-sm">🔗</span>Context Info
              </button>
              {SHIPPING_SECTIONS.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => {
                    const container = document.getElementById('shipping-form-scroll');
                    const target = document.getElementById(`ship-section-${section.id}`);
                    if (container && target) {
                      const containerRect = container.getBoundingClientRect();
                      const targetRect = target.getBoundingClientRect();
                      const scrollOffset = targetRect.top - containerRect.top + container.scrollTop - 16;
                      container.scrollTo({ top: scrollOffset, behavior: 'smooth' });
                    }
                  }}
                  className="w-full text-left px-4 py-2.5 text-xs font-medium hover:bg-primary/10 transition-colors flex items-center gap-2 text-muted-foreground hover:text-foreground border-l-2 border-transparent hover:border-primary"
                >
                  <span className="text-sm">{section.icon}</span>
                  {section.label}
                </button>
              ))}
            </div>

            <div id="shipping-form-scroll" className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-muted">
              {/* Context Selector — only shown in embedded mode */}
              {mode === "embedded" && (
              <div id="ship-section-context" className="rounded-xl border border-primary/20 bg-primary/5 p-4 mb-6">
                 <h4 className="text-xs font-black uppercase text-primary tracking-widest mb-4">Link to Order (Required)</h4>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs">Select VBPO</Label>
                      <SearchableSelect
                        options={(purchaseOrders || []).map((po: any) => ({ value: po._id, label: po.vbpoNo || po._id }))}
                        value={selectedVBPO}
                        onChange={(v) => { setSelectedVBPO(v); setSelectedCPO(""); }}
                        placeholder="Select VBPO..."
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Select Customer PO</Label>
                      <SearchableSelect
                        options={activeCPOs.map((cpo: any) => ({ value: cpo._id || cpo.customerPONo, label: cpo.customerPONo || cpo.poNo }))}
                        value={selectedCPO}
                        onChange={(v) => setSelectedCPO(v)}
                        placeholder={selectedVBPO ? "Select Customer PO..." : "Select VBPO first"}
                      />
                    </div>
                 </div>
              </div>
              )}

              {/* === CORE INFO === */}
              <div id="ship-section-core">
                <h4 className="text-xs font-black uppercase text-muted-foreground tracking-widest mb-4 flex items-center gap-2">
                  <span className="h-5 w-5 rounded bg-primary/10 flex items-center justify-center text-[10px]">📦</span>
                  Core Information
                </h4>

                {/* VB PO + Customer PO linking (standalone mode) */}
                {mode === "standalone" && (
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="space-y-1">
                      <Label className="text-xs">VB Number</Label>
                      <SearchableSelect
                        options={vbpoOptions}
                        value={selectedVBPO}
                        onChange={(v) => { setSelectedVBPO(v); setSelectedCPO(""); }}
                        placeholder="Select VB PO..."
                        searchPlaceholder="Search PO numbers..."
                        allowClear
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">VB Number Serial</Label>
                      <SearchableSelect
                        options={filteredStandaloneCPOs.map((cpo: any) => ({
                          value: cpo._id,
                          label: `${cpo.VBSerialNumber || cpo.poNo || '—'}${cpo.customerPONo ? ` (${cpo.customerPONo})` : ''}`
                        }))}
                        value={selectedCPO}
                        onChange={(v) => setSelectedCPO(v)}
                        placeholder={selectedVBPO ? "Select Customer PO..." : "Select VB PO first"}
                        searchPlaceholder="Search customer POs..."
                        allowClear
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs">VB Shipment Number</Label>
                    <Input
                      name="svbid"
                      className="text-sm"
                      placeholder="Auto-generated on CPO select"
                      value={autoShipmentNumber || editingData?.VBShipmentNumber || editingData?.svbid || ""}
                      onChange={(e) => setAutoShipmentNumber(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Status</Label>
                    <SearchableSelect
                      options={statusOptions}
                      value={selectedStatus}
                      onChange={(v) => setSelectedStatus(v || "Ordered")}
                      placeholder="Select Status"
                      searchPlaceholder="Search status..."
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Container No</Label>
                    <Input name="containerNo" placeholder="ABCD1234567" className="text-sm" defaultValue={editingData?.containerNo || ""} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">BOL Number</Label>
                    <Input name="BOLNumber" placeholder="Bill of Lading No" className="text-sm" defaultValue={editingData?.BOLNumber || ""} />
                  </div>
                </div>
                <div className="mt-4">
                  <Label className="text-xs font-semibold block mb-2">Products</Label>
                  <ProductMultiSelect products={products} initialSelected={[]} />
                </div>
              </div>

              {/* === SUPPLIER === */}
              <div id="ship-section-supplier" className="pt-2">
                <h4 className="text-xs font-black uppercase text-muted-foreground tracking-widest mb-4 flex items-center gap-2">
                  <span className="h-5 w-5 rounded bg-primary/10 flex items-center justify-center text-[10px]">🏭</span>
                  Supplier Details
                </h4>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Supplier</Label>
                    <SearchableSelect
                      options={supplierOptions}
                      value={selectedSupplierForShipping}
                      onChange={(v) => { setSelectedSupplierForShipping(v); setSelectedSupplierLocation(""); }}
                      placeholder="Select Supplier"
                      searchPlaceholder="Search suppliers..."
                      emptyMessage="No suppliers found."
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Supplier Location</Label>
                    <SearchableSelect
                      options={supplierLocationOptions}
                      value={selectedSupplierLocation}
                      onChange={setSelectedSupplierLocation}
                      placeholder={selectedSupplierForShipping ? "Select Location" : "Select Supplier First"}
                      searchPlaceholder="Search locations..."
                      emptyMessage="No locations found."
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Supplier PO</Label>
                    <Input name="supplierPO" placeholder="Supplier Ref" className="text-sm" defaultValue={editingData?.supplierPO || ""} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Supplier PO Date</Label>
                    <Input name="supplierPoDate" type="date" className="text-sm" defaultValue={editingData?.supplierPoDate ? new Date(editingData.supplierPoDate).toISOString().split('T')[0] : ""} />
                  </div>
                </div>
              </div>

              {/* === LOGISTICS === */}
              <div id="ship-section-logistics" className="pt-2">
                <h4 className="text-xs font-black uppercase text-muted-foreground tracking-widest mb-4 flex items-center gap-2">
                  <span className="h-5 w-5 rounded bg-primary/10 flex items-center justify-center text-[10px]">🚢</span>
                  Logistics & Shipping
                </h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Carrier</Label>
                    <SearchableSelect
                      options={carrierOptions}
                      value={selectedCarrier}
                      onChange={setSelectedCarrier}
                      placeholder="Select Carrier"
                      searchPlaceholder="Search carriers..."
                      emptyMessage="No carriers found."
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Booking Ref</Label>
                    <Input name="carrierBookingRef" placeholder="Booking Ref" className="text-sm" defaultValue={editingData?.carrierBookingRef || ""} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Vessel / Trip</Label>
                    <Input name="vessellTrip" placeholder="Vessel Name / Trip No" className="text-sm" defaultValue={editingData?.vessellTrip || ""} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Port of Lading</Label>
                    <Input name="portOfLading" placeholder="Port Name" className="text-sm" defaultValue={editingData?.portOfLading || ""} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Port of Entry</Label>
                    <Input name="portOfEntryShipTo" placeholder="Port Name" className="text-sm" defaultValue={editingData?.portOfEntryShipTo || ""} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Landing Date</Label>
                    <Input name="dateOfLanding" type="date" className="text-sm" defaultValue={editingData?.dateOfLanding ? new Date(editingData.dateOfLanding).toISOString().split('T')[0] : ""} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">ETA</Label>
                    <Input name="ETA" type="date" className="text-sm" defaultValue={editingData?.ETA ? new Date(editingData.ETA).toISOString().split('T')[0] : ""} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Updated ETA</Label>
                    <Input name="updatedETA" type="date" className="text-sm" defaultValue={editingData?.updatedETA ? new Date(editingData.updatedETA).toISOString().split('T')[0] : ""} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Trucker Notified</Label>
                    <Input name="truckerNotifiedDate" type="date" className="text-sm" defaultValue={editingData?.truckerNotifiedDate ? new Date(editingData.truckerNotifiedDate).toISOString().split('T')[0] : ""} />
                  </div>
                </div>
              </div>

              {/* === WEIGHTS === */}
              <div id="ship-section-weights" className="pt-2">
                <h4 className="text-xs font-black uppercase text-muted-foreground tracking-widest mb-4 flex items-center gap-2">
                  <span className="h-5 w-5 rounded bg-primary/10 flex items-center justify-center text-[10px]">⚖️</span>
                  Weights & Measures
                </h4>
                <div className="grid grid-cols-5 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Drums</Label>
                    <Input name="drums" type="number" className="text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Pallets</Label>
                    <Input name="pallets" type="number" className="text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Gallons</Label>
                    <Input name="gallons" type="number" className="text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Net Wt (KG)</Label>
                    <Input name="netWeightKG" type="number" className="text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Gross Wt (KG)</Label>
                    <Input name="grossWeightKG" type="number" className="text-sm" />
                  </div>
                </div>
              </div>

              {/* === FINANCIALS === */}
              <div id="ship-section-financials" className="pt-2">
                <h4 className="text-xs font-black uppercase text-muted-foreground tracking-widest mb-4 flex items-center gap-2">
                  <span className="h-5 w-5 rounded bg-primary/10 flex items-center justify-center text-[10px]">💰</span>
                  Financials
                </h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Invoice Value ($)</Label>
                    <Input name="invValue" type="number" step="0.01" className="text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Fees Amount ($)</Label>
                    <Input name="feesAmount" type="number" step="0.01" className="text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Est. Regular Duties ($)</Label>
                    <Input name="estimatedDuties" type="number" step="0.01" className="text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Est. Trump Duties ($)</Label>
                    <Input name="estTrumpDuties" type="number" step="0.01" className="text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Genset Invoice #</Label>
                    <Input name="gensetInv" placeholder="Invoice #" className="text-sm" />
                  </div>
                </div>
              </div>

              {/* === INVENTORY === */}
              <div id="ship-section-inventory" className="pt-2">
                <h4 className="text-xs font-black uppercase text-muted-foreground tracking-widest mb-4 flex items-center gap-2">
                  <span className="h-5 w-5 rounded bg-primary/10 flex items-center justify-center text-[10px]">📋</span>
                  Inventory Details
                </h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Item No</Label>
                    <Input name="itemNo" placeholder="Item Code" className="text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Lot / Serial</Label>
                    <Input name="lotSerial" placeholder="Lot No" className="text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Type</Label>
                    <Input name="type" placeholder="e.g. Stock, Transit" className="text-sm" />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Description</Label>
                    <Input name="description" placeholder="Item Description" className="text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Quantity</Label>
                    <Input name="qty" type="number" className="text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Inventory Date</Label>
                    <Input name="inventoryDate" type="date" className="text-sm" />
                  </div>
                </div>
              </div>

            </div>
          </div>

          <div className="px-6 py-3 border-t bg-muted/20 flex items-center justify-end gap-2 shrink-0">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm" disabled={actionLoading}>{actionLoading ? "Saving..." : editingData ? "Save Changes" : "Add Shipping"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
