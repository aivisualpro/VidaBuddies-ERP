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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

  // Fetch Purchase Orders
  useEffect(() => {
    const fetchPOs = async () => {
      try {
        const res = await fetch('/api/admin/purchase-orders');
        if (res.ok) setPurchaseOrders(await res.json());
      } catch { /* silent */ }
    };
    fetchPOs();
  }, []);

  // Find POs related to this supplier
  const relatedPOs = useMemo(() => {
    if (!supplier) return [];
    const sName = supplier.name?.toLowerCase() || "";
    return purchaseOrders.filter(po =>
      po.customerPO?.some((cpo: any) =>
        cpo.shipping?.some((s: any) => (s.supplier || "").toLowerCase().includes(sName))
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
    const sName = supplier?.name?.toLowerCase() || "";
    const records: any[] = [];
    po.customerPO?.forEach((cpo: any) => {
      cpo.shipping?.forEach((s: any) => {
        if ((s.supplier || "").toLowerCase().includes(sName)) {
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
      <div className="flex flex-col h-full bg-background">

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 p-0 md:h-full md:overflow-hidden">
        {/* Column 1: Locations */}
        <div className="flex flex-col gap-4 md:overflow-y-auto md:pr-2 scrollbar-thin scrollbar-thumb-muted">
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

        {/* Column 2-3: Purchase Order History */}
        <div className="md:col-span-2 flex flex-col gap-3 md:overflow-y-auto md:pr-2 scrollbar-thin scrollbar-thumb-muted">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-primary" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Purchase Order History</span>
              <Badge variant="secondary" className="text-[9px] font-black px-1.5 py-0">{relatedPOs.length}</Badge>
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
            <div className="space-y-2">
              {filteredPOs.map((po: any) => {
                const shipments = getSupplierShipments(po);
                return (
                  <div
                    key={po._id}
                    className="rounded-xl border border-border bg-card overflow-hidden cursor-pointer hover:border-primary/30 hover:shadow-sm transition-all"
                    onClick={() => router.push(`/admin/purchase-orders/${po._id}`)}
                  >
                    {/* PO Header */}
                    <div className="px-3 py-2 bg-muted/40 border-b border-border flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-primary">{po.vbpoNo}</span>
                        {po.orderType && (
                          <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0">
                            {po.orderType}
                          </Badge>
                        )}
                        {po.category && (
                          <Badge variant="secondary" className="text-[8px] font-bold uppercase tracking-widest px-1.5 py-0">
                            {po.category}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {po.date && (
                          <span className="text-[9px] text-muted-foreground font-medium flex items-center gap-1">
                            <Calendar className="h-2.5 w-2.5" />
                            {new Date(po.date).toLocaleDateString()}
                          </span>
                        )}
                        <ExternalLink className="h-3 w-3 text-muted-foreground/40" />
                      </div>
                    </div>

                    {/* Shipments */}
                    <div className="divide-y divide-border/50">
                      {shipments.map((s: any, i: number) => (
                        <div key={i} className="px-3 py-2 hover:bg-muted/10 text-[11px]">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <span className="font-bold text-foreground shrink-0">{s.spoNo || "-"}</span>
                              {s.status && (
                                <Badge className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0 shrink-0 ${
                                  s.status.toLowerCase().includes("transit")
                                    ? "bg-blue-600 text-white"
                                    : s.status.toLowerCase().includes("receiv")
                                    ? "bg-green-600 text-white"
                                    : s.status.toLowerCase().includes("standby")
                                    ? "bg-yellow-600 text-white"
                                    : s.status.toLowerCase().includes("order")
                                    ? "bg-orange-500 text-white"
                                    : "bg-zinc-500 text-white"
                                }`}>
                                  {s.status}
                                </Badge>
                              )}
                              <div className="flex flex-wrap gap-1 min-w-0">
                                {(s.products || (s.product ? [s.product] : [])).slice(0, 2).map((p: string, pi: number) => (
                                  <span key={pi} className="text-[9px] font-bold px-1.5 py-0 bg-primary/10 text-primary rounded border border-primary/20 truncate max-w-[120px]">
                                    {p}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center gap-3 text-[10px] text-muted-foreground shrink-0">
                              {s.carrier && <span className="font-medium">{s.carrier}</span>}
                              {s.ETA && (
                                <span className="flex items-center gap-0.5">
                                  <Calendar className="h-2.5 w-2.5" />
                                  {new Date(s.ETA).toLocaleDateString()}
                                </span>
                              )}
                              {s.drums != null && (
                                <span><span className="font-bold text-foreground">{s.drums}</span> dr</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
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
