"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUserDataStore } from "@/store/useUserDataStore";
import { SimpleDataTable } from "@/components/admin/simple-data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
import { Pencil, Trash, Warehouse as WarehouseIcon, MapPin, Plus, X, User, Mail, Phone, Star } from "lucide-react";
import { TablePageSkeleton } from "@/components/skeletons";

interface WarehouseContact {
  name: string;
  email?: string;
  phone?: string;
  isActive: boolean;
  isPrimary: boolean;
}

interface Warehouse {
  _id: string;
  name: string;
  address: string;
  contacts?: WarehouseContact[];
}

export default function WarehousePage() {
  const router = useRouter();
  const { 
    warehouses: data, 
    isLoading,
    refetchWarehouses
  } = useUserDataStore();

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Warehouse | null>(null);

  const defaultFormData: Partial<Warehouse> = {
    name: "",
    address: "",
    contacts: [],
  };

  const [formData, setFormData] = useState<Partial<Warehouse>>(defaultFormData);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingItem
        ? `/api/admin/warehouse/${editingItem._id}`
        : "/api/admin/warehouse";
      const method = editingItem ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error("Failed to save");

      toast.success(editingItem ? "Warehouse updated" : "Warehouse created");
      setIsSheetOpen(false);
      refetchWarehouses();
    } catch (error) {
      toast.error("An error occurred");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this warehouse?")) return;
    try {
      const response = await fetch(`/api/admin/warehouse/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete");
      toast.success("Warehouse deleted");
      refetchWarehouses();
    } catch (error) {
      toast.error("Failed to delete warehouse");
    }
  };

  const openAddSheet = () => {
    setEditingItem(null);
    setFormData({ name: "", address: "", contacts: [] });
    setIsSheetOpen(true);
  };

  const openEditSheet = (item: Warehouse) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      address: item.address,
      contacts: item.contacts || [],
    });
    setIsSheetOpen(true);
  };

  // Contact helpers
  const addContact = () => {
    setFormData({
      ...formData,
      contacts: [...(formData.contacts || []), { name: "", email: "", phone: "", isActive: true, isPrimary: false }],
    });
  };

  const updateContact = (index: number, field: keyof WarehouseContact, value: any) => {
    const newContacts = [...(formData.contacts || [])];
    newContacts[index] = { ...newContacts[index], [field]: value };
    // If setting primary, unset others
    if (field === "isPrimary" && value === true) {
      newContacts.forEach((c, i) => {
        if (i !== index) c.isPrimary = false;
      });
    }
    setFormData({ ...formData, contacts: newContacts });
  };

  const removeContact = (index: number) => {
    const newContacts = [...(formData.contacts || [])];
    newContacts.splice(index, 1);
    setFormData({ ...formData, contacts: newContacts });
  };

  const columns: ColumnDef<Warehouse>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.name}</span>
      ),
    },
    {
      accessorKey: "address",
      header: "Address",
    },
    {
      id: "contacts",
      header: "Contacts",
      cell: ({ row }) => {
        const contacts = row.original.contacts || [];
        const activeCount = contacts.filter(c => c.isActive).length;
        const primary = contacts.find(c => c.isPrimary);
        if (contacts.length === 0) return <span className="text-muted-foreground text-xs">—</span>;
        return (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">{activeCount} contact{activeCount !== 1 ? "s" : ""}</Badge>
            {primary && <span className="text-xs text-muted-foreground truncate max-w-[140px]">{primary.name}</span>}
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
              onClick={(e) => { e.stopPropagation(); openEditSheet(item); }}
              className="h-8 w-8 p-0"
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => { e.stopPropagation(); handleDelete(item._id); }}
              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
              title="Delete"
            >
              <Trash className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  if (isLoading) {
    return <TablePageSkeleton />;
  }

  return (
    <div className="w-full h-full overflow-hidden">
      <SimpleDataTable
        columns={columns}
        data={data}
        searchKey="name"
        onAdd={openAddSheet}
        onRowClick={(item) => router.push(`/inventory/warehouse/${item._id}`)}
        title="Warehouses"
      />

      <Dialog open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Warehouse" : "Add Warehouse"}</DialogTitle>
            <DialogDescription>
              Manage warehouse details and contacts.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <div className="relative">
                    <WarehouseIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="name"
                      className="pl-9"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      required
                    />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <div className="relative">
                    <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="address"
                      className="pl-9"
                      value={formData.address}
                      onChange={(e) =>
                        setFormData({ ...formData, address: e.target.value })
                      }
                    />
                </div>
              </div>
            </div>

            {/* Contacts Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Contacts
                  <Badge variant="secondary" className="text-xs">{formData.contacts?.length || 0}</Badge>
                </h3>
                <Button type="button" size="sm" variant="outline" onClick={addContact}>
                  <Plus className="w-4 h-4 mr-2" /> Add Contact
                </Button>
              </div>

              {formData.contacts && formData.contacts.length > 0 ? (
                <div className="space-y-3">
                  {formData.contacts.map((contact, idx) => (
                    <div key={idx} className="border rounded-lg p-4 bg-muted/20 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-semibold text-muted-foreground">#{idx + 1}</span>
                          {contact.isPrimary && (
                            <Badge className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800">
                              <Star className="h-3 w-3 mr-0.5" /> Primary
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5">
                            <Label htmlFor={`active-${idx}`} className="text-xs text-muted-foreground">Active</Label>
                            <Switch
                              id={`active-${idx}`}
                              size="sm"
                              checked={contact.isActive}
                              onCheckedChange={(val) => updateContact(idx, "isActive", val)}
                            />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Label htmlFor={`primary-${idx}`} className="text-xs text-muted-foreground">Primary</Label>
                            <Switch
                              id={`primary-${idx}`}
                              size="sm"
                              checked={contact.isPrimary}
                              onCheckedChange={(val) => updateContact(idx, "isPrimary", val)}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
                            onClick={() => removeContact(idx)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="relative">
                          <User className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                          <Input
                            className="pl-8 h-9 text-sm"
                            placeholder="Name"
                            value={contact.name}
                            onChange={(e) => updateContact(idx, "name", e.target.value)}
                            required
                          />
                        </div>
                        <div className="relative">
                          <Mail className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                          <Input
                            className="pl-8 h-9 text-sm"
                            type="email"
                            placeholder="Email"
                            value={contact.email || ""}
                            onChange={(e) => updateContact(idx, "email", e.target.value)}
                          />
                        </div>
                        <div className="relative">
                          <Phone className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                          <Input
                            className="pl-8 h-9 text-sm"
                            placeholder="Phone"
                            value={contact.phone || ""}
                            onChange={(e) => updateContact(idx, "phone", e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border rounded-lg p-6 text-center text-muted-foreground text-sm bg-muted/10">
                  <User className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  No contacts added yet
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:space-x-0">
               <Button variant="outline" type="button" onClick={() => setIsSheetOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{editingItem ? "Save Changes" : "Create Warehouse"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
