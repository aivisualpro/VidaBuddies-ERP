"use client";

import { useEffect, useState, useRef, use, useMemo } from "react";
import { DetailPageSkeleton } from "@/components/skeletons";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import {
  ShoppingCart,
  Hash,
  Calendar,
  User,
  Pencil,
  Trash,
  Box,
  MapPin,
  ClipboardList,
  ChevronDown,
  Truck,
  ChevronLeft,
  Plus,
  Paperclip,
  Clock,
  Anchor,
  Ship,
  Factory,
  Package,
  DollarSign,
  Weight,
  FileCheck,
  AlertTriangle,
  CheckCircle2
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { AttachmentsModal } from "@/components/attachments-modal";
import { DriveDocumentsModal } from "@/components/drive-documents-modal";
import TimelineModal from "@/components/admin/timeline-modal";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePurchaseOrder } from "@/hooks/queries/usePurchaseOrder";
import { useUpdatePO, useDeletePO } from "@/hooks/queries/usePurchaseOrderMutations";
import { purchaseOrderKeys, usePurchaseOrders } from "@/hooks/queries/usePurchaseOrders";
import { useUsers } from "@/hooks/queries/useUsers";
import { useCustomers } from "@/hooks/queries/useCustomers";
import { useSuppliers } from "@/hooks/queries/useSuppliers";
import { useProducts } from "@/hooks/queries/useProducts";
import { useWarehouses } from "@/hooks/queries/useWarehouses";
import { ShippingCard, ShippingEmptyState } from "@/components/admin/shipping-card";
import { TransferOrderDialog } from "@/components/admin/transfer-order-dialog";
import { AddCustomerPODialog } from "@/components/admin/add-customer-po-dialog";

interface Shipping {
  _id?: string;
  spoNo?: string;
  status?: string;
  ETA?: string;
  carrier?: string;
  [key: string]: any;
}

interface CustomerPO {
  _id?: string;
  VBNumber?: string;
  VBSerialNumber?: string;
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
  isDirectShipment?: boolean;
  shipping?: Shipping[];
}

interface PurchaseOrder {
  _id: string;
  VBNumber: string;
  orderType: string;
  date: string;
  category: string;
  createdBy: string;
  customerPO: CustomerPO[];
}

function ProductMultiSelect({ products, initialSelected }: { products: Record<string, string>; initialSelected: string[] }) {
  const [selectedProducts, setSelectedProducts] = useState<string[]>(initialSelected);
  const [productSearch, setProductSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = Object.entries(products).filter(([, name]) =>
    !productSearch || name.toLowerCase().includes(productSearch.toLowerCase())
  );

  const toggle = (id: string) => {
    setSelectedProducts(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  return (
    <div ref={dropdownRef} className="relative">
      <input type="hidden" name="products" value={selectedProducts.join(',')} />

      {selectedProducts.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedProducts.map(id => (
            <span key={id} className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded-md font-medium">
              {products[id] || id}
              <button type="button" onClick={() => toggle(id)} className="hover:bg-primary/20 rounded-full h-3.5 w-3.5 flex items-center justify-center text-primary/60 hover:text-primary">×</button>
            </span>
          ))}
        </div>
      )}

      <input
        type="text"
        placeholder={selectedProducts.length > 0 ? `${selectedProducts.length} selected — search more...` : "Search products..."}
        value={productSearch}
        onChange={(e) => { setProductSearch(e.target.value); setShowDropdown(true); }}
        onFocus={() => setShowDropdown(true)}
        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        autoComplete="off"
      />

      {showDropdown && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-[200px] overflow-y-auto bg-popover border rounded-lg shadow-xl">
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-xs text-muted-foreground text-center">No products found</div>
          ) : (
            filtered.map(([id, name]) => {
              const isSelected = selectedProducts.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggle(id)}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-muted/50 transition-colors flex items-center gap-2 ${isSelected ? 'bg-primary/5 text-primary font-semibold' : 'text-foreground'}`}
                >
                  <span className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-border'}`}>
                    {isSelected && <span className="text-[10px]">✓</span>}
                  </span>
                  <span className="truncate">{name}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export default function PurchaseOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [selectedSupplierForShipping, setSelectedSupplierForShipping] = useState<string>("");
  const [editingCPOData, setEditingCPOData] = useState<Record<string, any> | null>(null);
  const [selectedCpoId, setSelectedCpoId] = useState<string | null>(null);

  // ─── Reference data from TanStack Query hooks ───
  const { data: rawStoreUsers = [] } = useUsers();
  const { data: storeCustomers = [] } = useCustomers();
  const { data: storeSuppliers = [] } = useSuppliers();
  const { data: storeProducts = [] } = useProducts();
  const { data: storeWarehouses = [] } = useWarehouses();

  // ─── TanStack Query: 3 parallel queries replace the old fetchPO() ───
  const queryClient = useQueryClient();
  const updatePOMutation = useUpdatePO();
  const deletePOMutation = useDeletePO();

  const { data: poBase, isLoading: poLoading } = usePurchaseOrder(id);
  const { data: cpoList = [] } = useQuery<any[]>({
    queryKey: ["customer-pos", id],
    queryFn: async () => {
      const res = await fetch(`/api/admin/vb-customer-po?VBNumber=${id}`);
      return res.ok ? res.json() : [];
    },
    enabled: !!id,
  });
  const { data: shipList = [] } = useQuery<any[]>({
    queryKey: ["shippings", { VBNumber: id }],
    queryFn: async () => {
      const res = await fetch(`/api/admin/vb-shipping?VBNumber=${id}`);
      return res.ok ? res.json() : [];
    },
    enabled: !!id,
  });

  // Assemble the composite PO object (same logic as old fetchPO)
  const po = useMemo<PurchaseOrder | null>(() => {
    if (!poBase) return null;
    const assembledCPOs = (cpoList as any[]).map((cpo: any) => {
      const cpoId = cpo._id?.toString();
      const cpoShippings = (shipList as any[]).filter(
        (s: any) => s.VBSerialNumber?.toString() === cpoId
      );
      return { ...cpo, shipping: cpoShippings };
    });
    return { ...poBase, customerPO: assembledCPOs };
  }, [poBase, cpoList, shipList]);

  const loading = poLoading;

  /** Invalidate all 3 detail queries — replaces the old fetchPO() */
  const invalidateDetail = () => {
    queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.detail(id) });
    queryClient.invalidateQueries({ queryKey: ["customer-pos", id] });
    queryClient.invalidateQueries({ queryKey: ["shippings", { VBNumber: id }] });
  };

  // VB Number dropdown options from TanStack Query
  const { data: allPurchaseOrders = [] } = usePurchaseOrders();

  // Derive lookup maps from store data (zero API calls)
  const users = useMemo(() => {
    const mapping: Record<string, string> = {};
    if (Array.isArray(rawStoreUsers)) {
      rawStoreUsers.forEach((u: any) => {
        if (u.email) mapping[u.email.toLowerCase()] = u.name;
      });
    }
    return mapping;
  }, [rawStoreUsers]);

  const customers = storeCustomers || [];

  const locations = useMemo(() => {
    const mapping: Record<string, string> = {};
    customers.forEach((cust: any) => {
      if (cust.location && Array.isArray(cust.location)) {
        cust.location.forEach((loc: any) => {
          const name = loc.locationName || loc.vbId || 'Unknown';
          if (loc._id) mapping[loc._id] = name;       // ObjectId key
          if (loc.vbId) mapping[loc.vbId] = name;      // legacy vbId key
        });
      }
    });
    return mapping;
  }, [customers]);

  // Customer _id → name lookup
  const customerNames = useMemo(() => {
    const mapping: Record<string, string> = {};
    customers.forEach((cust: any) => {
      if (cust._id) mapping[cust._id] = cust.name || cust.vbId || 'Unknown';
    });
    return mapping;
  }, [customers]);

  const suppliers = storeSuppliers || [];

  const supplierLocations = useMemo(() => {
    const mapping: Record<string, string> = {};
    suppliers.forEach((sup: any) => {
      if (sup.location && Array.isArray(sup.location)) {
        sup.location.forEach((loc: any) => {
          const label = loc.locationName || `${sup.name} - ${loc.city}` || loc.vbId;
          if (loc._id) mapping[loc._id] = label;       // ObjectId key (post-migration)
          if (loc.vbId) mapping[loc.vbId] = label;      // vbId key (legacy compat)
        });
      }
    });
    return mapping;
  }, [suppliers]);

  // Reverse lookup: location subdoc _id → parent supplier name
  // Handles cases where ship.supplier stores a location _id instead of supplier _id
  const supplierByLocationId = useMemo(() => {
    const mapping: Record<string, string> = {};
    suppliers.forEach((sup: any) => {
      if (sup.location && Array.isArray(sup.location)) {
        sup.location.forEach((loc: any) => {
          if (loc._id) mapping[loc._id] = sup.name;
          if (loc.vbId) mapping[loc.vbId] = sup.name;
        });
      }
    });
    return mapping;
  }, [suppliers]);

  // Reverse lookup: location subdoc _id → parent supplier _id
  // Used to resolve the supplier dropdown selection when ship.supplier is a location _id
  const supplierIdByLocationId = useMemo(() => {
    const mapping: Record<string, string> = {};
    suppliers.forEach((sup: any) => {
      if (sup.location && Array.isArray(sup.location)) {
        sup.location.forEach((loc: any) => {
          if (loc._id) mapping[loc._id] = sup._id;
          if (loc.vbId) mapping[loc.vbId] = sup._id;
        });
      }
    });
    return mapping;
  }, [suppliers]);

  const products = useMemo(() => {
    const mapping: Record<string, string> = {};
    if (Array.isArray(storeProducts)) {
      storeProducts.forEach((p: any) => {
        if (p._id) mapping[p._id] = p.name;
      });
    }
    return mapping;
  }, [storeProducts]);

  const warehouses = storeWarehouses || [];
  // Build warehouse _id → name lookup for denormalization
  const warehouseNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    (warehouses || []).forEach((w: any) => { if (w._id) m[w._id] = w.name; });
    return m;
  }, [warehouses]);

  const [emailRecords, setEmailRecords] = useState<any[]>([]);

  // Action States
  const [isAddCPOOpen, setIsAddCPOOpen] = useState(false);
  const [autoSvbid, setAutoSvbid] = useState<string>("");
  const [addingShippingToCPO, setAddingShippingToCPO] = useState<{ idx: number, poNo: string } | null>(null);

  // Shipping form: VBNumber / VBSerialNumber dropdowns
  const [shipVBNumber, setShipVBNumber] = useState<string>("");
  const [shipVBSerial, setShipVBSerial] = useState<string>("");
  const [shipCPOs, setShipCPOs] = useState<any[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  const [actionsVisible, setActionsVisible] = useState(false); // Helper if needed
  const [editingShipping, setEditingShipping] = useState<{ cpoIdx: number, shipIdx: number, data: any } | null>(null);
  const [selectedLocationForShipping, setSelectedLocationForShipping] = useState<string>("");
  const [selectedCarrier, setSelectedCarrier] = useState<string>("");
  const [attachmentsOpen, setAttachmentsOpen] = useState<{ poNumber: string; spoNumber?: string; shipNumber?: string; childFolders?: string[] } | null>(null);
  const [legacyAttachmentsOpen, setLegacyAttachmentsOpen] = useState<{ poNumber: string; spoNumber?: string; shipNumber?: string; childFolders?: string[] } | null>(null);
  const [timelineOpen, setTimelineOpen] = useState<{ VBNumber?: string; VBSerialNumber?: string; VBShipmentNumber?: string; title?: string } | null>(null);
  const [liveTrackingOpen, setLiveTrackingOpen] = useState<{ containerNo?: string; title?: string } | null>(null);
  const [transferDialogShip, setTransferDialogShip] = useState<any | null>(null);

  const [isEditPOOpen, setIsEditPOOpen] = useState(false);
  const [editPOData, setEditPOData] = useState<Partial<PurchaseOrder>>({});

  const { setLeftContent, setRightContent } = useHeaderActions();

  // VB Number dropdown options from store
  const vbNumberOptions = useMemo(() =>
    (allPurchaseOrders || []).map((po: any) => ({ value: po._id, label: po.VBNumber || po._id })),
    [allPurchaseOrders]
  );

  // Fetch CPOs when shipVBNumber changes (for VBSerialNumber dropdown)
  useEffect(() => {
    if (!shipVBNumber) { setShipCPOs([]); return; }
    fetch(`/api/admin/vb-customer-po?VBNumber=${shipVBNumber}`)
      .then(r => r.json())
      .then(items => { if (Array.isArray(items)) setShipCPOs(items); })
      .catch(() => setShipCPOs([]));
  }, [shipVBNumber]);

  // Normalize a possibly-populated ObjectId reference to a plain id string
  const toIdStr = (val: any): string => {
    if (!val) return "";
    if (typeof val === "object") return val._id?.toString() || "";
    return val.toString();
  };

  // Auto-generate VBShipmentNumber when VBSerialNumber is selected.
  // Guards (fix for Shipment # silently changing on edit):
  //  1. Only runs while the shipping dialog is actually open.
  //  2. When editing, only regenerates if the Contract # was changed away from the
  //     shipment's original one — otherwise the existing number is kept.
  //  3. Late responses are discarded via the cleanup flag so a stale fetch from a
  //     previous dialog/CPO can never overwrite the field.
  useEffect(() => {
    const dialogOpen = !!addingShippingToCPO || !!editingShipping;
    if (!shipVBSerial || !dialogOpen) return;

    if (editingShipping) {
      const ship = editingShipping.data;
      const originalSerial = toIdStr(ship?.VBSerialNumber);
      const originalNumber = ship?.VBShipmentNumber || ship?.svbid || "";
      if (shipVBSerial === originalSerial && originalNumber) {
        // Contract # unchanged (or re-selected) — restore the original number if the
        // field was cleared, and never fetch a new one.
        setAutoSvbid(prev => prev || originalNumber);
        return;
      }
    }

    let cancelled = false;
    fetch(`/api/admin/vb-shipping/next-number?vbSerialNumber=${shipVBSerial}`)
      .then(r => r.json())
      .then(res => { if (!cancelled && res.nextNumber) setAutoSvbid(res.nextNumber); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [shipVBSerial, editingShipping, addingShippingToCPO]);

  // Pre-fill shipping form state when dialog opens.
  // Runs ONCE per dialog open (tracked via ref) — previously it re-ran on every `po`
  // refetch (realtime updates), resetting controlled fields while the user was editing.
  const shippingPrefillKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const key = addingShippingToCPO
      ? `add-${addingShippingToCPO.idx}`
      : editingShipping
        ? `edit-${toIdStr(editingShipping.data?._id) || `${editingShipping.cpoIdx}-${editingShipping.shipIdx}`}`
        : null;
    if (!key || !po) {
      shippingPrefillKeyRef.current = null;
      return;
    }
    if (shippingPrefillKeyRef.current === key) return;
    shippingPrefillKeyRef.current = key;

    if (addingShippingToCPO) {
      // "Add Ship" clicked from a CPO context — pre-fill VBNumber from current PO
      setShipVBNumber(po._id);
      const cpo = po.customerPO?.[addingShippingToCPO.idx];
      setShipVBSerial(cpo?._id || "");
      setSelectedCarrier("");
    } else if (editingShipping) {
      // Use the snapshot taken when Edit was clicked — index lookups into `po` can
      // point at the wrong record after a background refetch.
      const ship = editingShipping.data;
      setShipVBNumber(toIdStr(ship?.VBNumber) || po._id || "");
      setShipVBSerial(toIdStr(ship?.VBSerialNumber));
      setAutoSvbid(ship?.VBShipmentNumber || ship?.svbid || "");
      setSelectedCarrier(ship?.carrier || "");
    }
  }, [addingShippingToCPO, editingShipping, po]);



  const fetchEmailRecords = async (vbpoNo: string) => {
    try {
      const res = await fetch(`/api/admin/emails?VBNumber=${encodeURIComponent(vbpoNo)}`);
      const data = await res.json();
      if (res.ok) setEmailRecords(data.emails || []);
    } catch { /* silent */ }
  };

  // Get filtered locations for the selected supplier
  const getSupplierLocationOptions = (): { id: string; name: string }[] => {
    if (!selectedSupplierForShipping) return [];
    const sup = suppliers.find((s: any) => s._id === selectedSupplierForShipping || s.vbId === selectedSupplierForShipping);
    if (!sup?.location) return [];
    return sup.location.filter((loc: any) => loc._id).map((loc: any) => ({
      id: (loc._id || loc.vbId) as string,
      name: (loc.locationName || `${sup.name} - ${loc.city}` || loc.vbId) as string,
    }));
  };

  // Reset location when supplier changes (unless editing)
  useEffect(() => {
    if (!editingShipping) {
      setSelectedLocationForShipping("");
    }
  }, [selectedSupplierForShipping]);

  useEffect(() => {
    if (po?.VBNumber) {
      fetchEmailRecords(po.VBNumber);
    }
  }, [po?.VBNumber]);

  useEffect(() => {
    const handler = () => {
      if (po?.VBNumber) fetchEmailRecords(po.VBNumber);
    };
    window.addEventListener("vb-email-records-updated", handler);
    return () => window.removeEventListener("vb-email-records-updated", handler);
  }, [po?.VBNumber]);



  // Calculate total shippings
  const allShippings = po?.customerPO?.flatMap((cpo, cpoIdx) =>
    (cpo.shipping || []).map((ship: any, shipIdx) => ({
      ...ship,
      parentCpoNo: cpo.poNo,
      parentCpoId: cpo._id,
      _cpoIdx: cpoIdx,
      _shipIdx: shipIdx
    }))
  ) || [];

  const filteredShippings = selectedCpoId
    ? allShippings.filter((s: any) => s.parentCpoId === selectedCpoId)
    : allShippings;

  const sortedShippings = [...filteredShippings].sort((a: any, b: any) => {
    const getPriority = (status?: string) => {
      const s = (status || "").toLowerCase();
      if (s === "in transit") return 1;
      if (s === "ordered") return 2;
      if (s === "delivered") return 4;
      if (s === "cancelled") return 5;
      return 3;
    };
    return getPriority(a.status) - getPriority(b.status);
  });

  const updateShippingField = async (cpoIdx: number, shipIdx: number, field: string, value: any) => {
    if (!po) return;

    const ship = po.customerPO[cpoIdx]?.shipping?.[shipIdx];
    if (!ship?._id) return;

    try {
      const response = await fetch(`/api/admin/vb-shipping/${ship._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value })
      });

      if (!response.ok) throw new Error("Update failed");
      invalidateDetail();
    } catch (error) {
      toast.error("Failed to update");
      invalidateDetail();
    }
  };

  const handleDeleteCPO = (cpoId: string, idx: number) => {
    toast("Delete Customer PO?", {
      description: "Click 'Delete' to confirm. This cannot be undone.",
      duration: 10000,
      cancel: {
        label: "Cancel",
        onClick: () => {},
      },
      action: {
        label: "Delete",
        onClick: async () => {
          try {
            const response = await fetch(`/api/admin/vb-customer-po/${cpoId}`, {
              method: 'DELETE',
            });

            if (!response.ok) throw new Error("Failed to delete");
            toast.success("Customer PO deleted");
            invalidateDetail();
          } catch (e) {
            toast.error("Error deleting Customer PO");
            invalidateDetail();
          }
        }
      }
    });
  };

  const handleDeleteShipping = (shipId: string, cpoIdx: number, shipIdx: number) => {
    toast("Delete Shipping Record?", {
      description: "Click 'Delete' to confirm. This action cannot be undone.",
      duration: 10000,
      cancel: {
        label: "Cancel",
        onClick: () => {},
      },
      action: {
        label: "Delete",
        onClick: async () => {
          // Get shipping svbid and parent CPO poNo before removing from state
          const shipData = po?.customerPO?.[cpoIdx]?.shipping?.[shipIdx];
          const svbid = shipData?.svbid;
          const cpoPoNo = po?.customerPO?.[cpoIdx]?.poNo;
          const poNo = po?.VBNumber;


          try {
            const response = await fetch(`/api/admin/vb-shipping/${shipId}`, {
              method: 'DELETE',
            });

            if (!response.ok) throw new Error("Failed to delete shipping");

            // Also delete the Google Drive folder for this shipping
            if (svbid && cpoPoNo && poNo) {
              try {
                const findRes = await fetch(
                  `/api/admin/drive?type=find&poNumber=${encodeURIComponent(poNo)}&spoNumber=${encodeURIComponent(cpoPoNo)}&shipNumber=${encodeURIComponent(svbid)}`
                );
                const findData = await findRes.json();
                if (findData.folderId) {
                  await fetch('/api/admin/drive', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fileIds: [findData.folderId] }),
                  });
                }
              } catch (driveErr) {
                console.error("Failed to delete Drive folder:", driveErr);
                // Don't block — shipping was already deleted from DB
              }
            }

            toast.success("Shipping deleted");
            invalidateDetail();
          } catch (e) {
            toast.error("Error deleting shipping");
            invalidateDetail();
          }
        }
      }
    });
  };

  const handleSaveShipping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addingShippingToCPO && !editingShipping) return;

    setActionLoading(true);
    const formData = new FormData(e.target as HTMLFormElement);
    const data = Object.fromEntries(formData.entries());
    const formattedData: any = { ...data };
    if (!editingShipping) formattedData.status = 'Ordered'; // Default status for new

    // Inject VBNumber / VBSerialNumber / VBShipmentNumber from controlled state
    formattedData.VBNumber = shipVBNumber;
    formattedData.VBSerialNumber = shipVBSerial;
    formattedData.VBShipmentNumber = autoSvbid || formattedData.svbid?.trim() || '';
    delete formattedData.svbid; // cleanup legacy form field name

    // Numbers
    ['drums', 'pallets', 'gallons', 'netWeightKG', 'grossWeightKG', 'invValue', 'estTrumpDuties', 'feesAmount', 'estimatedDuties', 'qty'].forEach(k => {
      if (formattedData[k]) formattedData[k] = Number(formattedData[k]);
    });

    // Convert products from comma-separated string to array
    if (typeof formattedData.products === 'string') {
      formattedData.products = formattedData.products.split(',').filter(Boolean);
    }

    try {
      if (editingShipping) {
        // Update existing standalone VBshipping — use the snapshot _id, not an index
        // lookup into `po` (indexes can shift after a background refetch)
        const shipId = editingShipping.data?._id
          || po?.customerPO?.[editingShipping.cpoIdx]?.shipping?.[editingShipping.shipIdx]?._id;
        if (!shipId) throw new Error("Missing Shipping ID");
        const response = await fetch(`/api/admin/vb-shipping/${shipId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formattedData)
        });
        if (!response.ok) throw new Error("Failed to update shipping");
      } else if (addingShippingToCPO) {
        // Create new standalone VBshipping linked via VBSerialNumber
        const response = await fetch('/api/admin/vb-shipping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formattedData)
        });
        if (!response.ok) throw new Error("Failed to create shipping");
      }

      toast.success(editingShipping ? "Shipping Updated" : "Shipping Added");
      setAddingShippingToCPO(null);
      setEditingShipping(null);
      setSelectedLocationForShipping("");
      setShipVBNumber("");
      setShipVBSerial("");
      setAutoSvbid("");
      setSelectedCarrier("");
      invalidateDetail();
    } catch (e) {
      toast.error("Error saving shipping");
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditPOSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPOData || !po) return;
    setActionLoading(true);
    try {
      await updatePOMutation.mutateAsync({ id: po._id, data: editPOData });
      toast.success("Purchase Order updated successfully");
      setIsEditPOOpen(false);
      invalidateDetail();
    } catch (e) {
      toast.error("Failed to update extra PO fields");
    } finally {
      setActionLoading(false);
    }
  };

  // Update Header with Actions
  useEffect(() => {
    if (!po) return;

    setLeftContent(
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.back()}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold leading-none uppercase bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">{po.VBNumber}</h1>
          <span className="text-sm text-muted-foreground font-medium uppercase tracking-tight">{po.orderType}</span>
          <span className="text-sm text-gray-300">•</span>
          <span className="text-sm text-muted-foreground font-medium uppercase tracking-tight">{po.category}</span>
        </div>
      </div>
    );

    setRightContent(
      <div className="flex items-center gap-2">
        {/* Delete PO — only if no related records exist */}
        {(!po.customerPO || po.customerPO.length === 0) && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
            onClick={() => {
              toast("Delete this Purchase Order?", {
                description: `"${po.VBNumber}" will be permanently deleted. This cannot be undone.`,
                action: {
                  label: "Delete",
                  onClick: async () => {
                    try {
                      await deletePOMutation.mutateAsync(po._id);
                      router.push("/admin/purchase-orders");
                    } catch {
                      // error toast handled by mutation hook
                    }
                  },
                },
              });
            }}
          >
            <Trash className="h-3.5 w-3.5 mr-2" />
            Delete PO
          </Button>
        )}
        <Button variant="outline" size="sm" className="h-8" onClick={() => {
          setEditPOData({
            VBNumber: po.VBNumber || "",
            orderType: po.orderType || "",
            category: po.category || "",
            date: po.date ? new Date(po.date).toISOString().split('T')[0] : "",
          });
          setIsEditPOOpen(true);
        }}>
          <Pencil className="h-3.5 w-3.5 mr-2" />
          Edit
        </Button>
        <Button variant="outline" size="sm" className="h-8" onClick={() => setTimelineOpen({ VBNumber: po?._id, title: `Timeline — ${po?.VBNumber}` })}>
          <Clock className="h-3.5 w-3.5 mr-2" />
          Timeline
        </Button>
        <Button variant="outline" size="sm" className="h-8" onClick={() => {
          setEditingCPOData(null);
          setIsAddCPOOpen(true);
        }}>
          <Plus className="h-3.5 w-3.5 mr-2" />
          Add Customer PO
        </Button>
      </div>
    );

    return () => {
      setLeftContent(null);
      setRightContent(null);
    };
  }, [po?._id, po?.VBNumber, po?.orderType, po?.category, po?.customerPO?.length, setLeftContent, setRightContent, router]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
  };

  if (loading) {
    return <DetailPageSkeleton />;
  }

  if (!po) {
    return <div className="p-8 text-center uppercase font-black tracking-[0.2em] text-muted-foreground">Order not found</div>;
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full bg-background overflow-hidden relative">


        <div className="grid grid-cols-10 gap-[14px] p-0 h-full relative z-10">

          {/* Column 1: Customer POs (Left Side) - 30% */}
          <div className="col-span-3 flex flex-col gap-4 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-primary" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Customer POs</span>
              </div>
              <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-black border border-primary/20">
                {po.customerPO?.length || 0}
              </span>
            </div>

            <div className="space-y-4">
              {po.customerPO && po.customerPO.length > 0 ? (
                po.customerPO.map((cpo, idx) => (
                  <div
                    key={cpo._id || idx}
                    onClick={() => setSelectedCpoId(selectedCpoId === cpo._id ? null : cpo._id || null)}
                    className={cn(
                      "group relative overflow-hidden rounded-3xl bg-card/60 backdrop-blur-sm text-card-foreground border shadow-none transition-all duration-500 hover:-translate-y-1 hover:border-primary/40 p-6 cursor-pointer",
                      selectedCpoId === cpo._id ? "border-primary ring-1 ring-primary bg-primary/5" : "border-border"
                    )}
                  >
                    {/* Background Gradient Pattern */}
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-40 group-hover:opacity-100 transition-opacity duration-1000" />

                    <div className="relative z-10 flex flex-col gap-4">
                      {/* Row 1: VBSerialNumber & customerPONo */}
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-black leading-tight text-foreground uppercase tracking-tight">
                          {cpo.VBSerialNumber || "UNNAMED"}
                        </h3>
                        <h3 className="text-lg font-black leading-tight text-foreground uppercase tracking-tight">
                          {cpo.customerPONo || '-'}
                        </h3>
                      </div>

                      <Separator className="bg-border/30" />

                      {/* Row 2: Customer & Location */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="min-w-0">
                          <p className="text-[9px] font-semibold uppercase text-foreground/60 tracking-wider">Customer</p>
                          <p className="text-xs font-bold text-foreground truncate" title={customerNames[cpo.customer?.toString() || ''] || cpo.customer || '-'}>
                            {customerNames[cpo.customer?.toString() || ''] || cpo.customer || '-'}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[9px] font-semibold uppercase text-foreground/60 tracking-wider">Customer Location</p>
                          <p className="text-xs font-bold text-foreground truncate" title={locations[cpo.customerLocation || ''] || cpo.customerLocation || '-'}>
                            {locations[cpo.customerLocation || ''] || cpo.customerLocation || '-'}
                          </p>
                        </div>
                      </div>

                      {/* Row 3: Dates */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="min-w-0">
                          <p className="text-[9px] font-semibold uppercase text-foreground/60 tracking-wider">PO Date</p>
                          <p className="text-xs font-bold text-foreground">{formatDate(cpo.customerPODate)}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[9px] font-semibold uppercase text-foreground/60 tracking-wider">Requested Delivery</p>
                          <p className="text-xs font-bold text-foreground">{formatDate(cpo.requestedDeliveryDate)}</p>
                        </div>
                      </div>

                      {/* Row 4: Icons with qtyOrdered, qtyReceived, UOM */}
                      <div className="grid grid-cols-3 gap-2 bg-muted/30 dark:bg-foreground/5 rounded-2xl p-3 border border-border/50">
                        <div className="flex flex-col items-center gap-1">
                          <Box className="h-4 w-4 text-primary/60" />
                          <p className="text-[11px] font-black text-foreground">{cpo.qtyOrdered || 0}</p>
                          <p className="text-[8px] font-black uppercase text-muted-foreground/60">Ordered</p>
                        </div>
                        <div className="flex flex-col items-center gap-1 border-x border-border/50">
                          <Truck className="h-4 w-4 text-primary" />
                          <p className="text-[11px] font-black text-foreground">{cpo.qtyReceived || 0}</p>
                          <p className="text-[8px] font-black uppercase text-muted-foreground/60">Received</p>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <Hash className="h-4 w-4 text-primary/60" />
                          <p className="text-[11px] font-black text-foreground">{cpo.UOM || 'EA'}</p>
                          <p className="text-[8px] font-black uppercase text-muted-foreground/60">Units</p>
                        </div>
                      </div>

                      {/* Row 5: Warehouse & Actions */}
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Box className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex flex-col">
                            <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest opacity-50">Dispatch Point</p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-foreground">
                              {warehouseNameMap[cpo.warehouse || ""] || cpo.warehouse || "STANDBY"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Pass shipping svbids as childFolders so they're pre-created on Drive
                              const shipFolders = (cpo.shipping || []).map((s: any) => s.svbid).filter(Boolean);
                              setAttachmentsOpen({ poNumber: po?.VBNumber || '', spoNumber: cpo.poNo || undefined, childFolders: shipFolders });
                            }}
                          >
                            <Paperclip className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingCPOData(cpo);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (cpo._id) handleDeleteCPO(cpo._id, idx);
                            }}
                          >
                            <Trash className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTimelineOpen({ VBNumber: po?._id, VBSerialNumber: cpo._id, title: `Timeline — ${cpo.poNo}` });
                            }}
                          >
                            <Clock className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-7 px-3 text-[10px] font-bold uppercase tracking-wide ml-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              setAutoSvbid("");
                              setSelectedSupplierForShipping("");
                              setAddingShippingToCPO({ idx, poNo: cpo.VBSerialNumber || '' });
                            }}
                          >
                            <Plus className="h-3 w-3 mr-1.5" />
                            Add Ship
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-20 border border-dashed rounded-[2.5rem] bg-accent/5 opacity-50">
                  <ClipboardList className="h-10 w-10 text-muted-foreground/30 mb-4" />
                  <p className="font-black uppercase text-[10px] tracking-[0.3em] text-muted-foreground">No Customer POs</p>
                </div>
              )}
            </div>
          </div>

          {/* Column 2: Shippings (Right Side) - 70% */}
          <div className="col-span-7 flex flex-col gap-4 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-primary" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Shippings</span>
              </div>
              <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-black border border-primary/20">
                {sortedShippings.length || 0}
              </span>
            </div>

            <div className="space-y-4">
              {sortedShippings.length > 0 ? (
                sortedShippings.map((ship: any, idx: number) => {
                  const poLevelPath = po.VBNumber?.trim();
                  const cpoLevelPath = `${po.VBNumber} / ${po?.customerPO?.[ship._cpoIdx]?.poNo}`;
                  const shipSvbid = (ship.VBShipmentNumber || ship.svbid || "").trim();
                  const hasInvoice = emailRecords.some((e: any) => {
                    const eType = (e.type || "Invoice").trim();
                    if (eType !== "Invoice") return false;
                    const eRef = (e.reference || "").trim();
                    if (eRef && eRef === shipSvbid) return true;
                    if (!eRef) {
                      const fp = (e.folderPath || "").trim();
                      return !fp || fp === poLevelPath || fp === cpoLevelPath || fp.includes(shipSvbid);
                    }
                    return false;
                  });
                  const isDelivered = (ship.status || "").toLowerCase() === "delivered";
                  const showInvoiceAlert = !hasInvoice && isDelivered;

                  // Build display-enriched supplier name for ShippingCard
                  const rawSup = ship.supplier || '';
                  const resolvedSupName = suppliers.find((s: any) => s._id === rawSup)?.name || supplierByLocationId[rawSup] || '-';

                  return (
                    <ShippingCard
                      key={ship._id || idx}
                      ship={{ ...ship, _displaySupplier: ship._displaySupplier || resolvedSupName }}
                      index={idx}
                      supplierLocations={supplierLocations}
                      products={products}
                      hasInvoice={hasInvoice}
                      showInvoiceAlert={showInvoiceAlert}
                      onUpdateField={(shipId, field, value) => updateShippingField(ship._cpoIdx, ship._shipIdx, field, value)}
                      onAttachments={(s) => { const cpo = po?.customerPO?.[s._cpoIdx]; setAttachmentsOpen({ poNumber: po?.VBNumber || '', spoNumber: cpo?.VBSerialNumber || cpo?.poNo || '', shipNumber: s.VBShipmentNumber || s.svbid || undefined }); }}
                      onTimeline={(s) => setTimelineOpen({ VBNumber: po?._id, VBSerialNumber: po?.customerPO?.[s._cpoIdx]?._id, VBShipmentNumber: s._id, title: `Timeline — ${s.svbid || 'Shipping'}` })}
                      onLiveTracking={(s) => setLiveTrackingOpen({ containerNo: s.containerNo, title: `Live Tracking — ${s.containerNo}` })}
                      onEdit={(s) => { const resolvedSup = suppliers.find((sup: any) => sup._id === rawSup) ? rawSup : (supplierIdByLocationId[rawSup] || rawSup); setSelectedSupplierForShipping(resolvedSup); setSelectedLocationForShipping(s.supplierLocation || (suppliers.find((sup: any) => sup._id === rawSup) ? '' : rawSup) || ''); setEditingShipping({ cpoIdx: s._cpoIdx, shipIdx: s._shipIdx, data: s }); }}
                      onDelete={(s) => handleDeleteShipping(s._id || '', s._cpoIdx, s._shipIdx)}
                      onTransfers={(s) => setTransferDialogShip(s)}
                      isDirectShipment={!!(po?.customerPO?.[ship._cpoIdx]?.isDirectShipment)}
                    />
                  );
                })
              ) : (
                <ShippingEmptyState />
              )}
            </div>
        </div>
        </div>
      </div>
      <AddCustomerPODialog
        open={isAddCPOOpen || !!editingCPOData}
        onClose={() => {
          setIsAddCPOOpen(false);
          setEditingCPOData(null);
        }}
        defaultVbpoId={po?._id}
        editingData={editingCPOData}
        mode="standalone"
        onSaved={() => {
          invalidateDetail();
          queryClient.invalidateQueries({ queryKey: ["vb-customer-po"] });
        }}
        existingCPOs={cpoList}
      />

      {(() => {
        const SHIPPING_SECTIONS = [
          { id: 'core', label: 'Core Info', icon: '📦' },
          { id: 'supplier', label: 'Supplier', icon: '🏭' },
          { id: 'logistics', label: 'Logistics', icon: '🚢' },
          { id: 'weights', label: 'Weights', icon: '⚖️' },
          { id: 'financials', label: 'Financials', icon: '💰' },
          { id: 'inventory', label: 'Inventory', icon: '📋' },
        ];

        const CARRIER_OPTIONS = ['MAERSK', 'MSC', 'CMA CGM', 'COSCO', 'ONE', 'Evergreen', 'Hapag-Lloyd', 'ZIM', 'Yang Ming', 'HMM'];

        return (
          <Dialog open={!!addingShippingToCPO || !!editingShipping} onOpenChange={(v) => { if (!v) { setAddingShippingToCPO(null); setEditingShipping(null); setSelectedLocationForShipping(""); setShipVBNumber(""); setShipVBSerial(""); setAutoSvbid(""); setSelectedCarrier(""); } }}>
            <DialogContent className="max-w-[90vw] w-[1100px] h-[85vh] p-0 gap-0 overflow-hidden flex flex-col">
              <form onSubmit={handleSaveShipping} className="flex flex-col flex-1 min-h-0">
                {/* Header */}
                <div className="px-6 py-4 border-b bg-gradient-to-r from-background to-muted/30 shrink-0">
                  <DialogHeader>
                    <DialogTitle className="text-lg">{editingShipping ? "Edit Shipping Record" : "Add Shipping Record"}</DialogTitle>
                    <DialogDescription className="text-xs">
                      {editingShipping ? "Update shipment details" : `Adding shipment to PO: ${addingShippingToCPO?.poNo}`}
                    </DialogDescription>
                  </DialogHeader>
                </div>

                {/* Body: Sidebar + Content */}
                <div className="flex flex-1 min-h-0 overflow-hidden">
                  {/* Left Nav Tabs */}
                  <div className="w-[160px] border-r bg-muted/20 py-2 flex-shrink-0">
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

                  {/* Right Content - scrollable */}
                  <div id="shipping-form-scroll" className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-muted">

                    {/* === CORE INFO === */}
                    <div id="ship-section-core">
                      <h4 className="text-xs font-black uppercase text-muted-foreground tracking-widest mb-4 flex items-center gap-2">
                        <span className="h-5 w-5 rounded bg-primary/10 flex items-center justify-center text-[10px]">📦</span>
                        Core Information
                      </h4>

                      {/* VB Number / VB Serial Number / VB Shipment Number */}
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="space-y-1">
                          <Label className="text-xs">VB #</Label>
                          <SearchableSelect
                            options={vbNumberOptions}
                            value={shipVBNumber}
                            onChange={(v) => { setShipVBNumber(v); setShipVBSerial(""); setAutoSvbid(""); }}
                            placeholder="Select VB #..."
                            searchPlaceholder="Search VB #..."
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Contract #</Label>
                          <SearchableSelect
                            options={shipCPOs.map((cpo: any) => ({ value: cpo._id, label: `${cpo.VBSerialNumber || cpo._id}${cpo.customerPONo ? ` (${cpo.customerPONo})` : ''}` }))}
                            value={shipVBSerial}
                            onChange={(v) => { setShipVBSerial(v); setAutoSvbid(""); }}
                            placeholder={shipVBNumber ? "Select Contract..." : "Select VB # first"}
                            searchPlaceholder="Search VB Serial..."
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Shipment #</Label>
                          <Input
                            name="svbid"
                            className="text-sm"
                            placeholder="Auto-generated"
                            value={autoSvbid}
                            onChange={(e) => setAutoSvbid(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <Label className="text-xs">Status</Label>
                          <select name="status" className="w-full border rounded-md h-9 px-3 text-sm bg-background" defaultValue={(() => {
                            const raw = (editingShipping?.data?.status || '').toLowerCase().trim();
                            if (raw === 'ordered') return 'Ordered';
                            if (raw === 'delivered' || raw === 'arrived') return 'Delivered';
                            if (raw === 'in transit' || raw === 'in_transit' || raw === 'on water') return 'In Transit';
                            if (raw === 'planned' || raw === 'booking confirmed') return 'Planned';
                            if (raw === 'cancelled') return 'Cancelled';
                            return editingShipping ? 'Pending' : 'Ordered';
                          })()}>
                            <option value="Pending">Pending</option>
                            <option value="Ordered">Ordered</option>
                            <option value="Planned">Planned</option>
                            <option value="In Transit">In Transit</option>
                            <option value="Delivered">Delivered</option>
                            <option value="Cancelled">Cancelled</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Container No</Label>
                          <Input name="containerNo" placeholder="ABCD1234567" className="text-sm" defaultValue={editingShipping?.data?.containerNo} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">BOL Number</Label>
                          <Input name="BOLNumber" placeholder="Bill of Lading No" className="text-sm" defaultValue={editingShipping?.data?.BOLNumber} />
                        </div>

                      </div>
                      {/* Products - Searchable Multi-select */}
                      <div className="mt-4">
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-xs font-semibold">Products</Label>
                        </div>
                        <ProductMultiSelect
                          products={products}
                          initialSelected={
                            (editingShipping?.data?.products && Array.isArray(editingShipping.data.products) && editingShipping.data.products.length > 0)
                              ? editingShipping.data.products
                              : (typeof editingShipping?.data?.products === 'string' && editingShipping.data.products)
                                ? editingShipping.data.products.split(',').filter(Boolean)
                                : (editingShipping?.data?.product ? [editingShipping.data.product] : [])
                          }
                        />
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
                            name="supplier"
                            options={suppliers.map((sup: any) => ({ value: sup._id, label: `${sup.name} (${sup.vbId})` }))}
                            value={selectedSupplierForShipping}
                            onChange={(v) => setSelectedSupplierForShipping(v)}
                            placeholder="Select Supplier"
                            searchPlaceholder="Search suppliers..."
                            allowClear
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Supplier Location</Label>
                          <SearchableSelect
                            name="supplierLocation"
                            options={getSupplierLocationOptions().map((loc) => ({ value: loc.id, label: loc.name }))}
                            value={selectedLocationForShipping}
                            onChange={(v) => setSelectedLocationForShipping(v)}
                            placeholder={selectedSupplierForShipping ? 'Select Location' : 'Select Supplier First'}
                            searchPlaceholder="Search locations..."
                            allowClear
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label className="text-xs">Supplier PO</Label>
                          <Input name="supplierPO" placeholder="Supplier Ref" className="text-sm" defaultValue={editingShipping?.data?.supplierPO} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Supplier PO Date</Label>
                          <Input name="supplierPoDate" type="date" className="text-sm" defaultValue={editingShipping?.data?.supplierPoDate ? new Date(editingShipping.data.supplierPoDate).toISOString().split('T')[0] : ''} />
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
                            name="carrier"
                            options={[
                              ...CARRIER_OPTIONS.map(c => ({ value: c, label: c })),
                              ...(selectedCarrier && !CARRIER_OPTIONS.includes(selectedCarrier) ? [{ value: selectedCarrier, label: selectedCarrier }] : []),
                            ]}
                            value={selectedCarrier}
                            onChange={(v) => setSelectedCarrier(v)}
                            placeholder="Select Carrier"
                            searchPlaceholder="Search carriers..."
                            allowClear
                            allowCreate
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Booking Ref</Label>
                          <Input name="carrierBookingRef" placeholder="Booking Ref" className="text-sm" defaultValue={editingShipping?.data?.carrierBookingRef} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Vessel / Trip</Label>
                          <Input name="vessellTrip" placeholder="Vessel Name / Trip No" className="text-sm" defaultValue={editingShipping?.data?.vessellTrip} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Port of Lading</Label>
                          <Input name="portOfLading" placeholder="Port Name" className="text-sm" defaultValue={editingShipping?.data?.portOfLading} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Port of Entry</Label>
                          <Input name="portOfEntryShipTo" placeholder="Port Name" className="text-sm" defaultValue={editingShipping?.data?.portOfEntryShipTo} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Landing Date</Label>
                          <Input name="dateOfLanding" type="date" className="text-sm" defaultValue={editingShipping?.data?.dateOfLanding ? new Date(editingShipping.data.dateOfLanding).toISOString().split('T')[0] : ''} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">ETA</Label>
                          <Input name="ETA" type="date" className="text-sm" defaultValue={editingShipping?.data?.ETA ? new Date(editingShipping.data.ETA).toISOString().split('T')[0] : ''} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Updated ETA</Label>
                          <Input name="updatedETA" type="date" className="text-sm" defaultValue={editingShipping?.data?.updatedETA ? new Date(editingShipping.data.updatedETA).toISOString().split('T')[0] : ''} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Trucker Notified</Label>
                          <Input name="truckerNotifiedDate" type="date" className="text-sm" defaultValue={editingShipping?.data?.truckerNotifiedDate ? new Date(editingShipping.data.truckerNotifiedDate).toISOString().split('T')[0] : ''} />
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
                          <Input name="drums" type="number" className="text-sm" defaultValue={editingShipping?.data?.drums} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Pallets</Label>
                          <Input name="pallets" type="number" className="text-sm" defaultValue={editingShipping?.data?.pallets} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Gallons</Label>
                          <Input name="gallons" type="number" className="text-sm" defaultValue={editingShipping?.data?.gallons} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Net Wt (KG)</Label>
                          <Input name="netWeightKG" type="number" className="text-sm" defaultValue={editingShipping?.data?.netWeightKG} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Gross Wt (KG)</Label>
                          <Input name="grossWeightKG" type="number" className="text-sm" defaultValue={editingShipping?.data?.grossWeightKG} />
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
                          <Input name="invValue" type="number" step="0.01" className="text-sm" defaultValue={editingShipping?.data?.invValue} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Fees Amount ($)</Label>
                          <Input name="feesAmount" type="number" step="0.01" className="text-sm" defaultValue={editingShipping?.data?.feesAmount} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Est. Regular Duties ($)</Label>
                          <Input name="estimatedDuties" type="number" step="0.01" className="text-sm" defaultValue={editingShipping?.data?.estimatedDuties} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Est. Trump Duties ($)</Label>
                          <Input name="estTrumpDuties" type="number" step="0.01" className="text-sm" defaultValue={editingShipping?.data?.estTrumpDuties} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Genset Invoice #</Label>
                          <Input name="gensetInv" placeholder="Invoice #" className="text-sm" defaultValue={editingShipping?.data?.gensetInv} />
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
                          <Input name="itemNo" placeholder="Item Code" className="text-sm" defaultValue={editingShipping?.data?.itemNo} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Lot / Serial</Label>
                          <Input name="lotSerial" placeholder="Lot No" className="text-sm" defaultValue={editingShipping?.data?.lotSerial} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Type</Label>
                          <Input name="type" placeholder="e.g. Stock, Transit" className="text-sm" defaultValue={editingShipping?.data?.type} />
                        </div>
                        <div className="col-span-2 space-y-1">
                          <Label className="text-xs">Description</Label>
                          <Input name="description" placeholder="Item Description" className="text-sm" defaultValue={editingShipping?.data?.description} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Quantity</Label>
                          <Input name="qty" type="number" className="text-sm" defaultValue={editingShipping?.data?.qty} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Inventory Date</Label>
                          <Input name="inventoryDate" type="date" className="text-sm" defaultValue={editingShipping?.data?.inventoryDate ? new Date(editingShipping.data.inventoryDate).toISOString().split('T')[0] : ''} />
                        </div>
                      </div>
                    </div>


                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t bg-muted/20 flex items-center justify-end gap-2 shrink-0">
                  <Button type="button" variant="outline" size="sm" onClick={() => { setAddingShippingToCPO(null); setEditingShipping(null); setSelectedLocationForShipping(""); }}>Cancel</Button>
                  <Button type="submit" size="sm" disabled={actionLoading}>{actionLoading ? "Saving..." : (editingShipping ? "Update Shipping" : "Add Shipping")}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Drive Documents Modal (reads from MongoDB) */}
      <DriveDocumentsModal
        open={!!attachmentsOpen}
        onClose={() => {
          setAttachmentsOpen(null);
          if (po?.VBNumber) fetchEmailRecords(po.VBNumber);
        }}
        poNumber={attachmentsOpen?.poNumber || ''}
        spoNumber={attachmentsOpen?.spoNumber}
        shipNumber={attachmentsOpen?.shipNumber}
        onOpenLegacy={() => {
          // Close DriveDocuments and open legacy AttachmentsModal
          const saved = attachmentsOpen;
          setAttachmentsOpen(null);
          setTimeout(() => setLegacyAttachmentsOpen(saved), 100);
        }}
      />

      {/* Legacy Attachments Modal (Google Drive upload/folder) */}
      <AttachmentsModal
        open={!!legacyAttachmentsOpen}
        onClose={() => {
          setLegacyAttachmentsOpen(null);
          if (po?.VBNumber) fetchEmailRecords(po.VBNumber);
        }}
        poNumber={legacyAttachmentsOpen?.poNumber || ''}
        spoNumber={legacyAttachmentsOpen?.spoNumber}
        shipNumber={legacyAttachmentsOpen?.shipNumber}
        childFolders={legacyAttachmentsOpen?.childFolders}
      />

      {/* Timeline Modal */}
      <TimelineModal
        open={!!timelineOpen}
        onClose={() => setTimelineOpen(null)}
        VBNumber={timelineOpen?.VBNumber}
        VBSerialNumber={timelineOpen?.VBSerialNumber}
        VBShipmentNumber={timelineOpen?.VBShipmentNumber}
        title={timelineOpen?.title}
        users={users}
      />

      {/* Live Tracking Map Modal */}
      <Dialog open={!!liveTrackingOpen} onOpenChange={(v) => { if (!v) setLiveTrackingOpen(null); }}>
        <DialogContent className="max-w-[90vw] w-[1400px] h-[90vh] p-0 flex flex-col overflow-hidden bg-slate-50 gap-0">
          <DialogHeader className="px-6 py-4 border-b shrink-0 bg-white">
            <DialogTitle>{liveTrackingOpen?.title}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 w-full relative">
            {liveTrackingOpen && (
              <iframe
                src={`https://www.searates.com/container/tracking/?number=${liveTrackingOpen.containerNo}&type=CT`}
                className="absolute inset-0 w-full h-full border-0"
                allowFullScreen
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditPOOpen} onOpenChange={setIsEditPOOpen}>
        <DialogContent className="max-w-2xl overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Edit Purchase Order</DialogTitle>
            <DialogDescription className="sr-only">Update purchase order details</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditPOSubmit} className="grid gap-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="VBNumber">VB #</Label>
                <div className="relative">
                  <ShoppingCart className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="VBNumber"
                    className="pl-9"
                    value={editPOData.VBNumber || ""}
                    onChange={(e) =>
                      setEditPOData({ ...editPOData, VBNumber: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="date">Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="date"
                    type="date"
                    className="pl-9"
                    value={editPOData.date || ""}
                    onChange={(e) =>
                      setEditPOData({ ...editPOData, date: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="orderType">Order Type</Label>
                <select
                  id="orderType"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={editPOData.orderType || ""}
                  onChange={(e) =>
                    setEditPOData({ ...editPOData, orderType: e.target.value })
                  }
                  required
                >
                  <option value="" disabled>Select type...</option>
                  <option value="Export">Export</option>
                  <option value="Import">Import</option>
                  <option value="Dropship">Dropship</option>
                  <option value="Inventory">Inventory</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="category">Category</Label>
                <select
                  id="category"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={editPOData.category || ""}
                  onChange={(e) =>
                    setEditPOData({ ...editPOData, category: e.target.value })
                  }
                  required
                >
                  <option value="" disabled>Select category...</option>
                  <option value="CONVENTIONAL">Conventional</option>
                  <option value="ORGANIC">Organic</option>
                </select>
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setIsEditPOOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={actionLoading}>
                {actionLoading ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Transfer Order Dialog */}
      <TransferOrderDialog
        open={!!transferDialogShip}
        onOpenChange={(open) => { if (!open) setTransferDialogShip(null); }}
        shipmentId={transferDialogShip?._id || ""}
        shipmentLabel={transferDialogShip?.VBShipmentNumber || transferDialogShip?.svbid || ""}
        warehouseName={(() => {
          // Try to resolve warehouse from the CPO's warehouse field
          const cpo = po?.customerPO?.[transferDialogShip?._cpoIdx];
          return warehouseNameMap[cpo?.warehouse || ""] || cpo?.warehouse || "-";
        })()}
        warehouseId={(() => {
          const cpo = po?.customerPO?.[transferDialogShip?._cpoIdx];
          return cpo?.warehouse || "";
        })()}
        supplierId={transferDialogShip?.supplier || ""}
        supplierName={(() => {
          const rawSup = transferDialogShip?.supplier || '';
          return transferDialogShip?._displaySupplier || suppliers.find((s: any) => s._id === rawSup)?.name || supplierByLocationId[rawSup] || "-";
        })()}
        shipmentProducts={(() => {
          const pIds: string[] = Array.isArray(transferDialogShip?.products)
            ? transferDialogShip.products
            : typeof transferDialogShip?.products === 'string'
            ? transferDialogShip.products.split(',').filter(Boolean)
            : [];
          return pIds.map((pid: string) => ({ _id: pid, name: products[pid] || pid }));
        })()}
      />
    </TooltipProvider>
  );
}
