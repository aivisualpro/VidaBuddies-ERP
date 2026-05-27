"use client";

import { useEffect, useState, useMemo, use } from "react";
import { DetailPageSkeleton } from "@/components/skeletons";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import { 
  ArrowLeft, 
  Building2, 
  Hash, 
  MapPin, 
  Globe, 
  ExternalLink,
  ChevronRight,
  Pencil,
  Trash,
  ImagePlus,
  ClipboardList,
  Box,
  Truck,
  Calendar,
  Tag,
  ChevronDown,
  User,
  Plus
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
import { ShippingCard, ShippingEmptyState } from "@/components/admin/shipping-card";
import { TransferOrderDialog } from "@/components/admin/transfer-order-dialog";
import { AttachmentsModal } from "@/components/attachments-modal";
import { DriveDocumentsModal } from "@/components/drive-documents-modal";
import TimelineModal from "@/components/admin/timeline-modal";
import { useWarehouses } from "@/hooks/queries/useWarehouses";

interface CustomerLocation {
  _id?: string;
  vbId: string;
  locationName: string;
  street: string;
  city: string;
  state: string;
  country: string;
  zip: string;
  fullAddress: string;
  website: string;
  imageUrl?: string;
}

interface Customer {
  _id: string;
  vbId: string;
  name: string;
  location: CustomerLocation[];
}

/** Matches VBcustomerPO collection */
interface VBcustomerPO {
  _id: string;
  VBNumber?: string;           // ObjectId ref to VidaPO
  VBSerialNumber?: string;     // display string e.g. "VB1-1"
  customer?: string;           // ObjectId ref to VidaCustomer
  customerLocation?: string;   // ObjectId ref to customer location subdoc
  customerPONo?: string;
  customerPODate?: string;
  requestedDeliveryDate?: string;
  qtyOrdered?: number;
  qtyReceived?: number;
  UOM?: string;
  warehouse?: string;
  createdAt?: string;
  [key: string]: any;
}

/** Matches VBshipping collection */
interface VBshipping {
  _id: string;
  VBNumber?: string;           // ObjectId ref to VidaPO
  VBSerialNumber?: string;     // ObjectId ref to VBcustomerPO._id
  VBShipmentNumber?: string;
  status?: string;
  ETA?: string;
  updatedETA?: string;
  carrier?: string;
  supplierLocation?: string;
  containerNo?: string;
  BOLNumber?: string;
  vessellTrip?: string;
  portOfLading?: string;
  portOfEntryShipTo?: string;
  dateOfLanding?: string;
  drums?: number;
  pallets?: number;
  gallons?: number;
  invValue?: number;
  estTrumpDuties?: number;
  netWeightKG?: number;
  grossWeightKG?: number;
  ticoVB?: string;
  isArrivalNotice?: boolean;
  isGensetRequired?: boolean;
  gensetInv?: string;
  gensetEmailed?: boolean;
  isCollectFeesPaid?: boolean;
  feesAmount?: number;
  estimatedDuties?: number;
  isDOCreated?: boolean;
  isSupplierInvoice?: boolean;
  isManufacturerSecurityISF?: boolean;
  isVidaBuddiesISFFiling?: boolean;
  isPackingList?: boolean;
  isCertificateOfAnalysis?: boolean;
  isCertificateOfOrigin?: boolean;
  IsBillOfLading?: boolean;
  isBillOfLading?: boolean;
  isAllDocumentsProvidedToCustomsBroker?: boolean;
  isCustomsStatus?: boolean;
  IsDrayageAssigned?: boolean;
  truckerNotifiedDate?: string;
  isTruckerReceivedDeliveryOrder?: boolean;
  createdBy?: string;
  updateShipmentTracking?: string;
  products?: string[];
  [key: string]: any;
}

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  // Dialog States
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isCustomerEditDialogOpen, setIsCustomerEditDialogOpen] = useState(false);
  
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [deletingLocationId, setDeletingLocationId] = useState<string | null>(null);
  const [tempName, setTempName] = useState("");
  // Full location edit state
  const [tempLocation, setTempLocation] = useState<CustomerLocation | null>(null);
  // Full edit state for the customer edit dialog
  const [tempCustomer, setTempCustomer] = useState<Customer | null>(null);

  // Order History & Active Logistics — from /api/admin/customers/[id]/orders
  const [cpos, setCpos] = useState<VBcustomerPO[]>([]);
  const [shippings, setShippings] = useState<VBshipping[]>([]);
  const [supplierLocations, setSupplierLocations] = useState<Record<string, string>>({});
  const [products, setProducts] = useState<Record<string, string>>({});
  const [users, setUsers] = useState<Record<string, string>>({});
  const [selectedCpoId, setSelectedCpoId] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  // Warehouse lookup for denormalizing warehouse ObjectId → name
  const { data: warehousesList = [] } = useWarehouses();
  const warehouseNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    (warehousesList || []).forEach((w: any) => { if (w._id) m[w._id] = w.name; });
    return m;
  }, [warehousesList]);

  // Modal states for ShippingCard actions
  const [attachmentsOpen, setAttachmentsOpen] = useState<{ poNumber: string; spoNumber?: string; shipNumber?: string } | null>(null);
  const [legacyAttachmentsOpen, setLegacyAttachmentsOpen] = useState<{ poNumber: string; spoNumber?: string; shipNumber?: string } | null>(null);
  const [timelineOpen, setTimelineOpen] = useState<{ VBNumber?: string; VBSerialNumber?: string; VBShipmentNumber?: string; title?: string } | null>(null);
  const [transferDialogShip, setTransferDialogShip] = useState<any | null>(null);

  const { setLeftContent, setRightContent } = useHeaderActions();

  useEffect(() => {
    if (customer) {
      setLeftContent(
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-black tracking-tight uppercase bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">{customer.name}</h1>
          <div className="flex gap-2">
            <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-black border border-primary/20">{customer.vbId}</span>
            <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full font-black border uppercase tracking-tighter">{customer.location?.length || 0} Locations</span>
          </div>
        </div>
      );
      setRightContent(
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="font-bold uppercase tracking-widest text-[10px]" onClick={handleEditDetails}>Edit Details</Button>
          <Button size="sm" className="font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20" onClick={handleAddLocation}>Add Location</Button>
          <Button variant="ghost" size="sm" className="font-bold uppercase tracking-widest text-[10px]" onClick={() => router.back()}>
            <ChevronRight className="h-4 w-4 rotate-180 mr-2" /> Back
          </Button>
        </div>
      );
    }
    return () => {
      setLeftContent(null);
      setRightContent(null);
    };
  }, [customer, setLeftContent, setRightContent]);

  useEffect(() => {
    // Phase 1: customer record (fast)
    fetch(`/api/admin/customers/${id}`)
      .then(r => r.json())
      .then(custRes => { setCustomer(custRes); setLoading(false); })
      .catch(() => { toast.error("Error loading customer"); setLoading(false); });

    // Phase 2a: CPOs + shipments for this customer only
    fetch(`/api/admin/customers/${id}/orders`)
      .then(r => r.json())
      .then(({ cpos: cpoData, shippings: shipData }) => {
        setCpos(Array.isArray(cpoData) ? cpoData : []);
        setShippings(Array.isArray(shipData) ? shipData : []);
      })
      .catch(() => toast.error("Error loading order history"));

    // Phase 2b: lookup tables for display (suppliers, products, users)
    Promise.all([
      fetch("/api/admin/suppliers").then(r => r.json()),
      fetch("/api/admin/products").then(r => r.json()),
      fetch("/api/admin/users").then(r => r.json()),
    ]).then(([supRes, prodRes, userRes]) => {
      if (Array.isArray(userRes)) {
        const mapping: Record<string, string> = {};
        userRes.forEach((u: any) => { mapping[u.email.toLowerCase()] = u.name; });
        setUsers(mapping);
      }
      if (Array.isArray(supRes)) {
        const mapping: Record<string, string> = {};
        supRes.forEach((sup: any) => {
          if (sup.location && Array.isArray(sup.location)) {
            sup.location.forEach((loc: any) => {
              if (loc._id) mapping[loc._id.toString()] = loc.locationName || `${sup.name} - ${loc.city}`;
              if (loc.vbId) mapping[loc.vbId] = loc.locationName || `${sup.name} - ${loc.city}`;
            });
          }
        });
        setSupplierLocations(mapping);
      }
      if (Array.isArray(prodRes)) {
        const mapping: Record<string, string> = {};
        prodRes.forEach((p: any) => { mapping[p._id] = p.name; if (p.vbId) mapping[p.vbId] = p.name; });
        setProducts(mapping);
      }
    }).catch(() => toast.error("Error loading lookup data"))
      .finally(() => setDataLoading(false));
  }, [id]);

  // ── Derived data ──────────────────────────────────────────────────────────
  // Filter CPOs by selected location (if any)
  const filteredCustomerPOs = selectedLocationId
    ? cpos.filter(cpo => cpo.customerLocation === selectedLocationId)
    : cpos;

  // Build set of CPO IDs that belong to the filtered CPOs (for shipment cascade)
  const filteredCpoIds = new Set(filteredCustomerPOs.map(cpo => cpo._id));

  // Filter shippings:
  //  - If a CPO is selected: show only shippings for that CPO
  //  - Else if a location is selected: show shippings for all CPOs at that location
  //  - Else: show all shippings
  const filteredShippings = selectedCpoId
    ? shippings.filter(s => s.VBSerialNumber === selectedCpoId)
    : selectedLocationId
      ? shippings.filter(s => filteredCpoIds.has(s.VBSerialNumber || ''))
      : shippings;

  // Update a single field on a VBshipping record (optimistic)
  const updateShippingField = async (shipId: string, field: string, value: any) => {
    // Optimistic update
    setShippings(prev => prev.map(s => s._id === shipId ? { ...s, [field]: value } : s));
    try {
      const res = await fetch(`/api/admin/vb-shipping/${shipId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) throw new Error("Update failed");
    } catch {
      toast.error("Failed to update");
      // Re-fetch to restore correct state
      fetch(`/api/admin/customers/${id}/orders`)
        .then(r => r.json())
        .then(({ shippings: shipData }) => { if (Array.isArray(shipData)) setShippings(shipData); })
        .catch(() => {});
    }
  };


  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
  };


  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, locationId: string) => {
    const file = e.target.files?.[0];
    if (!file || !customer) return;

    setUploadingId(locationId);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const uploadRes = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });
      const uploadData = await uploadRes.json();

      if (uploadData.secure_url) {
        const updatedLocations = customer.location.map((loc, idx) => {
          const currentId = loc._id || idx.toString();
          if (currentId === locationId) {
            return { ...loc, imageUrl: uploadData.secure_url };
          }
          return loc;
        });

        const updateRes = await fetch(`/api/admin/customers/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ location: updatedLocations }),
        });

        if (updateRes.ok) {
          const updatedCustomer = await updateRes.json();
          setCustomer(updatedCustomer);
          toast.success("Image updated successfully!");
        }
      }
    } catch (error) {
      console.error("Upload failed:", error);
      toast.error("Failed to upload image.");
    } finally {
      setUploadingId(null);
    }
  };

  const handleEditLocation = (locationId: string) => {
    if (!customer) return;
    const location = customer.location.find((l, idx) => (l._id || idx.toString()) === locationId);
    if (!location) return;
    setEditingLocationId(locationId);
    setTempLocation({ ...location }); // clone so edits are isolated
    setIsEditDialogOpen(true);
  };

  const handleTempLocFieldChange = (field: keyof CustomerLocation, value: string) => {
    if (!tempLocation) return;
    const updated = { ...tempLocation, [field]: value };
    // Auto-sync fullAddress from individual fields
    if (['street', 'city', 'state', 'zip', 'country'].includes(field)) {
      const { street, city, state, zip, country } = updated;
      updated.fullAddress = [street, city, state, zip, country].filter(Boolean).join(", ");
    }
    // Auto-parse fullAddress into individual fields
    if (field === 'fullAddress') {
      const parts = value.split(',').map((s: string) => s.trim());
      if (parts[0] !== undefined) updated.street = parts[0];
      if (parts[1] !== undefined) updated.city = parts[1];
      if (parts[2] !== undefined) updated.state = parts[2];
      if (parts[3] !== undefined) updated.zip = parts[3];
      if (parts[4] !== undefined) updated.country = parts[4];
    }
    setTempLocation(updated);
  };

  const confirmEditLocation = async () => {
    if (!customer || !editingLocationId || !tempLocation) return;
    try {
      const updatedLocations = customer.location.map((loc, idx) => {
        if ((loc._id || idx.toString()) === editingLocationId) {
          return { ...loc, ...tempLocation };
        }
        return loc;
      });
      const updateRes = await fetch(`/api/admin/customers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: updatedLocations }),
      });
      if (updateRes.ok) {
        const updatedCustomer = await updateRes.json();
        setCustomer(updatedCustomer);
        toast.success("Location updated!");
        setIsEditDialogOpen(false);
      }
    } catch (error) {
      toast.error("Failed to update location.");
    }
  };

  const handleDeleteLocation = (locationId: string) => {
    setDeletingLocationId(locationId);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteLocation = async () => {
    if (!customer || !deletingLocationId) return;

    try {
      const updatedLocations = customer.location.filter((loc, idx) => (loc._id || idx.toString()) !== deletingLocationId);

      const updateRes = await fetch(`/api/admin/customers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: updatedLocations }),
      });

      if (updateRes.ok) {
        const updatedCustomer = await updateRes.json();
        setCustomer(updatedCustomer);
        toast.success("Location deleted successfully");
        setIsDeleteDialogOpen(false);
      }
    } catch (error) {
      toast.error("Failed to delete location.");
    }
  };

  const handleAddLocation = async () => {
    if (!customer) return;
    
    const newLocation: CustomerLocation = {
      vbId: `${customer.vbId}-${customer.location.length + 1}`,
      locationName: "New Site " + (customer.location.length + 1),
      street: "123 New St",
      city: "City",
      state: "ST",
      country: "Country",
      zip: "00000",
      fullAddress: "123 New St, City, ST 00000, Country",
      website: "https://example.com"
    };

    try {
      const updatedLocations = [...customer.location, newLocation];
      const updateRes = await fetch(`/api/admin/customers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: updatedLocations }),
      });

      if (updateRes.ok) {
        const updatedCustomer = await updateRes.json();
        setCustomer(updatedCustomer);
        toast.success("New location added!");
      }
    } catch (error) {
      toast.error("Failed to add location.");
    }
  };

  const handleEditDetails = () => {
    if (!customer) return;
    setTempName(customer.name);
    // Deep-clone so edits don't mutate display state
    setTempCustomer(JSON.parse(JSON.stringify(customer)));
    setIsCustomerEditDialogOpen(true);
  };

  const handleTempLocationChange = (index: number, field: keyof CustomerLocation, value: string) => {
    if (!tempCustomer) return;
    const newLocs = [...tempCustomer.location];
    const loc = { ...newLocs[index], [field]: value };
    // Auto-sync fullAddress
    if (['street', 'city', 'state', 'zip', 'country'].includes(field)) {
      const { street, city, state, zip, country } = loc;
      loc.fullAddress = [street, city, state, zip, country].filter(Boolean).join(", ");
    }
    // Auto-parse fullAddress
    if (field === 'fullAddress') {
      const parts = value.split(',').map((s: string) => s.trim());
      if (parts[0]) loc.street = parts[0];
      if (parts[1]) loc.city = parts[1];
      if (parts[2]) loc.state = parts[2];
      if (parts[3]) loc.zip = parts[3];
      if (parts[4]) loc.country = parts[4];
    }
    newLocs[index] = loc;
    setTempCustomer({ ...tempCustomer, location: newLocs });
  };

  const handleTempAddLocation = () => {
    if (!tempCustomer) return;
    const newLoc: CustomerLocation = {
      vbId: "", locationName: "", street: "", city: "",
      state: "", country: "", zip: "", fullAddress: "", website: "",
    };
    setTempCustomer({ ...tempCustomer, location: [...tempCustomer.location, newLoc] });
  };

  const handleTempRemoveLocation = (index: number) => {
    if (!tempCustomer) return;
    const newLocs = tempCustomer.location.filter((_, i) => i !== index);
    setTempCustomer({ ...tempCustomer, location: newLocs });
  };

  const confirmEditCustomer = async () => {
    if (!customer || !tempCustomer) {
      setIsCustomerEditDialogOpen(false);
      return;
    }
    try {
      const updateRes = await fetch(`/api/admin/customers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: tempCustomer.name, vbId: tempCustomer.vbId, location: tempCustomer.location }),
      });
      if (updateRes.ok) {
        const updated = await updateRes.json();
        setCustomer(updated);
        toast.success("Customer updated!");
        setIsCustomerEditDialogOpen(false);
      }
    } catch (error) {
      toast.error("Failed to update customer details.");
    }
  };

  if (loading) {
    return <DetailPageSkeleton />;
  }

  if (!customer) {
    return <div className="p-8 text-center">Customer not found</div>;
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full overflow-hidden relative bg-transparent">
        {/* Global Page Background Pattern Overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.05] dark:opacity-[0.02] overflow-hidden">
           <img 
             src="/images/nano_banana_bg.png" 
             alt="" 
             className="w-full h-full object-cover scale-150 rotate-1 rounded-full"
           />
        </div>

        <div className="grid grid-cols-12 gap-[8px] p-0 h-full overflow-hidden relative z-10">
        {/* Column 1: Locations */}
        <div className="col-span-2 flex flex-col gap-[8px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted">
          <div className="sticky top-0 z-20 flex items-center justify-between p-[8px] mb-[4px] backdrop-blur-xl border-b border-border/20 bg-transparent">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Locations</span>
            </div>
          </div>

          <div className="space-y-[8px]">
            {customer.location && customer.location.length > 0 ? (
              customer.location.map((loc: CustomerLocation, idx) => (
                <div 
                  key={loc._id || idx} 
                  onClick={() => setSelectedLocationId(selectedLocationId === loc._id ? null : loc._id || null)}
                  className={cn(
                    "group relative h-60 overflow-hidden rounded-3xl border shadow-none transition-all duration-500 hover:-translate-y-2 cursor-pointer",
                    selectedLocationId === loc._id ? "border-primary ring-1 ring-primary bg-primary/10" : "border-border hover:border-primary/40 bg-transparent"
                  )}
                >
                  {/* Nano Banana Background Image - Better visibility for Light Theme */}
                  <img 
                    src="/images/nano_banana_bg.png" 
                    alt="Background" 
                    className="absolute inset-0 w-full h-full object-cover opacity-[0.10] dark:opacity-30 group-hover:scale-110 transition-transform duration-700 pointer-events-none"
                  />
                  

                  {/* Main Content Area - 3 Row Structure */}
                  <div className="absolute inset-0 p-[8px] flex flex-col justify-end gap-[4px] z-10">
                    <div className="space-y-1">
                      {/* 1st Row: Location Name */}
                      <h3 className="text-lg font-black leading-tight text-foreground uppercase tracking-tight">
                        {loc.locationName || "Unnamed"}
                      </h3>
                      
                      {/* 2nd Row: vbId */}
                      <div className="inline-flex px-1.5 py-0.5 rounded-md border border-foreground/5">
                        <span className="text-[9px] font-black tracking-[0.1em] text-muted-foreground/80 uppercase">
                          {loc.vbId || 'Active Site'}
                        </span>
                      </div>
                      
                      {/* 3rd Row: Full Address */}
                      <p className="text-muted-foreground text-[9px] font-bold leading-tight line-clamp-3 max-w-[95%] uppercase tracking-wide pt-1">
                        {loc.fullAddress || `${loc.street}, ${loc.city}, ${loc.country}`}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2">


                      {/* Action Row with Tooltips */}
                      <div className="flex gap-[8px]">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <a 
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((loc.fullAddress || `${loc.street}, ${loc.city}, ${loc.country}`).replace(/\|/g, ' '))}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="h-8 w-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-90 shadow-none border border-primary/20"
                            >
                              <MapPin className="h-3.5 w-3.5" />
                            </a>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="bg-black text-white border-white/10 font-black uppercase text-[10px] tracking-widest">Directions</TooltipContent>
                        </Tooltip>

                        {loc.website && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <a 
                                href={(loc.website.startsWith('http') ? loc.website : `https://${loc.website}`).split('|')[0].trim()}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="h-8 w-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-90 shadow-none border border-primary/20"
                              >
                                <Globe className="h-3.5 w-3.5" />
                              </a>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="bg-black text-white border-white/10 font-black uppercase text-[10px] tracking-widest">Website</TooltipContent>
                          </Tooltip>
                        )}

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              onClick={(e) => { e.stopPropagation(); handleEditLocation(loc._id || idx.toString()); }}
                              className="h-8 w-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-90 shadow-none border border-primary/20 p-0"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="bg-black text-white border-white/10 font-black uppercase text-[10px] tracking-widest">Edit Site</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              onClick={(e) => { e.stopPropagation(); handleDeleteLocation(loc._id || idx.toString()); }}
                              className="h-8 w-8 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-90 shadow-none border border-destructive/20 p-0"
                            >
                              <Trash className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="bg-black text-white border-white/10 font-black uppercase text-[10px] tracking-widest">Delete Site</TooltipContent>
                        </Tooltip>
                      </div>

                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-10 border border-dashed rounded-lg font-black uppercase text-xs tracking-widest text-muted-foreground opacity-50">
                No locations registered
              </div>
            )}
          </div>
        </div>

        {/* Column 2: Customer POs */}
        <div className="col-span-3 flex flex-col gap-[8px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted">
          <div className="sticky top-0 z-20 flex items-center justify-between p-[8px] mb-[4px] backdrop-blur-xl border-b border-border/20 bg-transparent">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Order History</span>
            </div>
            <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-black border border-primary/20">
              {filteredCustomerPOs.length}
            </span>
          </div>

          <div className="space-y-[8px]">
            {filteredCustomerPOs.length > 0 ? (
              filteredCustomerPOs.map((cpo, idx) => {
                const poLocations: Record<string, string> = {};
                // key by both _id (ObjectId) and vbId for forward/backward compat
                customer.location.forEach(l => {
                  if (l._id) poLocations[l._id] = l.locationName;
                  if (l.vbId) poLocations[l.vbId] = l.locationName;
                });

                return (
                <div 
                  key={cpo._id || idx} 
                  onClick={() => setSelectedCpoId(selectedCpoId === cpo._id ? null : cpo._id || null)}
                  className={cn(
                    "group relative overflow-hidden rounded-3xl text-card-foreground border shadow-none transition-all duration-500 hover:-translate-y-1 hover:border-primary/40 p-[8px] cursor-pointer",
                    selectedCpoId === cpo._id ? "border-primary ring-1 ring-primary bg-primary/10" : "border-border bg-transparent"
                  )}
                >
                  {/* Background Nano Banana Gradient & Pattern */}
                  {/* Background Accents Removed */}
                  <img 
                    src="/images/nano_banana_bg.png" 
                    alt="bg" 
                    className="absolute inset-0 w-full h-full object-cover opacity-[0.15] dark:opacity-40 mix-blend-multiply dark:mix-blend-overlay group-hover:scale-110 transition-all duration-1000 pointer-events-none"
                  />
                  
                  <div className="relative z-10 flex flex-col gap-[8px]">
                    {/* Row 1: Serial # and customerPONo */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-black leading-tight text-foreground uppercase tracking-tight">
                          {cpo.VBSerialNumber || cpo._id?.slice(-6) || "CPO"}
                        </h3>
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg border border-border/50">
                          <span className="text-[9px] font-black tracking-widest text-muted-foreground uppercase opacity-60">REF:</span>
                          <span className="text-[9px] font-black tracking-widest text-foreground uppercase">
                            {cpo.customerPONo || '-'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                         <Button 
                           size="icon" 
                           variant="ghost" 
                           className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
                           onClick={(e) => { 
                               e.stopPropagation(); 
                               if (cpo.VBNumber) router.push(`/admin/purchase-orders/${cpo.VBNumber}`);
                               else toast.info("No linked Purchase Order");
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
                               toast.info("Delete customer PO from Purchase Orders detail page");
                           }}
                         >
                            <Trash className="h-3.5 w-3.5" />
                         </Button>
                      </div>
                    </div>

                    <Separator className="bg-border/30" />

                    {/* Row 2: Site Location (Resolved Name) */}
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-primary" />
                        <p className="text-[12px] font-bold uppercase tracking-tight text-foreground/90 truncate">
                          {poLocations[cpo.customerLocation || ""] || cpo.customerLocation || "Generic Site"}
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
                    <div className="grid grid-cols-3 gap-[8px] rounded-2xl p-[8px] border border-border/50">
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

                    {/* Row 5: Warehouse & VBSerialNumber */}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2">
                         <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Box className="h-4 w-4 text-primary" />
                         </div>
                         <div className="flex flex-col">
                            <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest opacity-50">Dispatch Point</p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-foreground">
                               {warehouseNameMap[cpo.warehouse] || cpo.warehouse || "STANDBY"}
                            </p>
                         </div>
                      </div>
                      
                      <div className="flex flex-col items-end">
                          <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest opacity-50">Serial #</p>
                          <p className="text-[10px] font-black uppercase tracking-widest text-primary">
                             {cpo.VBSerialNumber || '-'}
                          </p>
                      </div>
                    </div>
                  </div>
                </div>
              )})
            ) : (

              <div className="flex flex-col items-center justify-center py-20 border border-dashed rounded-[2.5rem] opacity-50">
                <ClipboardList className="h-10 w-10 text-muted-foreground/30 mb-4" />
                <p className="font-black uppercase text-[10px] tracking-[0.3em] text-muted-foreground">No Purchase History</p>
              </div>
            )}
          </div>
        </div>

        {/* Column 3: Shippings */}
        <div className="col-span-7 flex flex-col gap-4 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted">
          <div className="sticky top-0 z-20 flex items-center justify-between p-[8px] mb-[4px] backdrop-blur-xl border-b border-border/20 bg-transparent">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-primary" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Shippings</span>
            </div>
            <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-black border border-primary/20">
              {filteredShippings.length}
            </span>
          </div>

          <div className="space-y-4">
            {filteredShippings.length > 0 ? (
              filteredShippings.map((ship, idx) => (
                <ShippingCard
                  key={ship._id || idx}
                  ship={ship}
                  index={idx}
                  supplierLocations={supplierLocations}
                  products={products}
                  onUpdateField={(shipId, field, value) => updateShippingField(shipId, field, value)}
                  onAttachments={(s) => {
                    // Resolve the parent CPO to get its VBSerialNumber (used as the spoNumber / folder name)
                    const parentCpo = cpos.find(c => c._id === s.VBSerialNumber);
                    // Resolve the parent PO VBNumber from the CPO's VBNumber field (it stores the PO _id)
                    // We navigate to drive docs using VBNumber string, not ObjectId
                    setAttachmentsOpen({
                      poNumber: parentCpo?.VBNumber || s.VBNumber || '',
                      spoNumber: parentCpo?.VBSerialNumber || '',
                      shipNumber: s.VBShipmentNumber || s.svbid || undefined,
                    });
                  }}
                  onTimeline={(s) => setTimelineOpen({
                    VBNumber: s.VBNumber,
                    VBSerialNumber: s.VBSerialNumber,
                    VBShipmentNumber: s._id,
                    title: `Timeline — ${s.VBShipmentNumber || 'Shipping'}`,
                  })}
                  onEdit={(s) => router.push(`/admin/shipments/list`)}
                  onDelete={(s) => {
                    toast("Delete Shipping?", {
                      description: "This cannot be undone.",
                      duration: 10000,
                      cancel: { label: "Cancel", onClick: () => {} },
                      action: {
                        label: "Delete",
                        onClick: async () => {
                          try {
                            const res = await fetch(`/api/admin/vb-shipping/${s._id}`, { method: "DELETE" });
                            if (!res.ok) throw new Error();
                            setShippings(prev => prev.filter(x => x._id !== s._id));
                            toast.success("Shipping deleted");
                          } catch { toast.error("Error deleting shipping"); }
                        }
                      }
                    });
                  }}
                  onTransfers={(s) => setTransferDialogShip(s)}
                />
              ))
            ) : (
              <ShippingEmptyState />
            )}
          </div>
        </div>
      </div>


      {/* Edit Location Dialog — all fields */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border-primary/20 bg-card/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-tight">Edit Location</DialogTitle>
            <DialogDescription className="text-muted-foreground uppercase text-[10px] tracking-widest font-bold">
              Update all details for this site.
            </DialogDescription>
          </DialogHeader>
          {tempLocation && (
            <div className="grid gap-4 py-4">
              {/* Row 1: VB ID + Name */}
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Location VB ID</Label>
                  <Input
                    value={tempLocation.vbId || ""}
                    onChange={(e) => handleTempLocFieldChange("vbId", e.target.value)}
                    placeholder="LOC-001"
                    className="rounded-xl bg-foreground/5 border-border focus-visible:ring-primary"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Location Name</Label>
                  <Input
                    value={tempLocation.locationName || ""}
                    onChange={(e) => handleTempLocFieldChange("locationName", e.target.value)}
                    placeholder="Main Warehouse"
                    className="rounded-xl bg-foreground/5 border-border focus-visible:ring-primary"
                  />
                </div>
              </div>

              {/* Row 2: Street + City */}
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Street</Label>
                  <Input
                    value={tempLocation.street || ""}
                    onChange={(e) => handleTempLocFieldChange("street", e.target.value)}
                    placeholder="123 Main St"
                    className="rounded-xl bg-foreground/5 border-border focus-visible:ring-primary"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">City</Label>
                  <Input
                    value={tempLocation.city || ""}
                    onChange={(e) => handleTempLocFieldChange("city", e.target.value)}
                    placeholder="New York"
                    className="rounded-xl bg-foreground/5 border-border focus-visible:ring-primary"
                  />
                </div>
              </div>

              {/* Row 3: State + Zip + Country */}
              <div className="grid grid-cols-3 gap-3">
                <div className="grid gap-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">State</Label>
                  <Input
                    value={tempLocation.state || ""}
                    onChange={(e) => handleTempLocFieldChange("state", e.target.value)}
                    placeholder="NY"
                    className="rounded-xl bg-foreground/5 border-border focus-visible:ring-primary"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Zip Code</Label>
                  <Input
                    value={tempLocation.zip || ""}
                    onChange={(e) => handleTempLocFieldChange("zip", e.target.value)}
                    placeholder="10001"
                    className="rounded-xl bg-foreground/5 border-border focus-visible:ring-primary"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Country</Label>
                  <Input
                    value={tempLocation.country || ""}
                    onChange={(e) => handleTempLocFieldChange("country", e.target.value)}
                    placeholder="USA"
                    className="rounded-xl bg-foreground/5 border-border focus-visible:ring-primary"
                  />
                </div>
              </div>

              {/* Full Address — auto-syncs */}
              <div className="grid gap-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
                  Full Address
                  <span className="ml-1 normal-case font-normal text-muted-foreground/50">(auto-syncs from fields above)</span>
                </Label>
                <Input
                  value={tempLocation.fullAddress || ""}
                  onChange={(e) => handleTempLocFieldChange("fullAddress", e.target.value)}
                  placeholder="123 Main St, New York, NY, 10001, USA"
                  className="rounded-xl bg-foreground/5 border-border focus-visible:ring-primary"
                />
              </div>

              {/* Website */}
              <div className="grid gap-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Website</Label>
                <Input
                  value={tempLocation.website || ""}
                  onChange={(e) => handleTempLocFieldChange("website", e.target.value)}
                  placeholder="https://example.com"
                  className="rounded-xl bg-foreground/5 border-border focus-visible:ring-primary"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsEditDialogOpen(false)} className="rounded-full font-black uppercase text-[10px] tracking-widest">Cancel</Button>
            <Button onClick={confirmEditLocation} className="rounded-full font-black uppercase text-[10px] tracking-widest shadow-lg shadow-primary/20">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-3xl border-destructive/20 bg-card/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-tight text-destructive">Delete Site?</DialogTitle>
            <DialogDescription className="text-muted-foreground uppercase text-[10px] tracking-widest font-bold">
              This action cannot be undone. This will permanently remove the site.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setIsDeleteDialogOpen(false)} className="rounded-full font-black uppercase text-[10px] tracking-widest">Cancel</Button>
            <Button variant="destructive" onClick={confirmDeleteLocation} className="rounded-full font-black uppercase text-[10px] tracking-widest shadow-lg shadow-destructive/20">Confirm Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Customer Dialog — full fields */}
      <Dialog open={isCustomerEditDialogOpen} onOpenChange={setIsCustomerEditDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border-primary/20 bg-card/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-tight">Edit Customer</DialogTitle>
            <DialogDescription className="text-muted-foreground uppercase text-[10px] tracking-widest font-bold">
              Update customer details and all locations.
            </DialogDescription>
          </DialogHeader>
          {tempCustomer && (
            <div className="grid gap-6 py-4">
              {/* Core fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">VB ID</Label>
                  <Input
                    value={tempCustomer.vbId || ""}
                    onChange={(e) => setTempCustomer({ ...tempCustomer, vbId: e.target.value })}
                    placeholder="VB-001"
                    className="rounded-xl"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Customer Name</Label>
                  <Input
                    value={tempCustomer.name || ""}
                    onChange={(e) => setTempCustomer({ ...tempCustomer, name: e.target.value })}
                    placeholder="Acme Corp"
                    className="rounded-xl"
                  />
                </div>
              </div>

              {/* Locations */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Locations ({tempCustomer.location.length})</h3>
                  <Button type="button" variant="outline" size="sm" onClick={handleTempAddLocation}>
                    <Plus className="mr-1.5 h-3 w-3" /> Add Location
                  </Button>
                </div>
                {tempCustomer.location.map((loc, index) => (
                  <div key={index} className="rounded-xl border p-4 relative space-y-3">
                    <Button
                      type="button" variant="ghost" size="icon"
                      className="absolute right-2 top-2 h-6 w-6 text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                      onClick={() => handleTempRemoveLocation(index)}
                    >
                      <Trash className="h-3 w-3" />
                    </Button>
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary">Location {index + 1}</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid gap-1.5">
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Location VB ID</Label>
                        <Input value={loc.vbId || ""} onChange={(e) => handleTempLocationChange(index, "vbId", e.target.value)} placeholder="LOC-001" className="rounded-lg h-8 text-xs" />
                      </div>
                      <div className="grid gap-1.5">
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Location Name</Label>
                        <Input value={loc.locationName || ""} onChange={(e) => handleTempLocationChange(index, "locationName", e.target.value)} placeholder="Main Warehouse" className="rounded-lg h-8 text-xs" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid gap-1.5">
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Street</Label>
                        <Input value={loc.street || ""} onChange={(e) => handleTempLocationChange(index, "street", e.target.value)} placeholder="123 Main St" className="rounded-lg h-8 text-xs" />
                      </div>
                      <div className="grid gap-1.5">
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">City</Label>
                        <Input value={loc.city || ""} onChange={(e) => handleTempLocationChange(index, "city", e.target.value)} placeholder="New York" className="rounded-lg h-8 text-xs" />
                      </div>
                      <div className="grid gap-1.5">
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">State</Label>
                        <Input value={loc.state || ""} onChange={(e) => handleTempLocationChange(index, "state", e.target.value)} placeholder="NY" className="rounded-lg h-8 text-xs" />
                      </div>
                      <div className="grid gap-1.5">
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Zip Code</Label>
                        <Input value={loc.zip || ""} onChange={(e) => handleTempLocationChange(index, "zip", e.target.value)} placeholder="10001" className="rounded-lg h-8 text-xs" />
                      </div>
                      <div className="grid gap-1.5 col-span-2">
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Country</Label>
                        <Input value={loc.country || ""} onChange={(e) => handleTempLocationChange(index, "country", e.target.value)} placeholder="USA" className="rounded-lg h-8 text-xs" />
                      </div>
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Full Address <span className="normal-case text-muted-foreground/50">(auto-syncs from fields above)</span></Label>
                      <Input value={loc.fullAddress || ""} onChange={(e) => handleTempLocationChange(index, "fullAddress", e.target.value)} placeholder="123 Main St, New York, NY, 10001, USA" className="rounded-lg h-8 text-xs" />
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Website</Label>
                      <Input value={loc.website || ""} onChange={(e) => handleTempLocationChange(index, "website", e.target.value)} placeholder="https://example.com" className="rounded-lg h-8 text-xs" />
                    </div>
                  </div>
                ))}
                {tempCustomer.location.length === 0 && (
                  <div className="text-center text-sm text-muted-foreground py-6 border border-dashed rounded-xl">
                    No locations — click Add Location to add one.
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsCustomerEditDialogOpen(false)} className="rounded-full font-black uppercase text-[10px] tracking-widest">Cancel</Button>
            <Button onClick={confirmEditCustomer} className="rounded-full font-black uppercase text-[10px] tracking-widest shadow-lg shadow-primary/20">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
      {/* Drive Documents Modal */}
      <DriveDocumentsModal
        open={!!attachmentsOpen}
        onClose={() => setAttachmentsOpen(null)}
        poNumber={attachmentsOpen?.poNumber || ''}
        onOpenLegacy={() => {
          const saved = attachmentsOpen;
          setAttachmentsOpen(null);
          setTimeout(() => setLegacyAttachmentsOpen(saved), 100);
        }}
      />

      {/* Legacy Attachments Modal */}
      <AttachmentsModal
        open={!!legacyAttachmentsOpen}
        onClose={() => setLegacyAttachmentsOpen(null)}
        poNumber={legacyAttachmentsOpen?.poNumber || ''}
        spoNumber={legacyAttachmentsOpen?.spoNumber}
        shipNumber={legacyAttachmentsOpen?.shipNumber}
      />

      {/* Timeline Modal */}
      <TimelineModal
        open={!!timelineOpen}
        onClose={() => setTimelineOpen(null)}
        VBNumber={timelineOpen?.VBNumber}
        VBSerialNumber={timelineOpen?.VBSerialNumber}
        VBShipmentNumber={timelineOpen?.VBShipmentNumber}
        title={timelineOpen?.title}
      />

      {/* Transfer Order Dialog */}
      <TransferOrderDialog
        open={!!transferDialogShip}
        onOpenChange={(open) => { if (!open) setTransferDialogShip(null); }}
        shipmentId={transferDialogShip?._id || ""}
        shipmentLabel={transferDialogShip?.VBShipmentNumber || transferDialogShip?.svbid || ""}
        warehouseName="-"
        warehouseId=""
        supplierId={transferDialogShip?.supplier || ""}
        supplierName={transferDialogShip?._displaySupplier || supplierLocations[transferDialogShip?.supplierLocation || ''] || "-"}
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
