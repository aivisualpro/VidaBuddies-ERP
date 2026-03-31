"use client";

import { useEffect, useState, useMemo } from "react";
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
  ShoppingCart,
  Ship,
  Calendar,
  Anchor,
  Search,
  Package,
  Loader2,
  Box,
  Truck,
  Factory,
  DollarSign,
  Weight,
  FileCheck,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
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

interface SupplierLocation {
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

interface Supplier {
  _id: string;
  vbId: string;
  name: string;
  location: SupplierLocation[];
}

export function SupplierDetails({ supplierId, isSupplierView = false }: { supplierId: string, isSupplierView?: boolean }) {
  const router = useRouter();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [poSearch, setPoSearch] = useState("");
  const [products, setProducts] = useState<Record<string, string>>({});
  const [allSuppliers, setAllSuppliers] = useState<any[]>([]);
  const [supplierLocations, setSupplierLocations] = useState<Record<string, string>>({});

  // Dialog States
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSupplierEditDialogOpen, setIsSupplierEditDialogOpen] = useState(false);
  
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [deletingLocationId, setDeletingLocationId] = useState<string | null>(null);
  const [tempName, setTempName] = useState("");
  const { setLeftContent, setRightContent } = useHeaderActions();

  useEffect(() => {
    if (supplier) {
      setLeftContent(
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-black tracking-tight uppercase bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent flex items-center gap-2">
            <span className="hidden md:inline">{supplier.name} <span className="text-primary/40">/</span></span> <span className="text-primary/40 md:text-primary/40">HISTORY</span>
          </h1>
          <div className="hidden md:flex gap-2">
            <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-black border border-primary/20">{supplier.vbId}</span>
            <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full font-black border uppercase tracking-tighter">{supplier.location?.length || 0} Locations</span>
          </div>
        </div>
      );
      setRightContent(
        <div className="flex items-center gap-2">
          {!isSupplierView && (
            <>
              <Button variant="outline" size="sm" className="font-bold uppercase tracking-widest text-[10px]" onClick={handleEditDetails}>Edit Details</Button>
              <Button size="sm" className="font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20" onClick={handleAddLocation}>Add Location</Button>
              <Button variant="ghost" size="sm" className="font-bold uppercase tracking-widest text-[10px]" onClick={() => router.back()}>
                <ChevronRight className="h-4 w-4 rotate-180 mr-2" /> Back
              </Button>
            </>
          )}
        </div>
      );
    }
    return () => {
      setLeftContent(null);
      setRightContent(null);
    };
  }, [supplier, setLeftContent, setRightContent]);

  useEffect(() => {
    const fetchSupplier = async () => {
      try {
        const response = await fetch(`/api/admin/suppliers/${supplierId}`);
        if (!response.ok) throw new Error("Failed to fetch supplier");
        const data = await response.json();
        setSupplier(data);
      } catch (error) {
        toast.error("Error loading supplier details");
      } finally {
        setLoading(false);
      }
    };

    fetchSupplier();
  }, [supplierId]);

  // Fetch Purchase Orders, Products, and Suppliers for display
  useEffect(() => {
    const fetchPOs = async () => {
      try {
        const res = await fetch('/api/admin/purchase-orders');
        if (res.ok) setPurchaseOrders(await res.json());
      } catch { /* silent */ }
    };
    const fetchProducts = async () => {
      try {
        const res = await fetch('/api/admin/products');
        if (res.ok) {
          const data = await res.json();
          const mapping: Record<string, string> = {};
          data.forEach((p: any) => { mapping[p._id] = p.name; if (p.vbId) mapping[p.vbId] = p.name; });
          setProducts(mapping);
        }
      } catch { /* silent */ }
    };
    const fetchAllSuppliers = async () => {
      try {
        const res = await fetch('/api/admin/suppliers');
        if (res.ok) {
          const data = await res.json();
          setAllSuppliers(data);
          const mapping: Record<string, string> = {};
          data.forEach((sup: any) => {
            sup.location?.forEach((loc: any) => {
              if (loc.vbId) mapping[loc.vbId] = loc.locationName || `${sup.name} - ${loc.city}` || loc.vbId;
            });
          });
          setSupplierLocations(mapping);
        }
      } catch { /* silent */ }
    };
    fetchPOs();
    fetchProducts();
    fetchAllSuppliers();
  }, []);

  // Find POs related to this supplier (supplier field can be _id, vbId, or name)
  const relatedPOs = useMemo(() => {
    if (!supplier) return [];
    const sId = supplier._id?.toLowerCase() || "";
    const sName = supplier.name?.toLowerCase() || "";
    const sVbId = supplier.vbId?.toLowerCase() || "";

    const matchesSupplier = (val: string) => {
      const v = (val || "").toLowerCase();
      return v === sId || v === sName || v === sVbId || v.includes(sName) || v.includes(sId);
    };

    return purchaseOrders.filter(po =>
      po.customerPO?.some((cpo: any) =>
        cpo.shipping?.some((s: any) => matchesSupplier(s.supplier))
      )
    );
  }, [purchaseOrders, supplier]);

  const filteredPOs = useMemo(() => {
    if (!poSearch.trim()) return relatedPOs;
    const q = poSearch.toLowerCase();
    return relatedPOs.filter((po: any) =>
      po.vbpoNo?.toLowerCase().includes(q) ||
      po.category?.toLowerCase().includes(q) ||
      po.customerPO?.some((c: any) =>
        c.shipping?.some((s: any) =>
          s.carrier?.toLowerCase().includes(q) ||
          s.containerNo?.toLowerCase().includes(q) ||
          s.vessellTrip?.toLowerCase().includes(q)
        )
      )
    );
  }, [relatedPOs, poSearch]);

  const getSupplierShipments = (po: any) => {
    const sId = supplier?._id?.toLowerCase() || "";
    const sName = supplier?.name?.toLowerCase() || "";
    const sVbId = supplier?.vbId?.toLowerCase() || "";

    const matchesSupplier = (val: string) => {
      const v = (val || "").toLowerCase();
      return v === sId || v === sName || v === sVbId || v.includes(sName) || v.includes(sId);
    };

    const records: any[] = [];
    po.customerPO?.forEach((cpo: any) => {
      cpo.shipping?.forEach((s: any) => {
        if (matchesSupplier(s.supplier)) {
          records.push({ ...s, customerPONo: cpo.poNo, customer: cpo.customer });
        }
      });
    });
    return records;
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, locationId: string) => {
    const file = e.target.files?.[0];
    if (!file || !supplier) return;

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
        const updatedLocations = supplier.location.map((loc, idx) => {
          const currentId = loc._id || idx.toString();
          if (currentId === locationId) {
            return { ...loc, imageUrl: uploadData.secure_url };
          }
          return loc;
        });

        const updateRes = await fetch(`/api/admin/suppliers/${supplierId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ location: updatedLocations }),
        });

        if (updateRes.ok) {
          const updatedSupplier = await updateRes.json();
          setSupplier(updatedSupplier);
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
    if (!supplier) return;
    const location = supplier.location.find((l, idx) => (l._id || idx.toString()) === locationId);
    if (!location) return;
    
    setEditingLocationId(locationId);
    setTempName(location.locationName);
    setIsEditDialogOpen(true);
  };

  const confirmEditLocation = async () => {
    if (!supplier || !editingLocationId) return;

    try {
      const updatedLocations = supplier.location.map((loc, idx) => {
        if ((loc._id || idx.toString()) === editingLocationId) {
          return { ...loc, locationName: tempName };
        }
        return loc;
      });

      const updateRes = await fetch(`/api/admin/suppliers/${supplierId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: updatedLocations }),
      });

      if (updateRes.ok) {
        const updatedSupplier = await updateRes.json();
        setSupplier(updatedSupplier);
        toast.success("Location name updated!");
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
    if (!supplier || !deletingLocationId) return;

    try {
      const updatedLocations = supplier.location.filter((loc, idx) => (loc._id || idx.toString()) !== deletingLocationId);

      const updateRes = await fetch(`/api/admin/suppliers/${supplierId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: updatedLocations }),
      });

      if (updateRes.ok) {
        const updatedSupplier = await updateRes.json();
        setSupplier(updatedSupplier);
        toast.success("Location deleted successfully");
        setIsDeleteDialogOpen(false);
      }
    } catch (error) {
      toast.error("Failed to delete location.");
    }
  };

  const handleAddLocation = async () => {
    if (!supplier) return;
    
    const newLocation: SupplierLocation = {
      vbId: `${supplier.vbId}-${supplier.location.length + 1}`,
      locationName: "New Site " + (supplier.location.length + 1),
      street: "123 New St",
      city: "City",
      state: "ST",
      country: "Country",
      zip: "00000",
      fullAddress: "123 New St, City, ST 00000, Country",
      website: "https://example.com"
    };

    try {
      const updatedLocations = [...supplier.location, newLocation];
      const updateRes = await fetch(`/api/admin/suppliers/${supplierId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: updatedLocations }),
      });

      if (updateRes.ok) {
        const updatedSupplier = await updateRes.json();
        setSupplier(updatedSupplier);
        toast.success("New location added!");
      }
    } catch (error) {
      toast.error("Failed to add location.");
    }
  };

  const handleEditDetails = () => {
    if (!supplier) return;
    setTempName(supplier.name);
    setIsSupplierEditDialogOpen(true);
  };

  const confirmEditSupplier = async () => {
    if (!supplier || !tempName || tempName === supplier.name) {
      setIsSupplierEditDialogOpen(false);
      return;
    }

    try {
      const updateRes = await fetch(`/api/admin/suppliers/${supplierId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: tempName }),
      });

      if (updateRes.ok) {
        setSupplier({ ...supplier, name: tempName });
        toast.success("Supplier name updated!");
        setIsSupplierEditDialogOpen(false);
      }
    } catch (error) {
      toast.error("Failed to update supplier details.");
    }
  };

  if (loading) {
    return <DetailPageSkeleton />;
  }

  if (!supplier) {
    return <div className="p-8 text-center">Supplier not found</div>;
  }

  return (
    <TooltipProvider>
      <div className="bg-background" style={{ height: 'calc(100vh - 10rem)' }}>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 p-0 h-full overflow-hidden">
        {/* Column 1: Locations */}
        <div className="flex flex-col gap-4 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted">
          <div className="flex items-center gap-2 mb-1 md:mb-2">
            <MapPin className="h-4 w-4 text-primary" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Locations</span>
          </div>

          <div className="space-y-4">
            {supplier.location && supplier.location.length > 0 ? (
              supplier.location.map((loc: SupplierLocation, idx) => (
                <div key={loc._id || idx} className="group relative h-48 md:h-60 overflow-hidden rounded-2xl md:rounded-3xl bg-card text-card-foreground border border-border shadow-none transition-all duration-500 hover:-translate-y-2 hover:border-primary/40">
                  {/* Nano Banana Background Image - Better visibility for Light Theme */}
                  <img 
                    src="/images/nano_banana_bg.png" 
                    alt="Background" 
                    className="absolute inset-0 w-full h-full object-cover opacity-[0.15] dark:opacity-60 mix-blend-multiply dark:mix-blend-overlay group-hover:scale-110 transition-transform duration-700"
                  />
                  

                  {/* Main Content Area - 3 Row Structure */}
                  <div className="absolute inset-0 p-5 md:p-8 flex flex-col justify-end gap-1 md:gap-1.5 z-10">
                    <div className="space-y-1">
                      {/* 1st Row: Location Name */}
                      <h3 className="text-xl md:text-2xl font-black leading-tight text-foreground uppercase tracking-tight">
                        {loc.locationName || "Unnamed"}
                      </h3>
                      
                      {/* 2nd Row: vbId */}
                      <div className="inline-flex px-2 py-0.5 bg-foreground/5 dark:bg-white/10 rounded-md border border-foreground/5">
                        <span className="text-[10px] font-black tracking-[0.2em] text-muted-foreground/80 uppercase">
                          {loc.vbId || 'Active Site'}
                        </span>
                      </div>
                      
                      {/* 3rd Row: Full Address */}
                      <p className="text-muted-foreground text-[10px] md:text-[11px] font-medium leading-relaxed line-clamp-2 max-w-[90%] uppercase tracking-widest pt-1">
                        {loc.fullAddress || `${loc.street}, ${loc.city}, ${loc.country}`}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 md:pt-3">
                      {/* Action Row with Tooltips */}
                      <div className="flex gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <a 
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((loc.fullAddress || `${loc.street}, ${loc.city}, ${loc.country}`).replace(/\|/g, ' '))}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="h-9 w-9 md:h-10 md:w-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-90 shadow-none border border-primary/20"
                            >
                              <MapPin className="h-4 w-4" />
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
                                className="h-9 w-9 md:h-10 md:w-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-90 shadow-none border border-primary/20"
                              >
                                <Globe className="h-4 w-4" />
                              </a>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="bg-black text-white border-white/10 font-black uppercase text-[10px] tracking-widest">Website</TooltipContent>
                          </Tooltip>
                        )}

                        {!isSupplierView && (
                          <>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  onClick={() => handleEditLocation(loc._id || idx.toString())}
                                  className="h-9 w-9 md:h-10 md:w-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-90 shadow-none border border-primary/20 p-0 md:opacity-0 md:group-hover:opacity-100 duration-300"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="bg-black text-white border-white/10 font-black uppercase text-[10px] tracking-widest">Edit Site</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  onClick={() => handleDeleteLocation(loc._id || idx.toString())}
                                  className="h-9 w-9 md:h-10 md:w-10 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-90 shadow-none border border-destructive/20 p-0 md:opacity-0 md:group-hover:opacity-100 duration-300"
                                >
                                  <Trash className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="bg-black text-white border-white/10 font-black uppercase text-[10px] tracking-widest">Delete Site</TooltipContent>
                            </Tooltip>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-10 border border-dashed rounded-lg bg-accent/5 font-black uppercase text-xs tracking-widest text-muted-foreground opacity-50">
                No locations registered
              </div>
            )}
          </div>
        </div>

        {/* Column 2-3: Purchase Order History — Rich Shipping Cards */}
        <div className="md:col-span-2 flex flex-col gap-3 md:overflow-y-auto md:pr-2 scrollbar-thin scrollbar-thumb-muted">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-primary" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Shipment History</span>
              <Badge variant="secondary" className="text-[9px] font-black px-1.5 py-0">
                {filteredPOs.reduce((acc: number, po: any) => acc + getSupplierShipments(po).length, 0)}
              </Badge>
            </div>
          </div>

          {/* Search */}
          <div className="relative shrink-0">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search PO#, carrier, container..."
              value={poSearch}
              onChange={(e) => setPoSearch(e.target.value)}
              className="h-9 pl-9 text-xs bg-foreground/5 border-transparent focus-visible:ring-1 placeholder:text-[10px] placeholder:uppercase placeholder:tracking-wider"
            />
          </div>

          {filteredPOs.length === 0 ? (
            <div className="flex-1 flex items-center justify-center min-h-[200px] border border-dashed rounded-xl bg-accent/5">
              <div className="text-center space-y-2">
                <ShoppingCart className="h-8 w-8 text-muted-foreground/20 mx-auto" />
                <p className="font-black uppercase text-[10px] tracking-widest text-muted-foreground/50">
                  {relatedPOs.length === 0 ? "No purchase orders found" : "No results match your search"}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPOs.map((po: any) => {
                const shipments = getSupplierShipments(po);
                return shipments.map((ship: any, idx: number) => {
                  const formatDate = (d?: string) => {
                    if (!d) return "-";
                    const dt = new Date(d);
                    return `${String(dt.getMonth()+1).padStart(2,'0')}/${String(dt.getDate()).padStart(2,'0')}/${dt.getFullYear()}`;
                  };

                  const resolveSupplierName = () => {
                    const locName = supplierLocations[ship.supplierLocation] || ship.supplierLocation || '';
                    const sup = allSuppliers.find((s: any) => s.location?.some((l: any) => l.vbId === ship.supplierLocation));
                    const supName = sup?.name || supplier?.name || '';
                    return supName ? { supName, locName } : { supName: '', locName: locName || '-' };
                  };
                  const { supName, locName } = resolveSupplierName();

                  return (
                    <div
                      key={`${po._id}-${idx}`}
                      className="group relative overflow-hidden rounded-2xl bg-card text-card-foreground border border-border/60 shadow-sm transition-all duration-300 hover:shadow-md hover:border-primary/30 cursor-pointer"
                      onClick={() => router.push(`/admin/purchase-orders/${po._id}`)}
                    >
                      {/* ─── HEADER BAR ─── */}
                      <div className={cn(
                        "flex items-center justify-between px-5 py-3 border-b border-border/40",
                        ship.status === 'In Transit' && 'bg-blue-500/5 dark:bg-blue-500/10',
                        ship.status === 'Ordered' && 'bg-amber-500/5 dark:bg-amber-500/10',
                        ship.status === 'Delivered' && 'bg-emerald-500/5 dark:bg-emerald-500/10',
                        ship.status === 'Cancelled' && 'bg-red-500/5 dark:bg-red-500/10',
                        !ship.status && 'bg-muted/30',
                      )}>
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Ship className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-bold tracking-tight">{ship.svbid || ship.spoNo || po.vbpoNo}</p>
                            <p className="text-[10px] text-muted-foreground">from <span className="font-semibold text-foreground/70">{ship.customerPONo || po.vbpoNo}</span></p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border",
                            ship.status === 'In Transit' && 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
                            ship.status === 'Ordered' && 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
                            ship.status === 'Delivered' && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
                            ship.status === 'Cancelled' && 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
                            !ship.status && 'bg-muted text-muted-foreground border-border',
                          )}>
                            {ship.status || 'Pending'}
                          </span>
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>

                      {/* ─── BODY ─── */}
                      <div className="p-5 space-y-4">

                        {/* Row 1: Container | BOL | Carrier | Vessel */}
                        <div className="grid grid-cols-4 gap-3">
                          {[{ label: 'Container', value: ship.containerNo, icon: Box }, { label: 'BOL Number', value: ship.BOLNumber, icon: Hash }, { label: 'Carrier', value: ship.carrier, icon: Truck }, { label: 'Vessel / Trip', value: ship.vessellTrip, icon: Ship }].map((item, i) => (
                            <div key={i} className="flex items-start gap-2 min-w-0">
                              <div className="h-7 w-7 rounded-md bg-muted/60 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <item.icon className="h-3.5 w-3.5 text-primary/70" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[9px] font-semibold uppercase text-foreground/60 tracking-wider">{item.label}</p>
                                <p className="text-xs font-bold text-foreground truncate uppercase" title={item.value || '-'}>{item.value || '-'}</p>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Row 2: Supplier */}
                        <div className="rounded-xl bg-gradient-to-r from-primary/[0.04] to-transparent border border-primary/10 p-3">
                          <div className="flex items-center gap-1.5 mb-2">
                            <Factory className="h-3.5 w-3.5 text-primary" />
                            <p className="text-[9px] font-bold uppercase tracking-widest text-primary">Supplier</p>
                          </div>
                          <div className="grid grid-cols-4 gap-3">
                            <div className="col-span-2 min-w-0">
                              <p className="text-[9px] font-semibold uppercase text-foreground/60 tracking-wider">Name & Location</p>
                              <p className="text-xs font-bold text-foreground truncate">
                                {supName ? (<><span className="text-primary">{supName}</span> <span className="text-muted-foreground">—</span> {locName}</>) : locName}
                              </p>
                            </div>
                            <div className="min-w-0">
                              <p className="text-[9px] font-semibold uppercase text-foreground/60 tracking-wider">Supplier PO</p>
                              <p className="text-xs font-bold text-foreground truncate">{ship.supplierPO || '-'}</p>
                            </div>
                            <div className="min-w-0">
                              <p className="text-[9px] font-semibold uppercase text-foreground/60 tracking-wider">PO Date</p>
                              <p className="text-xs font-bold text-foreground">{formatDate(ship.supplierPoDate)}</p>
                            </div>
                          </div>
                        </div>

                        {/* Row 3: Products */}
                        <div>
                          <div className="flex items-center gap-1.5 mb-2">
                            <Package className="h-3.5 w-3.5 text-primary/70" />
                            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Products</p>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {(() => {
                              const productIds = (Array.isArray(ship.products) && ship.products.length > 0) ? ship.products
                                : typeof ship.products === 'string' ? ship.products.split(',').filter(Boolean)
                                  : ship.product ? [ship.product] : [];
                              return productIds.length > 0
                                ? productIds.map((pid: string, i: number) => (
                                  <span key={i} className="inline-flex items-center text-[10px] font-semibold bg-primary/8 text-primary border border-primary/15 px-2.5 py-1 rounded-lg">
                                    {products[pid] || pid}
                                  </span>
                                ))
                                : <span className="text-xs text-muted-foreground">—</span>;
                            })()}
                          </div>
                        </div>

                        {/* Row 4: Logistics & Route */}
                        <div className="rounded-xl bg-muted/30 dark:bg-muted/20 border border-border/40 overflow-hidden">
                          <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1">
                            <Anchor className="h-3.5 w-3.5 text-primary/70" />
                            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Logistics & Route</p>
                          </div>
                          <div className="grid grid-cols-5 gap-0 px-3 pb-2.5 pt-1">
                            {[
                              { label: 'Port of Lading', value: ship.portOfLading },
                              { label: 'Port of Entry', value: ship.portOfEntryShipTo },
                              { label: 'Landing Date', value: formatDate(ship.dateOfLanding) },
                              { label: 'ETA', value: formatDate(ship.ETA) },
                              { label: 'Updated ETA', value: formatDate(ship.updatedETA), highlight: true },
                            ].map((item, i) => (
                              <div key={i} className={cn("text-center py-1", i < 4 && 'border-r border-border/40')}>
                                <p className="text-[9px] font-bold uppercase text-foreground/50 tracking-wider mb-0.5">{item.label}</p>
                                <p className={cn("text-[10px] font-bold truncate px-1", item.highlight ? 'text-primary' : 'text-foreground')} title={item.value || '-'}>{item.value || '-'}</p>
                              </div>
                            ))}
                          </div>
                          <div className="border-t border-border/30 px-3 py-2">
                            <p className="text-[9px] font-bold uppercase text-foreground/50 tracking-wider mb-0.5">Booking Ref</p>
                            <p className="text-[10px] font-bold text-foreground">{ship.carrierBookingRef || '-'}</p>
                          </div>
                        </div>

                        {/* Row 5: Cargo & Financials */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-xl bg-muted/30 dark:bg-muted/20 border border-border/40 p-3">
                            <div className="flex items-center gap-1.5 mb-2">
                              <Weight className="h-3.5 w-3.5 text-primary/70" />
                              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Weights & Measures</p>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              {[
                                { label: 'Drums', value: ship.drums || 0 },
                                { label: 'Pallets', value: ship.pallets || 0 },
                                { label: 'Gallons', value: ship.gallons || 0 },
                                { label: 'Net KG', value: ship.netWeightKG || 0 },
                                { label: 'Gross KG', value: ship.grossWeightKG || 0 },
                              ].map((item, i) => (
                                <div key={i} className="text-center bg-background/60 rounded-lg py-1.5 px-1 border border-border/30">
                                  <p className="text-xs font-bold text-foreground">{typeof item.value === 'number' ? item.value.toLocaleString() : item.value}</p>
                                  <p className="text-[8px] font-bold uppercase text-foreground/50 tracking-wider">{item.label}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="rounded-xl bg-muted/30 dark:bg-muted/20 border border-border/40 p-3">
                            <div className="flex items-center gap-1.5 mb-2">
                              <DollarSign className="h-3.5 w-3.5 text-primary/70" />
                              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Financials</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {[
                                { label: 'Inv Value', value: `$${(ship.invValue || 0).toLocaleString()}` },
                                { label: 'Est. Duties', value: `$${(ship.estTrumpDuties || 0).toLocaleString()}` },
                                { label: 'Fees Amount', value: `$${(ship.feesAmount || 0).toLocaleString()}` },
                                { label: 'Est Duties (2)', value: `$${(ship.estimatedDuties || 0).toLocaleString()}` },
                              ].map((item, i) => (
                                <div key={i} className="text-center bg-background/60 rounded-lg py-1.5 px-1 border border-border/30">
                                  <p className="text-xs font-bold text-foreground">{item.value}</p>
                                  <p className="text-[7px] font-semibold uppercase text-muted-foreground/50 tracking-wider">{item.label}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Footer: PO Reference */}
                        <div className="flex items-center justify-between pt-2 border-t border-border/20">
                          <div className="flex items-center gap-2">
                            <div className="h-5 w-5 rounded-md bg-muted flex items-center justify-center">
                              <ShoppingCart className="h-3 w-3 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="text-[9px] font-bold uppercase text-foreground/50 tracking-wider">Purchase Order</p>
                              <p className="text-[10px] font-bold text-primary">{po.vbpoNo} — {po.orderType} — {po.category}</p>
                            </div>
                          </div>
                          {po.date && (
                            <span className="text-[9px] text-muted-foreground font-medium flex items-center gap-1">
                              <Calendar className="h-2.5 w-2.5" />
                              {new Date(po.date).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                });
              })}
            </div>
          )}
        </div>
      </div>

      {/* Edit Location Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-3xl border-primary/20 bg-card/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-tight">Edit Location Name</DialogTitle>
            <DialogDescription className="text-muted-foreground uppercase text-[10px] tracking-widest font-bold">
              Update the name for this site.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Location Name</Label>
              <Input
                id="name"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                className="rounded-2xl bg-foreground/5 border-border focus-visible:ring-primary h-12 text-sm font-bold"
              />
            </div>
          </div>
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

      {/* Edit Supplier Dialog */}
      <Dialog open={isSupplierEditDialogOpen} onOpenChange={setIsSupplierEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-3xl border-primary/20 bg-card/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-tight">Edit Supplier Name</DialogTitle>
            <DialogDescription className="text-muted-foreground uppercase text-[10px] tracking-widest font-bold">
              Update the main registration name.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="suppName" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Supplier Name</Label>
              <Input
                id="suppName"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                className="rounded-2xl bg-foreground/5 border-border focus-visible:ring-primary h-12 text-sm font-bold"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsSupplierEditDialogOpen(false)} className="rounded-full font-black uppercase text-[10px] tracking-widest">Cancel</Button>
            <Button onClick={confirmEditSupplier} className="rounded-full font-black uppercase text-[10px] tracking-widest shadow-lg shadow-primary/20">Update Name</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </TooltipProvider>
  );
}
