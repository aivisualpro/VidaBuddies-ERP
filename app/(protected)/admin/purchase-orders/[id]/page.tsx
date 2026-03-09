"use client";

import { useEffect, useState, useRef, use } from "react";
import { DetailPageSkeleton } from "@/components/skeletons";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import {
  ArrowLeft,
  ShoppingCart,
  Hash,
  Calendar,
  Tag,
  User,
  ChevronRight,
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
  Clock
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
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
import TimelineModal from "@/components/admin/timeline-modal";

const UOM_OPTIONS = [
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
  shipping?: Shipping[];
}

interface PurchaseOrder {
  _id: string;
  vbpoNo: string;
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
  const [po, setPO] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<Record<string, string>>({});
  const [locations, setLocations] = useState<Record<string, string>>({});
  const [customers, setCustomers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [supplierLocations, setSupplierLocations] = useState<Record<string, string>>({});
  const [selectedSupplierForShipping, setSelectedSupplierForShipping] = useState<string>("");
  const [products, setProducts] = useState<Record<string, string>>({});
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedCustomerForCPO, setSelectedCustomerForCPO] = useState<string>("");
  const [selectedLocationForCPO, setSelectedLocationForCPO] = useState<string>("");
  const [selectedWarehouseForCPO, setSelectedWarehouseForCPO] = useState<string>("");
  const [selectedUOMForCPO, setSelectedUOMForCPO] = useState<string>("");
  const [selectedCpoId, setSelectedCpoId] = useState<string | null>(null);

  // Action States
  const [isAddCPOOpen, setIsAddCPOOpen] = useState(false);
  const [editingCPO, setEditingCPO] = useState<{ idx: number, data: any } | null>(null);
  const [autoPoNo, setAutoPoNo] = useState<string>("");
  const [autoSvbid, setAutoSvbid] = useState<string>("");
  const [addingShippingToCPO, setAddingShippingToCPO] = useState<{ idx: number, poNo: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [actionsVisible, setActionsVisible] = useState(false); // Helper if needed
  const [editingShipping, setEditingShipping] = useState<{ cpoIdx: number, shipIdx: number, data: any } | null>(null);
  const [attachmentsOpen, setAttachmentsOpen] = useState<{ poNumber: string; spoNumber?: string; shipNumber?: string; childFolders?: string[] } | null>(null);
  const [timelineOpen, setTimelineOpen] = useState<{ vbpoNo?: string; poNo?: string; svbid?: string; title?: string } | null>(null);

  const { setLeftContent, setRightContent } = useHeaderActions();

  const fetchCustomers = async () => {
    try {
      const response = await fetch("/api/admin/customers");
      const data = await response.json();
      if (Array.isArray(data)) {
        setCustomers(data);
        const mapping: Record<string, string> = {};
        data.forEach((cust: any) => {
          if (cust.location && Array.isArray(cust.location)) {
            cust.location.forEach((loc: any) => {
              if (loc.vbId) {
                mapping[loc.vbId] = loc.locationName || loc.vbId;
              }
            });
          }
        });
        setLocations(mapping);
      }
    } catch (error) {
      console.error("Failed to fetch customers", error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/admin/users");
      const data = await response.json();
      if (Array.isArray(data)) {
        const mapping: Record<string, string> = {};
        data.forEach((u: any) => {
          mapping[u.email.toLowerCase()] = u.name;
        });
        setUsers(mapping);
      }
    } catch (error) {
      console.error("Failed to fetch users", error);
    }
  };

  const fetchPO = async () => {
    try {
      const response = await fetch(`/api/admin/purchase-orders/${id}`);
      if (!response.ok) throw new Error("Failed to fetch purchase order");
      const data = await response.json();
      setPO(data);
    } catch (error) {
      toast.error("Error loading purchase order details");
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const response = await fetch("/api/admin/suppliers");
      const data = await response.json();
      if (Array.isArray(data)) {
        setSuppliers(data);
        // Also build a flat mapping for display in shipping cards
        const mapping: Record<string, string> = {};
        data.forEach((sup: any) => {
          if (sup.location && Array.isArray(sup.location)) {
            sup.location.forEach((loc: any) => {
              if (loc.vbId) {
                mapping[loc.vbId] = loc.locationName || `${sup.name} - ${loc.city}` || loc.vbId;
              }
            });
          }
        });
        setSupplierLocations(mapping);
      }
    } catch (error) {
      console.error("Failed to fetch suppliers", error);
    }
  };

  // Get filtered locations for the selected supplier
  const getSupplierLocationOptions = (): { id: string; name: string }[] => {
    if (!selectedSupplierForShipping) return [];
    const sup = suppliers.find((s: any) => s._id === selectedSupplierForShipping || s.vbId === selectedSupplierForShipping);
    if (!sup?.location) return [];
    return sup.location.filter((loc: any) => loc.vbId).map((loc: any) => ({
      id: loc.vbId as string,
      name: (loc.locationName || `${sup.name} - ${loc.city}` || loc.vbId) as string,
    }));
  };

  const fetchProducts = async () => {
    try {
      const response = await fetch("/api/admin/products");
      const data = await response.json();
      if (Array.isArray(data)) {
        const mapping: Record<string, string> = {};
        data.forEach((p: any) => {
          mapping[p._id] = p.name;
          if (p.vbId) mapping[p.vbId] = p.name;
        });
        setProducts(mapping);
      }
    } catch (error) {
      console.error("Failed to fetch products", error);
    }
  };

  const fetchWarehouses = async () => {
    try {
      const response = await fetch("/api/admin/warehouse");
      const data = await response.json();
      if (Array.isArray(data)) {
        setWarehouses(data);
      }
    } catch (error) {
      console.error("Failed to fetch warehouses", error);
    }
  };

  useEffect(() => {
    fetchPO();
    fetchUsers();
    fetchCustomers();
    fetchSuppliers();
    fetchProducts();
    fetchWarehouses();
  }, [id]);

  // Auto-select single location when customer changes
  useEffect(() => {
    if (selectedCustomerForCPO) {
      const cust = customers.find((c: any) => c.vbId === selectedCustomerForCPO);
      if (cust?.location?.length === 1) {
        setSelectedLocationForCPO(cust.location[0].vbId);
      } else {
        // Reset location if customer changed (unless editing)
        if (!editingCPO) setSelectedLocationForCPO("");
      }
    } else {
      setSelectedLocationForCPO("");
    }
  }, [selectedCustomerForCPO, customers]);

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

  const updateShippingField = async (cpoIdx: number, shipIdx: number, field: string, value: any) => {
    // Optimistic Update
    if (!po) return;

    const newPO = { ...po };
    if (newPO.customerPO[cpoIdx]?.shipping?.[shipIdx]) {
      newPO.customerPO[cpoIdx].shipping[shipIdx] = {
        ...newPO.customerPO[cpoIdx].shipping[shipIdx],
        [field]: value
      };
      setPO(newPO);
    }

    try {
      const updateKey = `customerPO.${cpoIdx}.shipping.${shipIdx}.${field}`;
      const response = await fetch(`/api/admin/purchase-orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [updateKey]: value })
      });

      if (!response.ok) throw new Error("Update failed");

      // Quietly success or toast
      // toast.success("Updated successfully");
    } catch (error) {
      toast.error("Failed to update");
      // Revert (could fetchPO() to be safe)
      fetchPO();
    }
  };

  const handleDeleteCPO = (cpoId: string, idx: number) => {
    toast("Delete Customer PO?", {
      description: "Click 'Delete' to confirm. This cannot be undone.",
      action: {
        label: "Delete",
        onClick: async () => {
          setPO((currentPO) => {
            if (!currentPO) return currentPO;
            const newCPOs = [...currentPO.customerPO];
            // Ensure we are deleting the correct index or find by ID if safe
            // For now, trusting index as per original logic, but finding by ID is safer for robustness
            const realIdx = newCPOs.findIndex(c => c._id === cpoId);
            if (realIdx !== -1) {
              newCPOs.splice(realIdx, 1);
              return { ...currentPO, customerPO: newCPOs };
            }
            return currentPO;
          });

          try {
            const response = await fetch(`/api/admin/purchase-orders/${id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                $pull: { customerPO: { _id: cpoId } }
              })
            });

            if (!response.ok) throw new Error("Failed to delete");
            toast.success("Customer PO deleted");
            fetchPO();
          } catch (e) {
            toast.error("Error deleting Customer PO");
            fetchPO(); // Revert/Refresh
          }
        }
      }
    });
  };

  const handleSaveCPO = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    const formData = new FormData(e.target as HTMLFormElement);
    const data = Object.fromEntries(formData.entries());

    // Basic formatting
    const formattedData: any = { ...data };
    if (formattedData.qtyOrdered) formattedData.qtyOrdered = Number(formattedData.qtyOrdered);
    if (formattedData.qtyReceived) formattedData.qtyReceived = Number(formattedData.qtyReceived);

    try {
      let body = {};
      if (editingCPO) {
        // Update specific fields using dot notation
        const updateObj: any = {};
        Object.keys(formattedData).forEach(key => {
          updateObj[`customerPO.${editingCPO.idx}.${key}`] = formattedData[key];
        });
        body = updateObj;
      } else {
        // Add new
        body = { $push: { customerPO: formattedData } };
      }

      const response = await fetch(`/api/admin/purchase-orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) throw new Error("Failed to save");

      toast.success(editingCPO ? "Customer PO Updated" : "Customer PO Added");
      setIsAddCPOOpen(false);
      setEditingCPO(null);
      fetchPO();
    } catch (e) {
      toast.error("Error saving Customer PO");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteShipping = (shipId: string, cpoIdx: number, shipIdx: number) => {
    toast("Delete Shipping Record?", {
      description: "Click 'Delete' to confirm. This action cannot be undone.",
      action: {
        label: "Delete",
        onClick: async () => {
          // Get shipping svbid and parent CPO poNo before removing from state
          const shipData = po?.customerPO?.[cpoIdx]?.shipping?.[shipIdx];
          const svbid = shipData?.svbid;
          const cpoPoNo = po?.customerPO?.[cpoIdx]?.poNo;
          const poNo = po?.vbpoNo;

          setPO((currentPO) => {
            if (!currentPO) return currentPO;
            const newCPOs = [...currentPO.customerPO];

            if (newCPOs[cpoIdx]?.shipping) {
              const targetShipIdx = newCPOs[cpoIdx].shipping.findIndex((s: any) => s._id === shipId);
              if (targetShipIdx !== -1) {
                newCPOs[cpoIdx].shipping.splice(targetShipIdx, 1);
                return { ...currentPO, customerPO: newCPOs };
              }
            }
            if (newCPOs[cpoIdx]?.shipping?.[shipIdx]?._id === shipId) {
              newCPOs[cpoIdx].shipping.splice(shipIdx, 1);
              return { ...currentPO, customerPO: newCPOs };
            }

            return currentPO;
          });

          try {
            const response = await fetch(`/api/admin/purchase-orders/${id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                $pull: { [`customerPO.${cpoIdx}.shipping`]: { _id: shipId } }
              })
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
            fetchPO();
          } catch (e) {
            toast.error("Error deleting shipping");
            fetchPO();
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

    // Auto-generate svbid if empty (for new shipping records)
    if (!editingShipping && (!formattedData.svbid || formattedData.svbid.trim() === '') && addingShippingToCPO) {
      const cpo = po?.customerPO?.[addingShippingToCPO.idx];
      const existingShipCount = cpo?.shipping?.length || 0;
      formattedData.svbid = `${addingShippingToCPO.poNo}-${existingShipCount + 1}`;
    }

    // Numbers
    ['drums', 'pallets', 'gallons', 'netWeightKG', 'grossWeightKG', 'invValue', 'estTrumpDuties', 'feesAmount', 'estimatedDuties', 'qty'].forEach(k => {
      if (formattedData[k]) formattedData[k] = Number(formattedData[k]);
    });

    // Convert products from comma-separated string to array
    if (typeof formattedData.products === 'string') {
      formattedData.products = formattedData.products.split(',').filter(Boolean);
    }

    try {
      let body = {};
      if (editingShipping) {
        const updateObj: any = {};
        Object.keys(formattedData).forEach(key => {
          updateObj[`customerPO.${editingShipping.cpoIdx}.shipping.${editingShipping.shipIdx}.${key}`] = formattedData[key];
        });
        body = updateObj;
      } else if (addingShippingToCPO) {
        body = { $push: { [`customerPO.${addingShippingToCPO.idx}.shipping`]: formattedData } };
      }

      const response = await fetch(`/api/admin/purchase-orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) throw new Error("Failed to save shipping");

      toast.success(editingShipping ? "Shipping Updated" : "Shipping Added");
      setAddingShippingToCPO(null);
      setEditingShipping(null);
      fetchPO();
    } catch (e) {
      toast.error("Error saving shipping");
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
          <h1 className="text-lg font-bold leading-none uppercase bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">{po.vbpoNo}</h1>
          <span className="text-sm text-muted-foreground font-medium uppercase tracking-tight">{po.orderType}</span>
          <span className="text-sm text-gray-300">•</span>
          <span className="text-sm text-muted-foreground font-medium uppercase tracking-tight">{po.category}</span>
        </div>
      </div>
    );

    setRightContent(
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="h-8" onClick={() => toast.info("Edit Purchase Order")}>
          <Pencil className="h-3.5 w-3.5 mr-2" />
          Edit
        </Button>
        <Button variant="outline" size="sm" className="h-8" onClick={() => setTimelineOpen({ vbpoNo: po?.vbpoNo, title: `Timeline — ${po?.vbpoNo}` })}>
          <Clock className="h-3.5 w-3.5 mr-2" />
          Timeline
        </Button>
        <Button variant="outline" size="sm" className="h-8" onClick={() => {
          // Auto-generate next CPO poNo
          const existingCount = po?.customerPO?.length || 0;
          const nextPoNo = `${po?.vbpoNo || 'VB'}-${existingCount + 1}`;
          setAutoPoNo(nextPoNo);
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
  }, [po, users, setLeftContent, setRightContent, router]);

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
        {/* Global Page Background Pattern Overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.05] mix-blend-multiply dark:mix-blend-overlay overflow-hidden">
          <img
            src="/images/nano_banana_bg.png"
            alt=""
            className="w-full h-full object-cover scale-150 rotate-1 rounded-full opacity-60"
          />
        </div>

        <div className="grid grid-cols-10 gap-6 p-0 h-full relative z-10">

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
                    {/* Background Nano Banana Gradient & Pattern */}
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-40 group-hover:opacity-100 transition-opacity duration-1000" />
                    <img
                      src="/images/nano_banana_bg.png"
                      alt="bg"
                      className="absolute inset-0 w-full h-full object-cover opacity-[0.15] dark:opacity-40 mix-blend-multiply dark:mix-blend-overlay group-hover:scale-110 transition-all duration-1000 pointer-events-none"
                    />

                    <div className="relative z-10 flex flex-col gap-4">
                      {/* Row 1: poNo and customerPONo (Inline) */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-black leading-tight text-foreground uppercase tracking-tight">
                            {cpo.poNo || "UNNAMED"}
                          </h3>
                          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-muted/40 rounded-lg border border-border/50">
                            <span className="text-[9px] font-black tracking-widest text-muted-foreground uppercase opacity-60">REF:</span>
                            <span className="text-[9px] font-black tracking-widest text-foreground uppercase">
                              {cpo.customerPONo || '-'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <Separator className="bg-border/30" />

                      {/* Row 2: Site Location (Resolved Name) */}
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-primary" />
                          <p className="text-[12px] font-bold uppercase tracking-tight text-foreground/90 truncate">
                            {locations[cpo.customerLocation || ""] || cpo.customerLocation || "Generic Site"}
                          </p>
                        </div>
                      </div>

                      {/* Row 3: Dates */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em] opacity-70">PO Date</p>
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3 w-3 text-primary/70" />
                            <p className="text-[11px] font-bold text-foreground/80">{formatDate(cpo.customerPODate)}</p>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em] opacity-70">Requested</p>
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3 w-3 text-primary" />
                            <p className="text-[11px] font-bold text-foreground">{formatDate(cpo.requestedDeliveryDate)}</p>
                          </div>
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
                              {cpo.warehouse || "STANDBY"}
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
                              setAttachmentsOpen({ poNumber: po?.vbpoNo || '', spoNumber: cpo.poNo || undefined, childFolders: shipFolders });
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
                              setEditingCPO({ idx, data: cpo });
                              setSelectedCustomerForCPO(cpo.customerPONo || "");
                              setSelectedLocationForCPO(cpo.customerLocation || "");
                              setSelectedWarehouseForCPO(cpo.warehouse || "");
                              setSelectedUOMForCPO(cpo.UOM || "");
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
                              setTimelineOpen({ vbpoNo: po?.vbpoNo, poNo: cpo.poNo, title: `Timeline — ${cpo.poNo}` });
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
                              // Auto-generate svbid: {cpo.poNo}-{nextShipIndex}
                              const existingShipCount = cpo.shipping?.length || 0;
                              const nextSvbid = `${cpo.poNo || ''}-${existingShipCount + 1}`;
                              setAutoSvbid(nextSvbid);
                              setSelectedSupplierForShipping("");
                              setAddingShippingToCPO({ idx, poNo: cpo.poNo || '' });
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
                {filteredShippings.length || 0}
              </span>
            </div>

            <div className="space-y-4">
              {filteredShippings.length > 0 ? (
                filteredShippings.map((ship: any, idx) => (
                  <div key={idx} className="relative overflow-hidden rounded-3xl bg-card/60 backdrop-blur-sm text-card-foreground border border-border shadow-sm p-6 space-y-4">
                    {/* Background Pattern */}
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-transparent opacity-40 pointer-events-none" />
                    <img
                      src="/images/nano_banana_bg.png"
                      alt="bg"
                      className="absolute inset-0 w-full h-full object-cover opacity-[0.10] mix-blend-multiply dark:mix-blend-overlay group-hover:scale-110 transition-all duration-1000 pointer-events-none"
                    />

                    {/* Actions: Attachments/Edit/Delete (Top Right) */}
                    <div className="absolute top-5 right-5 z-20 flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-muted-foreground hover:text-primary hover:bg-primary/10"
                        onClick={() => {
                          // Find the CPO poNo for the folder path
                          const cpo = po?.customerPO?.[ship._cpoIdx];
                          const spoNo = cpo?.poNo || `SPO-${ship._cpoIdx}`;
                          const shipNo = ship.svbid || '';
                          setAttachmentsOpen({ poNumber: po?.vbpoNo || '', spoNumber: spoNo, shipNumber: shipNo || undefined });
                        }}
                      >
                        <Paperclip className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-muted-foreground hover:text-primary hover:bg-primary/10"
                        onClick={() => setTimelineOpen({ vbpoNo: po?.vbpoNo, poNo: po?.customerPO?.[ship._cpoIdx]?.poNo, svbid: ship.svbid, title: `Timeline — ${ship.svbid || 'Shipping'}` })}
                      >
                        <Clock className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-muted-foreground hover:text-primary hover:bg-primary/10"
                        onClick={() => {
                          // Auto-detect which supplier owns this location
                          const locId = ship.supplierLocation;
                          if (locId) {
                            const matchedSup = suppliers.find((s: any) => s.location?.some((l: any) => l.vbId === locId));
                            setSelectedSupplierForShipping(matchedSup?._id || matchedSup?.vbId || "");
                          } else {
                            setSelectedSupplierForShipping(ship.supplier || "");
                          }
                          setEditingShipping({ cpoIdx: ship._cpoIdx, shipIdx: ship._shipIdx, data: ship });
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDeleteShipping(ship._id, ship._cpoIdx, ship._shipIdx);
                        }}
                      >
                        <Trash className="h-3 w-3" />
                      </Button>
                    </div>

                    {/* Row 1: VBID | Container | BOL | Status */}
                    <div className="grid grid-cols-4 gap-4 relative z-10">
                      <div className="space-y-1">
                        <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest opacity-70">VBID</p>
                        <p className="text-sm font-bold">{ship.svbid || po.vbpoNo}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest opacity-70">Container</p>
                        <p className="text-sm font-bold uppercase">{ship.containerNo || '-'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest opacity-70">BOL Number</p>
                        <p className="text-sm font-bold uppercase">{ship.BOLNumber || '-'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest opacity-70">Status</p>
                        <p className="text-sm font-bold uppercase">{ship.status || 'Active'}</p>
                      </div>
                    </div>

                    <Separator className="bg-border/30 relative z-10" />

                    {/* Row 2: Supplier Info Grid */}
                    <div className="grid grid-cols-3 gap-2 bg-muted/30 dark:bg-foreground/5 rounded-2xl p-3 border border-border/50 relative z-10">
                      <div className="flex flex-col items-center gap-1 text-center">
                        <MapPin className="h-4 w-4 text-primary/60" />
                        <p className="text-[10px] font-black text-foreground truncate w-full px-1" title={supplierLocations[ship.supplierLocation] || ship.supplierLocation}>
                          {supplierLocations[ship.supplierLocation] || ship.supplierLocation || '-'}
                        </p>
                        <p className="text-[8px] font-black uppercase text-muted-foreground/60 tracking-widest">Supplier Loc</p>
                      </div>
                      <div className="flex flex-col items-center gap-1 text-center border-x border-border/50">
                        <Hash className="h-4 w-4 text-primary" />
                        <p className="text-[11px] font-black text-foreground truncate w-full px-1">
                          {ship.supplierPO || '-'}
                        </p>
                        <p className="text-[8px] font-black uppercase text-muted-foreground/60 tracking-widest">Supplier PO</p>
                      </div>
                      <div className="flex flex-col items-center gap-1 text-center">
                        <Calendar className="h-4 w-4 text-primary/60" />
                        <p className="text-[11px] font-black text-foreground">
                          {formatDate(ship.supplierPoDate)}
                        </p>
                        <p className="text-[8px] font-black uppercase text-muted-foreground/60 tracking-widest">PO Date</p>
                      </div>
                    </div>

                    {/* Row 3 & 4: Logistics & Timeline */}
                    <div className="bg-muted/30 dark:bg-foreground/5 rounded-2xl border border-border/50 relative z-10 flex flex-col">
                      <div className="grid grid-cols-3 gap-2 p-3">
                        <div className="flex flex-col items-center gap-1 text-center">
                          <Truck className="h-4 w-4 text-primary/60" />
                          <p className="text-[10px] font-black text-foreground truncate w-full px-1" title={ship.carrier}>
                            {ship.carrier || '-'}
                          </p>
                          <p className="text-[8px] font-black uppercase text-muted-foreground/60 tracking-widest">Carrier</p>
                        </div>
                        <div className="flex flex-col items-center gap-1 text-center border-x border-border/50">
                          <Tag className="h-4 w-4 text-primary" />
                          <p className="text-[11px] font-black text-foreground truncate w-full px-1" title={ship.carrierBookingRef}>
                            {ship.carrierBookingRef || '-'}
                          </p>
                          <p className="text-[8px] font-black uppercase text-muted-foreground/60 tracking-widest">Booking Ref</p>
                        </div>
                        <div className="flex flex-col items-center gap-1 text-center">
                          <Box className="h-4 w-4 text-primary/60" />
                          <p className="text-[11px] font-black text-foreground truncate w-full px-1" title={ship.vessellTrip}>
                            {ship.vessellTrip || '-'}
                          </p>
                          <p className="text-[8px] font-black uppercase text-muted-foreground/60 tracking-widest">Vessel / Trip</p>
                        </div>
                      </div>

                      <Separator className="bg-border/30" />

                      <div className="grid grid-cols-5 gap-0 p-2">
                        <div className="flex flex-col items-center gap-1 text-center border-r border-border/50 px-1">
                          <MapPin className="h-3.5 w-3.5 text-primary/60" />
                          <p className="text-[9px] font-black text-foreground truncate w-full" title={ship.portOfLading}>{ship.portOfLading || '-'}</p>
                          <p className="text-[7px] font-black uppercase text-muted-foreground/60 tracking-widest">Lading</p>
                        </div>
                        <div className="flex flex-col items-center gap-1 text-center border-r border-border/50 px-1">
                          <MapPin className="h-3.5 w-3.5 text-primary/60" />
                          <p className="text-[9px] font-black text-foreground truncate w-full" title={ship.portOfEntryShipTo}>{ship.portOfEntryShipTo || '-'}</p>
                          <p className="text-[7px] font-black uppercase text-muted-foreground/60 tracking-widest">Entry</p>
                        </div>
                        <div className="flex flex-col items-center gap-1 text-center border-r border-border/50 px-1">
                          <Calendar className="h-3.5 w-3.5 text-primary/60" />
                          <p className="text-[9px] font-black text-foreground truncate w-full">{formatDate(ship.dateOfLanding)}</p>
                          <p className="text-[7px] font-black uppercase text-muted-foreground/60 tracking-widest">Landing</p>
                        </div>
                        <div className="flex flex-col items-center gap-1 text-center border-r border-border/50 px-1">
                          <Calendar className="h-3.5 w-3.5 text-primary/60" />
                          <p className="text-[9px] font-black text-foreground truncate w-full">{formatDate(ship.ETA)}</p>
                          <p className="text-[7px] font-black uppercase text-muted-foreground/60 tracking-widest">ETA</p>
                        </div>
                        <div className="flex flex-col items-center gap-1 text-center px-1">
                          <Calendar className="h-3.5 w-3.5 text-primary" />
                          <p className="text-[9px] font-black text-foreground truncate w-full">{formatDate(ship.updatedETA)}</p>
                          <p className="text-[7px] font-black uppercase text-muted-foreground/60 tracking-widest">Upd ETA</p>
                        </div>
                      </div>
                    </div>

                    <Separator className="bg-border/30 relative z-10" />

                    {/* Row 4: Cargo & Financials Card */}
                    <div className="bg-muted/30 dark:bg-foreground/5 rounded-2xl border border-border/50 relative z-10 flex flex-col mt-4">
                      {/* Row 1: Product Info */}
                      <div className="grid grid-cols-5 gap-0 p-2">
                        {/* Product (Wider) */}
                        <div className="col-span-2 flex flex-col items-center justify-center text-center border-r border-border/50 px-2 py-1">
                          <p className="text-[10px] font-black text-foreground whitespace-normal break-words leading-tight" title={
                            (() => {
                              const productIds = Array.isArray(ship.products) ? ship.products
                                : typeof ship.products === 'string' ? ship.products.split(',').filter(Boolean)
                                  : ship.product ? [ship.product] : [];
                              return productIds.map((pid: string) => products[pid] || pid).join(', ');
                            })()
                          }>
                            {(() => {
                              const productIds = Array.isArray(ship.products) ? ship.products
                                : typeof ship.products === 'string' ? ship.products.split(',').filter(Boolean)
                                  : ship.product ? [ship.product] : [];
                              return productIds.length > 0
                                ? productIds.map((pid: string) => products[pid] || pid).join(', ')
                                : '-';
                            })()}
                          </p>
                        </div>
                        {/* Drums */}
                        <div className="flex flex-col items-center gap-1 text-center border-r border-border/50 px-1">
                          <Box className="h-3.5 w-3.5 text-primary/60" />
                          <p className="text-[9px] font-black text-foreground truncate w-full">{ship.drums || 0}</p>
                          <p className="text-[7px] font-black uppercase text-muted-foreground/60 tracking-widest">Drums</p>
                        </div>
                        {/* Pallets */}
                        <div className="flex flex-col items-center gap-1 text-center border-r border-border/50 px-1">
                          <Box className="h-3.5 w-3.5 text-primary/60" />
                          <p className="text-[9px] font-black text-foreground truncate w-full">{ship.pallets || 0}</p>
                          <p className="text-[7px] font-black uppercase text-muted-foreground/60 tracking-widest">Pallets</p>
                        </div>
                        {/* Gallons */}
                        <div className="flex flex-col items-center gap-1 text-center px-1">
                          <Box className="h-3.5 w-3.5 text-primary/60" />
                          <p className="text-[9px] font-black text-foreground truncate w-full">{ship.gallons || 0}</p>
                          <p className="text-[7px] font-black uppercase text-muted-foreground/60 tracking-widest">Gallons</p>
                        </div>
                      </div>

                      <Separator className="bg-border/30" />

                      {/* Row 2: Values & Weights */}
                      <div className="grid grid-cols-5 gap-0 p-2">
                        {/* Inv Value */}
                        <div className="flex flex-col items-center gap-1 text-center border-r border-border/50 px-1">
                          <Hash className="h-3.5 w-3.5 text-primary/60" />
                          <p className="text-[9px] font-black text-foreground truncate w-full">${ship.invValue || 0}</p>
                          <p className="text-[7px] font-black uppercase text-muted-foreground/60 tracking-widest">Inv Value</p>
                        </div>
                        {/* Est. Duties */}
                        <div className="flex flex-col items-center gap-1 text-center border-r border-border/50 px-1">
                          <Hash className="h-3.5 w-3.5 text-primary/60" />
                          <p className="text-[9px] font-black text-foreground truncate w-full">${ship.estTrumpDuties || 0}</p>
                          <p className="text-[7px] font-black uppercase text-muted-foreground/60 tracking-widest">Est. Duties</p>
                        </div>
                        {/* Net KG */}
                        <div className="flex flex-col items-center gap-1 text-center border-r border-border/50 px-1">
                          <Box className="h-3.5 w-3.5 text-primary/60" />
                          <p className="text-[9px] font-black text-foreground truncate w-full">{ship.netWeightKG || 0}</p>
                          <p className="text-[7px] font-black uppercase text-muted-foreground/60 tracking-widest">Net KG</p>
                        </div>
                        {/* Gross KG */}
                        <div className="flex flex-col items-center gap-1 text-center border-r border-border/50 px-1">
                          <Box className="h-3.5 w-3.5 text-primary/60" />
                          <p className="text-[9px] font-black text-foreground truncate w-full">{ship.grossWeightKG || 0}</p>
                          <p className="text-[7px] font-black uppercase text-muted-foreground/60 tracking-widest">Gross KG</p>
                        </div>
                        {/* Tico VB */}
                        <div className="flex flex-col items-center gap-1 text-center px-1">
                          <Tag className="h-3.5 w-3.5 text-primary" />
                          <p className="text-[9px] font-black text-foreground truncate w-full">{ship.ticoVB || '-'}</p>
                          <p className="text-[7px] font-black uppercase text-muted-foreground/60 tracking-widest">Tico VB</p>
                        </div>
                      </div>
                    </div>

                    {/* Row 5: Logistics & Documentation Master Grid */}
                    <div className="bg-muted/30 dark:bg-foreground/5 rounded-2xl border border-border/50 relative z-10 flex flex-col mt-4">

                      {/* Grid Row 1: Arrival | Genset | Fees */}
                      <div className="grid grid-cols-5 gap-0 p-2 border-b border-border/30">
                        {/* Arrival Notice */}
                        <div className="flex flex-col items-center gap-1.5 text-center border-r border-border/50 px-1">
                          <p className="text-[9px] font-black uppercase text-muted-foreground">Arrival Notice</p>
                          <Switch checked={!!ship.isArrivalNotice} onCheckedChange={(v) => updateShippingField(ship._cpoIdx, ship._shipIdx, 'isArrivalNotice', v)} className="scale-75 data-[state=checked]:bg-primary" />
                        </div>
                        {/* Genset Req */}
                        <div className="flex flex-col items-center gap-1.5 text-center border-r border-border/50 px-1">
                          <p className="text-[9px] font-black uppercase text-muted-foreground">Genset Req</p>
                          <Switch checked={!!ship.isGensetRequired} onCheckedChange={(v) => updateShippingField(ship._cpoIdx, ship._shipIdx, 'isGensetRequired', v)} className="scale-75 data-[state=checked]:bg-primary" />
                        </div>
                        {/* Genset Inv */}
                        <div className="flex flex-col items-center gap-1 text-center border-r border-border/50 px-1 pt-1.5">
                          <p className="text-[10px] font-bold text-foreground truncate w-full">{ship.gensetInv || '-'}</p>
                          <p className="text-[8px] font-black uppercase text-muted-foreground/60 tracking-widest">Genset Inv</p>
                        </div>
                        {/* Genset Emailed */}
                        <div className="flex flex-col items-center gap-1.5 text-center border-r border-border/50 px-1">
                          <p className="text-[9px] font-black uppercase text-muted-foreground">Genset Emailed</p>
                          <Switch checked={!!ship.gensetEmailed} onCheckedChange={(v) => updateShippingField(ship._cpoIdx, ship._shipIdx, 'gensetEmailed', v)} className="scale-75 data-[state=checked]:bg-primary" />
                        </div>
                        {/* Collect Fees */}
                        <div className="flex flex-col items-center gap-1.5 text-center px-1">
                          <p className="text-[9px] font-black uppercase text-muted-foreground">Collect Fees</p>
                          <Switch checked={!!ship.isCollectFeesPaid} onCheckedChange={(v) => updateShippingField(ship._cpoIdx, ship._shipIdx, 'isCollectFeesPaid', v)} className="scale-75 data-[state=checked]:bg-primary" />
                        </div>
                      </div>

                      {/* Grid Row 2: Financials | DO | Docs A */}
                      <div className="grid grid-cols-5 gap-0 p-2 border-b border-border/30">
                        {/* Amount */}
                        <div className="flex flex-col items-center gap-1 text-center border-r border-border/50 px-1 pt-1.5">
                          <p className="text-[10px] font-bold text-foreground">${ship.feesAmount || 0}</p>
                          <p className="text-[8px] font-black uppercase text-muted-foreground/60 tracking-widest">Amount</p>
                        </div>
                        {/* Est Duties */}
                        <div className="flex flex-col items-center gap-1 text-center border-r border-border/50 px-1 pt-1.5">
                          <p className="text-[10px] font-bold text-foreground">${ship.estimatedDuties || 0}</p>
                          <p className="text-[8px] font-black uppercase text-muted-foreground/60 tracking-widest">Est Duties</p>
                        </div>
                        {/* DO Created */}
                        <div className="flex flex-col items-center gap-1.5 text-center border-r border-border/50 px-1">
                          <p className="text-[9px] font-black uppercase text-muted-foreground">DO Created</p>
                          <Switch checked={!!ship.isDOCreated} onCheckedChange={(v) => updateShippingField(ship._cpoIdx, ship._shipIdx, 'isDOCreated', v)} className="scale-75 data-[state=checked]:bg-primary" />
                        </div>
                        {/* Sup Inv */}
                        <div className="flex flex-col items-center gap-1.5 text-center border-r border-border/50 px-1">
                          <p className="text-[9px] font-black uppercase text-muted-foreground">Sup Inv</p>
                          <Switch checked={!!ship.isSupplierInvoice} onCheckedChange={(v) => updateShippingField(ship._cpoIdx, ship._shipIdx, 'isSupplierInvoice', v)} className="scale-75 data-[state=checked]:bg-primary" />
                        </div>
                        {/* Man Sec ISF */}
                        <div className="flex flex-col items-center gap-1.5 text-center px-1">
                          <p className="text-[9px] font-black uppercase text-muted-foreground">Man Sec ISF</p>
                          <Switch checked={!!ship.isManufacturerSecurityISF} onCheckedChange={(v) => updateShippingField(ship._cpoIdx, ship._shipIdx, 'isManufacturerSecurityISF', v)} className="scale-75 data-[state=checked]:bg-primary" />
                        </div>
                      </div>

                      {/* Grid Row 3: Docs B */}
                      <div className="grid grid-cols-5 gap-0 p-2 border-b border-border/30">
                        {/* VB ISF */}
                        <div className="flex flex-col items-center gap-1.5 text-center border-r border-border/50 px-1">
                          <p className="text-[9px] font-black uppercase text-muted-foreground">VB ISF</p>
                          <Switch checked={!!ship.isVidaBuddiesISFFiling} onCheckedChange={(v) => updateShippingField(ship._cpoIdx, ship._shipIdx, 'isVidaBuddiesISFFiling', v)} className="scale-75 data-[state=checked]:bg-primary" />
                        </div>
                        {/* Pack List */}
                        <div className="flex flex-col items-center gap-1.5 text-center border-r border-border/50 px-1">
                          <p className="text-[9px] font-black uppercase text-muted-foreground">Pack List</p>
                          <Switch checked={!!ship.isPackingList} onCheckedChange={(v) => updateShippingField(ship._cpoIdx, ship._shipIdx, 'isPackingList', v)} className="scale-75 data-[state=checked]:bg-primary" />
                        </div>
                        {/* Cert Analysis */}
                        <div className="flex flex-col items-center gap-1.5 text-center border-r border-border/50 px-1">
                          <p className="text-[9px] font-black uppercase text-muted-foreground">Cert Analysis</p>
                          <Switch checked={!!ship.isCertificateOfAnalysis} onCheckedChange={(v) => updateShippingField(ship._cpoIdx, ship._shipIdx, 'isCertificateOfAnalysis', v)} className="scale-75 data-[state=checked]:bg-primary" />
                        </div>
                        {/* Cert Origin */}
                        <div className="flex flex-col items-center gap-1.5 text-center border-r border-border/50 px-1">
                          <p className="text-[9px] font-black uppercase text-muted-foreground">Cert Origin</p>
                          <Switch checked={!!ship.isCertificateOfOrigin} onCheckedChange={(v) => updateShippingField(ship._cpoIdx, ship._shipIdx, 'isCertificateOfOrigin', v)} className="scale-75 data-[state=checked]:bg-primary" />
                        </div>
                        {/* Bill of Lading */}
                        <div className="flex flex-col items-center gap-1.5 text-center px-1">
                          <p className="text-[9px] font-black uppercase text-muted-foreground">Bill of Lading</p>
                          <Switch checked={!!ship.IsBillOfLading || !!ship.isBillOfLading} onCheckedChange={(v) => updateShippingField(ship._cpoIdx, ship._shipIdx, 'IsBillOfLading', v)} className="scale-75 data-[state=checked]:bg-primary" />
                        </div>
                      </div>

                      {/* Grid Row 4: Final Status & Logistics */}
                      <div className="grid grid-cols-5 gap-0 p-2">
                        {/* Docs to Broker */}
                        <div className="flex flex-col items-center gap-1.5 text-center border-r border-border/50 px-1">
                          <p className="text-[9px] font-black uppercase text-muted-foreground">Docs to Broker</p>
                          <Switch checked={!!ship.isAllDocumentsProvidedToCustomsBroker} onCheckedChange={(v) => updateShippingField(ship._cpoIdx, ship._shipIdx, 'isAllDocumentsProvidedToCustomsBroker', v)} className="scale-75 data-[state=checked]:bg-primary" />
                        </div>
                        {/* Customs Stat */}
                        <div className="flex flex-col items-center gap-1.5 text-center border-r border-border/50 px-1">
                          <p className="text-[9px] font-black uppercase text-muted-foreground">Customs Stat</p>
                          <Switch checked={!!ship.isCustomsStatus} onCheckedChange={(v) => updateShippingField(ship._cpoIdx, ship._shipIdx, 'isCustomsStatus', v)} className="scale-75 data-[state=checked]:bg-primary" />
                        </div>
                        {/* Drayage Asg */}
                        <div className="flex flex-col items-center gap-1.5 text-center border-r border-border/50 px-1">
                          <p className="text-[9px] font-black uppercase text-muted-foreground">Drayage Asg</p>
                          <Switch checked={!!ship.IsDrayageAssigned} onCheckedChange={(v) => updateShippingField(ship._cpoIdx, ship._shipIdx, 'IsDrayageAssigned', v)} className="scale-75 data-[state=checked]:bg-primary" />
                        </div>
                        {/* Trucker Notif */}
                        <div className="flex flex-col items-center gap-1 text-center border-r border-border/50 px-1 pt-1.5">
                          <p className="text-[9px] font-bold text-foreground truncate w-full">{formatDate(ship.truckerNotifiedDate)}</p>
                          <p className="text-[8px] font-black uppercase text-muted-foreground/60 tracking-widest">Trucker Notif</p>
                        </div>
                        {/* Trucker DO */}
                        <div className="flex flex-col items-center gap-1.5 text-center px-1">
                          <p className="text-[9px] font-black uppercase text-muted-foreground">Trucker DO</p>
                          <Switch checked={!!ship.isTruckerReceivedDeliveryOrder} onCheckedChange={(v) => updateShippingField(ship._cpoIdx, ship._shipIdx, 'isTruckerReceivedDeliveryOrder', v)} className="scale-75 data-[state=checked]:bg-primary" />
                        </div>
                      </div>

                    </div>

                    {/* Row 13: Meta & Actions */}
                    <div className="flex items-center justify-between pt-4 relative z-10 border-t border-border/30">
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                          <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest opacity-60">Created By</p>
                          <p className="text-[10px] font-bold uppercase">{users[po.createdBy?.toLowerCase()] || po.createdBy || 'System'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-20 border border-dashed rounded-[2.5rem] bg-accent/5 opacity-50">
                  <Truck className="h-10 w-10 text-muted-foreground/30 mb-4" />
                  <p className="font-black uppercase text-[10px] tracking-[0.3em] text-muted-foreground">No Shipments Recorded</p>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
      <Dialog open={isAddCPOOpen || !!editingCPO} onOpenChange={(v) => { if (!v) { setIsAddCPOOpen(false); setEditingCPO(null); setSelectedCustomerForCPO(""); setSelectedLocationForCPO(""); setSelectedWarehouseForCPO(""); setSelectedUOMForCPO(""); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingCPO ? "Edit Customer PO" : "Add Customer PO"}</DialogTitle>
            <DialogDescription className="sr-only">{editingCPO ? "Update customer purchase order details" : "Add a new customer purchase order"}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveCPO} className="space-y-4">
            {/* Row 1: PO # (Internal) | Customer PO # */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>PO # (Internal)</Label>
                <Input name="poNo" defaultValue={editingCPO?.data?.poNo || autoPoNo} required readOnly className="bg-muted cursor-not-allowed" />
              </div>
              <div className="space-y-1">
                <Label>Customer PO #</Label>
                <Input name="customerPONo" defaultValue={editingCPO?.data?.customerPONo || ''} placeholder="e.g. CPO-2024-001" />
              </div>
            </div>
            {/* Row 2: Customer Ref | Customer Location */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Customer Ref</Label>
                <SearchableSelect
                  name="customer"
                  options={customers.map((cust: any) => ({ value: cust.vbId, label: cust.name }))}
                  value={selectedCustomerForCPO}
                  onChange={(val) => setSelectedCustomerForCPO(val)}
                  placeholder="Select Customer"
                  searchPlaceholder="Search customers..."
                  emptyMessage="No customers found."
                />
              </div>
              <div className="space-y-1">
                <Label>Customer Location</Label>
                <SearchableSelect
                  name="customerLocation"
                  options={(() => {
                    const selectedCust = customers.find((c: any) => c.vbId === selectedCustomerForCPO);
                    if (selectedCust?.location?.length) {
                      return selectedCust.location.map((loc: any) => ({ value: loc.vbId, label: loc.locationName || loc.vbId }));
                    }
                    return Object.entries(locations).map(([id, name]) => ({ value: id, label: name }));
                  })()}
                  value={selectedLocationForCPO}
                  onChange={(val) => setSelectedLocationForCPO(val)}
                  placeholder="Select Location"
                  searchPlaceholder="Search locations..."
                  emptyMessage="No locations found."
                />
              </div>
            </div>
            {/* Row 3: Dispatch Warehouse (full width) */}
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1">
                <Label>Dispatch Warehouse</Label>
                <SearchableSelect
                  name="warehouse"
                  options={warehouses.map((w: any) => ({ value: w.name, label: w.name }))}
                  value={selectedWarehouseForCPO}
                  onChange={(val) => setSelectedWarehouseForCPO(val)}
                  placeholder="Select Warehouse"
                  searchPlaceholder="Search warehouses..."
                  emptyMessage="No warehouses found."
                />
              </div>
            </div>
            {/* Row 4: PO Date | Requested Delivery */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>PO Date</Label>
                <Input name="customerPODate" type="date" defaultValue={editingCPO?.data?.customerPODate ? new Date(editingCPO.data.customerPODate).toISOString().split('T')[0] : ''} />
              </div>
              <div className="space-y-1">
                <Label>Requested Delivery</Label>
                <Input name="requestedDeliveryDate" type="date" defaultValue={editingCPO?.data?.requestedDeliveryDate ? new Date(editingCPO.data.requestedDeliveryDate).toISOString().split('T')[0] : ''} />
              </div>
            </div>
            {/* Row 5: Qty Ordered | Received | UOM */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label>Qty Ordered</Label>
                <Input name="qtyOrdered" type="number" defaultValue={editingCPO?.data?.qtyOrdered} />
              </div>
              <div className="space-y-1">
                <Label>Received</Label>
                <Input name="qtyReceived" type="number" defaultValue={editingCPO?.data?.qtyReceived} />
              </div>
              <div className="space-y-1">
                <Label>UOM</Label>
                <SearchableSelect
                  name="UOM"
                  options={UOM_OPTIONS}
                  value={selectedUOMForCPO}
                  onChange={(val) => setSelectedUOMForCPO(val)}
                  placeholder="Select UOM"
                  searchPlaceholder="Search units..."
                  emptyMessage="No units found."
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setIsAddCPOOpen(false); setEditingCPO(null); setSelectedCustomerForCPO(""); setSelectedLocationForCPO(""); setSelectedWarehouseForCPO(""); setSelectedUOMForCPO(""); }}>Cancel</Button>
              <Button type="submit" disabled={actionLoading}>{actionLoading ? "Saving..." : "Save Changes"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
          <Dialog open={!!addingShippingToCPO || !!editingShipping} onOpenChange={(v) => { if (!v) { setAddingShippingToCPO(null); setEditingShipping(null); } }}>
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
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <Label className="text-xs">VBID</Label>
                          <Input name="svbid" readOnly className="bg-muted cursor-not-allowed text-sm" defaultValue={editingShipping?.data?.svbid || (!editingShipping ? autoSvbid : '')} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Status</Label>
                          <select name="status" className="w-full border rounded-md h-9 px-3 text-sm bg-background" defaultValue={(() => {
                            const raw = (editingShipping?.data?.status || '').toLowerCase().trim();
                            if (raw === 'delivered' || raw === 'arrived') return 'Delivered';
                            if (raw === 'in transit' || raw === 'in_transit' || raw === 'on water') return 'In Transit';
                            if (raw === 'planned' || raw === 'booking confirmed') return 'Planned';
                            return 'Pending';
                          })()}>
                            <option value="Pending">Pending</option>
                            <option value="Planned">Planned</option>
                            <option value="In Transit">In Transit</option>
                            <option value="Delivered">Delivered</option>
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
                        <div className="space-y-1">
                          <Label className="text-xs">Tico VB</Label>
                          <Input name="ticoVB" placeholder="Tico VB ref" className="text-sm" defaultValue={editingShipping?.data?.ticoVB} />
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
                            editingShipping?.data?.products
                              ? (typeof editingShipping.data.products === 'string'
                                ? editingShipping.data.products.split(',').filter(Boolean)
                                : Array.isArray(editingShipping.data.products)
                                  ? editingShipping.data.products
                                  : editingShipping.data.product ? [editingShipping.data.product] : [])
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
                          <select
                            name="supplier"
                            className="w-full border rounded-md h-9 px-3 text-sm bg-background"
                            value={selectedSupplierForShipping}
                            onChange={(e) => setSelectedSupplierForShipping(e.target.value)}
                          >
                            <option value="">Select Supplier</option>
                            {suppliers.map((sup: any) => (
                              <option key={sup._id} value={sup._id}>{sup.name} ({sup.vbId})</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Supplier Location</Label>
                          <select
                            name="supplierLocation"
                            className="w-full border rounded-md h-9 px-3 text-sm bg-background"
                            defaultValue={editingShipping?.data?.supplierLocation}
                            disabled={!selectedSupplierForShipping}
                          >
                            <option value="">{selectedSupplierForShipping ? 'Select Location' : 'Select Supplier First'}</option>
                            {getSupplierLocationOptions().map((loc) => (
                              <option key={loc.id} value={loc.id}>{loc.name}</option>
                            ))}
                          </select>
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
                          <select
                            name="carrier"
                            className="w-full border rounded-md h-9 px-3 text-sm bg-background"
                            defaultValue={editingShipping?.data?.carrier || ''}
                            onChange={(e) => {
                              if (e.target.value === '__add_new__') {
                                const newCarrier = prompt('Enter new carrier name:');
                                if (newCarrier && newCarrier.trim()) {
                                  const opt = document.createElement('option');
                                  opt.value = newCarrier.trim();
                                  opt.textContent = newCarrier.trim();
                                  e.target.insertBefore(opt, e.target.lastElementChild);
                                  e.target.value = newCarrier.trim();
                                } else {
                                  e.target.value = editingShipping?.data?.carrier || '';
                                }
                              }
                            }}
                          >
                            <option value="">Select Carrier</option>
                            {CARRIER_OPTIONS.map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                            {editingShipping?.data?.carrier && !CARRIER_OPTIONS.includes(editingShipping.data.carrier) && (
                              <option value={editingShipping.data.carrier}>{editingShipping.data.carrier}</option>
                            )}
                            <option value="__add_new__">＋ Add New Carrier...</option>
                          </select>
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
                  <Button type="button" variant="outline" size="sm" onClick={() => { setAddingShippingToCPO(null); setEditingShipping(null); }}>Cancel</Button>
                  <Button type="submit" size="sm" disabled={actionLoading}>{actionLoading ? "Saving..." : (editingShipping ? "Update Shipping" : "Add Shipping")}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Attachments Modal */}
      <AttachmentsModal
        open={!!attachmentsOpen}
        onClose={() => setAttachmentsOpen(null)}
        poNumber={attachmentsOpen?.poNumber || ''}
        spoNumber={attachmentsOpen?.spoNumber}
        shipNumber={attachmentsOpen?.shipNumber}
        childFolders={attachmentsOpen?.childFolders}
      />

      {/* Timeline Modal */}
      <TimelineModal
        open={!!timelineOpen}
        onClose={() => setTimelineOpen(null)}
        vbpoNo={timelineOpen?.vbpoNo}
        poNo={timelineOpen?.poNo}
        svbid={timelineOpen?.svbid}
        title={timelineOpen?.title}
        users={users}
      />

    </TooltipProvider>
  );
}
