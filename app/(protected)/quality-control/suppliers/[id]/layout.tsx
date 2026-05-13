"use client";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ArrowLeft, Pencil, Trash2, Loader2, Hash, Factory, Mail as MailIcon, Key, Eye, EyeOff, MapPin, Globe, Plus, Trash } from "lucide-react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

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

export default function AppAdminSupplierLayout({ children, params }: { children: React.ReactNode, params: Promise<{ id: string }> }) {
  const pathname = usePathname();
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const refetchSuppliers = () => queryClient.invalidateQueries({ queryKey: ["suppliers"] });
  const activeTab = pathname.includes("/supply-survey") ? "supply-survey" : pathname.includes("/survey") ? "survey" : pathname.includes("/documents") ? "documents" : pathname.includes("/history") ? "history" : pathname.includes("/specs") ? "specs" : "dashboard";

  // Delete check
  const [canDelete, setCanDelete] = useState(false);
  const [deleteChecked, setDeleteChecked] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState<any>({
    vbId: "", name: "", portalEmail: "", portalPassword: "", location: [],
  });

  useEffect(() => {
    fetch(`/api/admin/suppliers/${id}/can-delete`)
      .then((r) => r.json())
      .then((data) => {
        setCanDelete(!!data.canDelete);
        setDeleteChecked(true);
      })
      .catch(() => setDeleteChecked(true));
  }, [id]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/suppliers/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Supplier deleted successfully.");
      refetchSuppliers();
      router.push("/quality-control/suppliers");
    } catch {
      toast.error("Failed to delete supplier.");
    } finally {
      setDeleting(false);
    }
  };

  const openEditDialog = async () => {
    setEditLoading(true);
    try {
      const res = await fetch(`/api/admin/suppliers/${id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setFormData({
        vbId: data.vbId || "",
        name: data.name || "",
        portalEmail: data.portalEmail || "",
        portalPassword: data.portalPassword || "",
        location: data.location || [],
      });
      setShowPassword(false);
      setEditOpen(true);
    } catch {
      toast.error("Failed to load supplier data.");
    } finally {
      setEditLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/admin/suppliers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error();
      toast.success("Supplier updated!");
      setEditOpen(false);
      refetchSuppliers();
      router.refresh();
    } catch {
      toast.error("Failed to update supplier.");
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
        { vbId: "", locationName: "", street: "", city: "", state: "", country: "", zip: "", fullAddress: "", website: "" },
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
    if (['street', 'city', 'state', 'zip', 'country'].includes(field)) {
      const { street, city, state, zip, country } = currentLocation;
      currentLocation.fullAddress = [street, city, state, zip, country].filter(Boolean).join(", ");
    }
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

  return (
    <div className="flex-1 flex flex-col pt-2">
      <div className="border-b sticky top-0 z-20 bg-background flex items-center justify-between pr-4 gap-4">
        <div className="flex h-10 items-center overflow-x-auto gap-2">
          <Link href={`/quality-control/suppliers/${id}/dashboard`} className={`inline-flex items-center justify-center whitespace-nowrap px-4 py-2 text-xs font-black transition-colors uppercase tracking-widest ${activeTab === 'dashboard' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground border-transparent'}`}>Dashboard</Link>
          <Link href={`/quality-control/suppliers/${id}/documents`} className={`inline-flex items-center justify-center whitespace-nowrap px-4 py-2 text-xs font-black transition-colors uppercase tracking-widest ${activeTab === 'documents' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground border-transparent'}`}>Documents</Link>
          <Link href={`/quality-control/suppliers/${id}/survey`} className={`inline-flex items-center justify-center whitespace-nowrap px-4 py-2 text-xs font-black transition-colors uppercase tracking-widest ${activeTab === 'survey' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground border-transparent'}`}>Q&F Safety Survey</Link>
          <Link href={`/quality-control/suppliers/${id}/supply-survey`} className={`inline-flex items-center justify-center whitespace-nowrap px-4 py-2 text-xs font-black transition-colors uppercase tracking-widest ${activeTab === 'supply-survey' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground border-transparent'}`}>Q&F Supply Survey</Link>
          <Link href={`/quality-control/suppliers/${id}/history`} className={`inline-flex items-center justify-center whitespace-nowrap px-4 py-2 text-xs font-black transition-colors uppercase tracking-widest ${activeTab === 'history' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground border-transparent'}`}>History</Link>
          <Link href={`/quality-control/suppliers/${id}/specs`} className={`inline-flex items-center justify-center whitespace-nowrap px-4 py-2 text-xs font-black transition-colors uppercase tracking-widest ${activeTab === 'specs' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground border-transparent'}`}>Specs</Link>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 hidden md:flex">
          {/* Edit */}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 text-primary hover:bg-primary/10 border-primary/20"
            onClick={openEditDialog}
            disabled={editLoading}
            title="Edit Supplier"
          >
            {editLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pencil className="h-3.5 w-3.5" />}
          </Button>

          {/* Delete — only visible when safe to delete */}
          {deleteChecked && canDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:bg-destructive/10 border-destructive/20"
                  title="Delete Supplier"
                >
                  {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Supplier</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the supplier and all associated data.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleting ? "Deleting..." : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {/* Back */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-[10px] font-bold uppercase tracking-widest gap-1.5"
            onClick={() => router.push(`/quality-control/suppliers?highlight=${id}`)}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Suppliers
          </Button>
        </div>
      </div>
      <div className="flex-1 w-full h-full pb-0 pt-2">
        {children}
      </div>

      {/* Edit Supplier Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Supplier</DialogTitle>
            <DialogDescription>Update supplier details and locations.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="vbId">VB ID</Label>
                <div className="relative">
                  <Hash className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input id="vbId" className="pl-9 disabled:opacity-70 bg-muted/50" value={formData.vbId || ""} disabled readOnly />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <div className="relative">
                  <Factory className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input id="name" className="pl-9" value={formData.name || ""} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="portalEmail">Portal Email (Login ID)</Label>
                <div className="relative">
                  <MailIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input id="portalEmail" type="email" className="pl-9" value={formData.portalEmail || ""} onChange={(e) => setFormData({ ...formData, portalEmail: e.target.value })} placeholder="supplier@example.com" />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="portalPassword">Portal Password</Label>
                <div className="relative flex items-center">
                  <Key className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input id="portalPassword" type={showPassword ? "text" : "password"} className="pl-9 pr-24" value={formData.portalPassword || ""} onChange={(e) => setFormData({ ...formData, portalPassword: e.target.value })} placeholder="Leave empty to keep current" />
                  <div className="absolute right-1 flex items-center gap-1">
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="h-7 text-xs px-2" onClick={generatePassword}>
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
                {formData.location?.map((loc: any, index: number) => (
                  <div key={index} className="grid gap-4 rounded-lg border p-4 relative">
                    <Button type="button" variant="ghost" size="icon" className="absolute right-2 top-2 h-6 w-6 text-red-500 hover:text-red-700" onClick={() => handleRemoveLocation(index)}>
                      <Trash className="h-3 w-3" />
                    </Button>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Location VB ID</Label>
                        <Input value={loc.vbId || ""} disabled readOnly className="disabled:opacity-70 bg-muted/50" />
                      </div>
                      <div className="grid gap-2">
                        <Label>Location Name</Label>
                        <Input value={loc.locationName || ""} onChange={(e) => handleLocationChange(index, "locationName", e.target.value)} placeholder="Main Warehouse" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Street</Label>
                        <Input value={loc.street || ""} onChange={(e) => handleLocationChange(index, "street", e.target.value)} placeholder="123 Main St" />
                      </div>
                      <div className="grid gap-2">
                        <Label>City</Label>
                        <Input value={loc.city || ""} onChange={(e) => handleLocationChange(index, "city", e.target.value)} placeholder="New York" />
                      </div>
                      <div className="grid gap-2">
                        <Label>State</Label>
                        <Input value={loc.state || ""} onChange={(e) => handleLocationChange(index, "state", e.target.value)} placeholder="NY" />
                      </div>
                      <div className="grid gap-2">
                        <Label>Zip Code</Label>
                        <Input value={loc.zip || ""} onChange={(e) => handleLocationChange(index, "zip", e.target.value)} placeholder="10001" />
                      </div>
                      <div className="grid gap-2 col-span-2">
                        <Label>Country</Label>
                        <Input value={loc.country || ""} onChange={(e) => handleLocationChange(index, "country", e.target.value)} placeholder="USA" />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label>Full Address</Label>
                      <div className="relative">
                        <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input className="pl-9" value={loc.fullAddress || ""} onChange={(e) => handleLocationChange(index, "fullAddress", e.target.value)} placeholder="123 Main St, New York, NY, 10001, USA" />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label>Website</Label>
                      <div className="relative">
                        <Globe className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input className="pl-9" value={loc.website || ""} onChange={(e) => handleLocationChange(index, "website", e.target.value)} placeholder="https://example.com" />
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
              <Button variant="outline" type="button" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
