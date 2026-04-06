"use client";

import React, { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import { useUserDataStore } from "@/store/useUserDataStore";
import { SimpleDataTable } from "@/components/admin/simple-data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ColumnDef } from "@tanstack/react-table";
import { Pencil, Trash, Hash, Factory, MapPin, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import Link from "next/link";

interface SupplierLocation {
  vbId: string;
  locationName: string;
  street: string;
  city: string;
  state: string;
  country: string;
  zip: string;
  fullAddress: string;
  website: string;
}

interface Supplier {
  _id: string;
  vbId: string;
  name: string;
  portalEmail?: string;
  portalPassword?: string;
  isOrganic?: boolean;
  location: SupplierLocation[];
}

import { Plus, Globe, Eye, EyeOff, Key, Mail as MailIcon, Leaf } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { TablePageSkeleton } from "@/components/skeletons";
import { cn } from "@/lib/utils";

export default function SuppliersPage() {
  const { 
    suppliers: data, 
    isLoading,
    refetchSuppliers
  } = useUserDataStore();

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Supplier | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightId, setHighlightId] = useState<string | null>(null);

  // Highlight row when coming back from details
  useEffect(() => {
    const hid = searchParams.get('highlight');
    if (hid) {
      setHighlightId(hid);
      // Scroll row into view after a short delay
      setTimeout(() => {
        const row = document.querySelector(`[data-row-id="${hid}"]`);
        if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      // Remove highlight after 3 seconds
      const timer = setTimeout(() => setHighlightId(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  // Filtered data
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    const q = searchQuery.toLowerCase();
    return data.filter((s: any) =>
      s.name?.toLowerCase().includes(q) ||
      s.vbId?.toLowerCase().includes(q) ||
      s.portalEmail?.toLowerCase().includes(q) ||
      s.location?.some((l: any) => l.locationName?.toLowerCase().includes(q) || l.country?.toLowerCase().includes(q))
    );
  }, [data, searchQuery]);

  const [formData, setFormData] = useState<Partial<Supplier>>({
    vbId: "",
    name: "",
    portalEmail: "",
    portalPassword: "",
    location: [],
  });


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingItem
        ? `/api/admin/suppliers/${editingItem._id}`
        : "/api/admin/suppliers";
      const method = editingItem ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error("Failed to save");

      toast.success(editingItem ? "Supplier updated" : "Supplier created");
      setIsSheetOpen(false);
      refetchSuppliers();
    } catch (error) {
      toast.error("An error occurred");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this supplier?")) return;
    try {
      const response = await fetch(`/api/admin/suppliers/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete");
      toast.success("Supplier deleted");
      refetchSuppliers();
    } catch (error) {
      toast.error("Failed to delete supplier");
    }
  };

  const openAddSheet = React.useCallback(() => {
    setEditingItem(null);
    setFormData({
      vbId: "",
      name: "",
      portalEmail: "",
      portalPassword: "",
      location: [],
    });
    setShowPassword(false);
    setIsSheetOpen(true);
  }, []);

  const openEditSheet = (item: Supplier) => {
    setEditingItem(item);
    setFormData({
      ...item,
      portalEmail: item.portalEmail || "",
      portalPassword: item.portalPassword || "",
      location: item.location || [],
    });
    setShowPassword(false);
    setIsSheetOpen(true);
  };

  const handleToggleOrganic = async (item: Supplier) => {
    const newVal = !item.isOrganic;
    try {
      const res = await fetch(`/api/admin/suppliers/${item._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOrganic: newVal }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(
        newVal
          ? `${item.name} tagged as Organic Certified 🌿`
          : `${item.name} organic certification removed`
      );
      refetchSuppliers();
    } catch {
      toast.error("Failed to update organic status");
    }
  };

  const generatePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "Vb$";
    for (let i = 0; i < 9; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData({ ...formData, portalPassword: password });
    setShowPassword(true);
  };

  const handleAddLocation = () => {
    setFormData({
      ...formData,
      location: [
        ...(formData.location || []),
        {
          vbId: "",
          locationName: "",
          street: "",
          city: "",
          state: "",
          country: "",
          zip: "",
          fullAddress: "",
          website: "",
        },
      ],
    });
  };

  const handleRemoveLocation = (index: number) => {
    const newLocations = [...(formData.location || [])];
    newLocations.splice(index, 1);
    setFormData({ ...formData, location: newLocations });
  };

  const handleLocationChange = (index: number, field: keyof SupplierLocation, value: string) => {
    const newLocations = [...(formData.location || [])];
    const currentLocation = { ...newLocations[index], [field]: value };

    // Auto-sync fullAddress from fields
    if (['street', 'city', 'state', 'zip', 'country'].includes(field)) {
      const { street, city, state, zip, country } = currentLocation;
      const parts = [street, city, state, zip, country].filter(Boolean);
      currentLocation.fullAddress = parts.join(", ");
    }

    // Auto-sync fields from fullAddress (Basic parsing)
    if (field === 'fullAddress') {
      const parts = value.split(',').map(s => s.trim());
      if (parts.length > 0) currentLocation.street = parts[0] || "";
      if (parts.length > 1) currentLocation.city = parts[1] || "";
      if (parts.length > 2) currentLocation.state = parts[2] || "";
      if (parts.length > 3) currentLocation.zip = parts[3] || "";
      if (parts.length > 4) currentLocation.country = parts[4] || "";
    }

    newLocations[index] = currentLocation;
    setFormData({ ...formData, location: newLocations });
  };

  const columns: ColumnDef<Supplier>[] = React.useMemo(() => [
    {
      accessorKey: "vbId",
      header: "VB ID",
    },
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex items-center gap-2">
            <span className="font-medium">{item.name}</span>
            {item.isOrganic && (
              <div className="relative group">
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 transition-all duration-300 hover:shadow-md hover:shadow-emerald-200/50 dark:hover:shadow-emerald-900/50">
                  <Image
                    src="/organic certified.png"
                    alt="Organic Certified"
                    width={18}
                    height={18}
                    className="rounded-full"
                  />
                  <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider leading-none hidden sm:inline">Organic</span>
                </div>
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-foreground text-background text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg">
                  🌿 Organic Certified Supplier
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-foreground" />
                </div>
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: "locations",
      header: "Locations",
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3 w-3 text-muted-foreground" />
            <span className="font-medium text-xs">
              {item.location?.length || 0}
            </span>
          </div>
        );
      },
    },
    {
      id: "organic",
      header: "Organic",
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <Switch
              size="sm"
              checked={item.isOrganic || false}
              onCheckedChange={() => handleToggleOrganic(item)}
              className={cn(
                item.isOrganic && "data-[state=checked]:bg-emerald-600"
              )}
            />
            {item.isOrganic && (
              <Leaf className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 animate-in fade-in duration-300" />
            )}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                openEditSheet(item);
              }}
              className="h-8 w-8 p-0"
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(item._id);
              }}
              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
              title="Delete"
            >
              <Trash className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ], []);

  if (isLoading) {
    return <TablePageSkeleton />;
  }

  return (
    <div className="w-full h-full overflow-hidden flex flex-col gap-3">
      <div className="flex-1 overflow-hidden">
        <SimpleDataTable
          columns={columns}
          data={filteredData}
          onAdd={openAddSheet}
          showColumnToggle={false}
          globalFilter={searchQuery}
          onGlobalFilterChange={setSearchQuery}
          onRowClick={(row) => router.push(`/quality-control/suppliers/${row._id}`)}
          rowClassName={(row) => row._id === highlightId ? 'animate-highlight-row' : ''}
          rowDataId={(row) => row._id}
        />
      </div>

      <Dialog open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Supplier" : "Add Supplier"}</DialogTitle>
            <DialogDescription>
              manage supplier details and locations.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="vbId">VB ID</Label>
                <div className="relative">
                  <Hash className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="vbId"
                    className="pl-9 disabled:opacity-70 disabled:cursor-not-allowed bg-muted/50"
                    value={formData.vbId || ""}
                    placeholder={!editingItem ? "Auto-generated" : ""}
                    disabled
                    readOnly
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <div className="relative">
                  <Factory className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    className="pl-9"
                    value={formData.name || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="portalEmail">Portal Email (Login ID)</Label>
                <div className="relative">
                  <MailIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="portalEmail"
                    type="email"
                    className="pl-9"
                    value={formData.portalEmail || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, portalEmail: e.target.value })
                    }
                    placeholder="supplier@example.com"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="portalPassword">Portal Password</Label>
                <div className="relative flex items-center">
                  <Key className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="portalPassword"
                    type={showPassword ? "text" : "password"}
                    className="pl-9 pr-24"
                    value={formData.portalPassword || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, portalPassword: e.target.value })
                    }
                    placeholder="Leave empty to keep current"
                  />
                  <div className="absolute right-1 flex items-center gap-1">
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={generatePassword}
                    >
                      Generate
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Locations</h3>
                <Button type="button" variant="outline" size="sm" onClick={handleAddLocation}>
                  <Plus className="mr-2 h-3 w-3" /> Add Location
                </Button>
              </div>

              <div className="space-y-4">
                {formData.location?.map((loc, index) => (
                  <div key={index} className="grid gap-4 rounded-lg border p-4 relative">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-2 h-6 w-6 text-red-500 hover:text-red-700"
                      onClick={() => handleRemoveLocation(index)}
                    >
                      <Trash className="h-3 w-3" />
                    </Button>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Location VB ID</Label>
                        <Input
                          value={loc.vbId || ""}
                          placeholder={!editingItem ? "Auto-generated" : ""}
                          disabled
                          readOnly
                          className="disabled:opacity-70 disabled:cursor-not-allowed bg-muted/50"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Location Name</Label>
                        <Input
                          value={loc.locationName || ""}
                          onChange={(e) => handleLocationChange(index, "locationName", e.target.value)}
                          placeholder="Main Warehouse"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Street</Label>
                        <Input
                          value={loc.street || ""}
                          onChange={(e) => handleLocationChange(index, "street", e.target.value)}
                          placeholder="123 Main St"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>City</Label>
                        <Input
                          value={loc.city || ""}
                          onChange={(e) => handleLocationChange(index, "city", e.target.value)}
                          placeholder="New York"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>State</Label>
                        <Input
                          value={loc.state || ""}
                          onChange={(e) => handleLocationChange(index, "state", e.target.value)}
                          placeholder="NY"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Zip Code</Label>
                        <Input
                          value={loc.zip || ""}
                          onChange={(e) => handleLocationChange(index, "zip", e.target.value)}
                          placeholder="10001"
                        />
                      </div>
                      <div className="grid gap-2 col-span-2">
                        <Label>Country</Label>
                        <Input
                          value={loc.country || ""}
                          onChange={(e) => handleLocationChange(index, "country", e.target.value)}
                          placeholder="USA"
                        />
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label>Full Address</Label>
                      <div className="relative">
                        <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          className="pl-9"
                          value={loc.fullAddress || ""}
                          onChange={(e) => handleLocationChange(index, "fullAddress", e.target.value)}
                          placeholder="123 Main St, New York, NY, 10001, USA"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">Editing this parses to individual fields.</p>
                    </div>

                    <div className="grid gap-2">
                      <Label>Website</Label>
                      <div className="relative">
                        <Globe className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          className="pl-9"
                          value={loc.website || ""}
                          onChange={(e) => handleLocationChange(index, "website", e.target.value)}
                          placeholder="https://example.com"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {formData.location?.length === 0 && (
                  <div className="text-center text-sm text-muted-foreground py-4 border border-dashed rounded-lg">
                    No locations added.
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="gap-2 sm:space-x-0">
              <Button variant="outline" type="button" onClick={() => setIsSheetOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{editingItem ? "Save Changes" : "Create Supplier"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
