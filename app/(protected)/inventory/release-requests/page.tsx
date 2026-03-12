"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { SimpleDataTable } from "@/components/admin/simple-data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { toast } from "sonner";
import { ColumnDef } from "@tanstack/react-table";
import { Pencil, Trash, Plus, X, Hash, Truck, MapPin, ChevronsUpDown, Check } from "lucide-react";
import { format } from "date-fns";
import { TablePageSkeleton } from "@/components/skeletons";
import { cn } from "@/lib/utils";

interface IReleaseOrderProduct {
  product: string;
  qty: number;
  lotSerial: string;
}

interface ReleaseRequest {
  _id: string;
  poNo: string;
  date: string;
  warehouse: any;
  requestedBy: any;
  customer: any;
  contact: string;
  releaseOrderProducts: IReleaseOrderProduct[];
  carrier: string;
  requestedPickupTime?: string;
  scheduledPickupDate?: string;
  scheduledPickupTime?: string;
  instructions?: string;
  createdBy: string;
  createdAt: string;
}

// Self-contained product combobox — each row has its own state
function ProductCombobox({ products, value, onChange }: { products: any[]; value: string; onChange: (val: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedProduct = products.find(p => p._id === value);
  const filtered = search
    ? products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : products;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-8 px-2 font-normal text-left"
        >
          <span className="truncate">
            {selectedProduct?.name || <span className="text-muted-foreground">Select product...</span>}
          </span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search products..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No products found.</CommandEmpty>
            <CommandGroup>
              {filtered.map((p) => (
                <CommandItem
                  key={p._id}
                  value={p._id}
                  onSelect={() => {
                    onChange(p._id);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      value === p._id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate">{p.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function ReleaseRequestsPage() {
  const [data, setData] = useState<ReleaseRequest[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [carriers, setCarriers] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [formDataLoading, setFormDataLoading] = useState(false);
  const [formDataLoaded, setFormDataLoaded] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ReleaseRequest | null>(null);
  
  // Search & filter states
  const [globalSearch, setGlobalSearch] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState<string>("all");
  
  // Search states for dropdowns
  const [carrierSearch, setCarrierSearch] = useState("");
  const [carrierPopoverOpen, setCarrierPopoverOpen] = useState(false);

  const defaultFormData: Partial<ReleaseRequest> = {
    poNo: "",
    date: new Date().toISOString().split('T')[0],
    warehouse: "",
    requestedBy: "",
    customer: "",
    contact: "",
    releaseOrderProducts: [
      { product: "", qty: 0, lotSerial: "" },
      { product: "", qty: 0, lotSerial: "" },
      { product: "", qty: 0, lotSerial: "" }
    ],
    carrier: "",
    requestedPickupTime: "",
    scheduledPickupDate: "",
    scheduledPickupTime: "",
    instructions: ""
  };

  const [formData, setFormData] = useState<Partial<ReleaseRequest>>(defaultFormData);

  // Phase 1: Fetch only release requests (fast page load)
  const fetchReleaseRequests = async () => {
    try {
      const res = await fetch("/api/admin/release-requests");
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `HTTP ${res.status}`);
      }
      const items = await res.json();
      setData(items);
    } catch (error: any) {
      console.error("Failed to fetch release requests:", error);
      toast.error(`Failed to load release requests: ${error.message}`);
    }
  };

  // Phase 2: Lazy-load form dropdown data (only when dialog opens)
  const fetchFormData = async () => {
    if (formDataLoaded) return; // Already loaded, skip
    setFormDataLoading(true);
    try {
      const [productsRes, warehousesRes, customersRes, usersRes, carriersRes] = await Promise.all([
        fetch("/api/admin/products"),
        fetch("/api/admin/warehouse"),
        fetch("/api/admin/customers"),
        fetch("/api/admin/users"),
        fetch("/api/admin/carriers"),
      ]);

      if (productsRes.ok) setProducts((await productsRes.json()).sort((a: any, b: any) => (a.name || "").localeCompare(b.name || "")));
      if (warehousesRes.ok) setWarehouses((await warehousesRes.json()).sort((a: any, b: any) => (a.name || "").localeCompare(b.name || "")));
      if (customersRes.ok) setCustomers(await customersRes.json());
      if (usersRes.ok) setUsers(await usersRes.json());
      if (carriersRes.ok) setCarriers(await carriersRes.json());
      setFormDataLoaded(true);
    } catch (error) {
      toast.error("Failed to load form data");
    } finally {
      setFormDataLoading(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchReleaseRequests();
      setLoading(false);
    };
    load();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingItem
        ? `/api/admin/release-requests/${editingItem._id}`
        : "/api/admin/release-requests";
      const method = editingItem ? "PUT" : "POST";

      const payload = {
        ...formData,
        // Filter out empty rows if needed, or keep them to let backend handle validation
        releaseOrderProducts: formData.releaseOrderProducts?.filter(p => p.product && p.product !== "")
      };

      if (!payload.releaseOrderProducts || payload.releaseOrderProducts.length === 0) {
        toast.error("Please add at least one product");
        return;
      }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Failed to save");

      toast.success(editingItem ? "Update successful" : "Creation successful");
      setIsDialogOpen(false);
      fetchReleaseRequests();
    } catch (error) {
      toast.error("An error occurred while saving");
      console.error(error);
    }
  };

  const handleDelete = (id: string) => {
    toast.warning("Are you sure you want to delete this release request?", {
      description: "This action cannot be undone.",
      action: {
        label: "Delete",
        onClick: async () => {
          try {
            const response = await fetch(`/api/admin/release-requests/${id}`, {
              method: "DELETE",
            });
            if (!response.ok) throw new Error("Failed to delete");
            toast.success("Deleted successfully");
            fetchReleaseRequests();
          } catch (error) {
            toast.error("Failed to delete item");
          }
        },
      },
      cancel: {
        label: "Cancel",
        onClick: () => {},
      },
    });
  };

  const openAddDialog = () => {
    setEditingItem(null);
    setFormData(defaultFormData);
    setIsDialogOpen(true);
    fetchFormData();
  };

  const openEditDialog = (item: ReleaseRequest) => {
    setEditingItem(item);
    setFormData({
      ...item,
      warehouse: item.warehouse?._id || item.warehouse,
      requestedBy: item.requestedBy?._id || item.requestedBy,
      customer: item.customer?._id || item.customer,
      date: item.date ? new Date(item.date).toISOString().split('T')[0] : "",
      scheduledPickupDate: item.scheduledPickupDate ? new Date(item.scheduledPickupDate).toISOString().split('T')[0] : "",
      releaseOrderProducts: item.releaseOrderProducts.length > 0
        ? item.releaseOrderProducts.map(p => ({
            product: typeof p.product === 'object' ? (p.product as any)?._id || '' : p.product,
            qty: p.qty,
            lotSerial: p.lotSerial,
          }))
        : defaultFormData.releaseOrderProducts
    });
    setIsDialogOpen(true);
    fetchFormData();
  };

  // Helper for Product Rows
  const updateProductRow = (index: number, field: keyof IReleaseOrderProduct, value: any) => {
    const newRows = [...(formData.releaseOrderProducts || [])];
    newRows[index] = { ...newRows[index], [field]: value };
    setFormData({ ...formData, releaseOrderProducts: newRows });
  };

  const addProductRow = () => {
    setFormData({
      ...formData,
      releaseOrderProducts: [...(formData.releaseOrderProducts || []), { product: "", qty: 0, lotSerial: "" }]
    });
  };

  const removeProductRow = (index: number) => {
    const newRows = [...(formData.releaseOrderProducts || [])];
    if (newRows.length > 1) {
        newRows.splice(index, 1);
        setFormData({ ...formData, releaseOrderProducts: newRows });
    }
  };

  // Get selected Customer object to show locations
  const selectedCustomer = customers.find(c => c._id === formData.customer);

  // Derive unique warehouses from loaded data for filter
  const warehouseList = useMemo(() => {
    const map = new Map<string, string>();
    data.forEach(d => {
      if (d.warehouse?._id && d.warehouse?.name) {
        map.set(d.warehouse._id, d.warehouse.name);
      }
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [data]);

  // Filter data by warehouse
  const filteredData = useMemo(() => {
    if (warehouseFilter === "all") return data;
    return data.filter(d => d.warehouse?._id === warehouseFilter);
  }, [data, warehouseFilter]);

  // Custom global filter that searches across key fields
  const globalFilterFn = useCallback((row: any, _columnId: string, filterValue: string) => {
    const search = filterValue.toLowerCase();
    const d = row.original as ReleaseRequest;
    return [
      d.poNo,
      d.customer?.name,
      d.warehouse?.name,
      d.carrier,
      d.createdBy,
      d.contact,
      d.date ? format(new Date(d.date), "MMM dd, yyyy") : "",
    ].some(val => val?.toLowerCase().includes(search));
  }, []);

  // Header extra: warehouse filter dropdown
  const headerExtra = (
    <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
      <SelectTrigger className="h-8 w-[180px] text-xs">
        <SelectValue placeholder="All Warehouses" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Warehouses</SelectItem>
        {warehouseList.map(([id, name]) => (
          <SelectItem key={id} value={id}>{name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const columns: ColumnDef<ReleaseRequest>[] = [
    {
      accessorKey: "poNo",
      header: "PO No",
    },
    {
      accessorKey: "customer",
      header: "Customer",
      cell: ({ row }) => row.original.customer?.name || "-",
    },
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ row }) => row.original.date ? format(new Date(row.original.date), "MMM dd, yyyy") : "-",
    },
    {
      accessorKey: "warehouse.name",
      header: "Warehouse",
      cell: ({ row }) => row.original.warehouse?.name || "-",
    },
    {
        accessorKey: "products",
        header: "Items",
        cell: ({ row }) => row.original.releaseOrderProducts?.length || 0,
    },
    {
      accessorKey: "createdBy",
      header: "Created By",
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
              onClick={() => openEditDialog(item)}
              className="h-8 w-8 p-0"
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDelete(item._id)}
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

  if (loading) {
    return <TablePageSkeleton />;
  }

  return (
    <div className="w-full h-full overflow-hidden">
      <SimpleDataTable
        columns={columns}
        data={filteredData}
        onAdd={openAddDialog}
        title="Release Requests"
        showColumnToggle={false}
        globalFilter={globalSearch}
        onGlobalFilterChange={setGlobalSearch}
        globalFilterFn={globalFilterFn}
        headerExtra={headerExtra}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Release Request" : "Add Release Request"}</DialogTitle>
            <DialogDescription>
                Fill in the details below to create or update a release request.
            </DialogDescription>
          </DialogHeader>
          
          {formDataLoading && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mr-3" />
              Loading form data...
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-8 py-4">
            
            {/* SECTION 1: General Info */}
            <div className="space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2"><Hash className="w-4 h-4"/> General Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     {/* Row 1: Date, Warehouse, Requested By */}
                    <div className="space-y-2">
                        <Label>Date</Label>
                        <Input 
                            type="date" 
                            value={formData.date || ""}
                            onChange={(e) => setFormData({...formData, date: e.target.value})}
                            required
                        />
                    </div>
                    
                    <div className="space-y-2">
                        <Label>Warehouse</Label>
                            <Select 
                            value={formData.warehouse} 
                            onValueChange={(val) => setFormData({ ...formData, warehouse: val })}
                            required
                            >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select Warehouse" />
                            </SelectTrigger>
                            <SelectContent>
                                {warehouses.map((w) => (
                                    <SelectItem key={w._id} value={w._id}>{w.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Requested By</Label>
                            <Select 
                            value={formData.requestedBy} 
                            onValueChange={(val) => setFormData({ ...formData, requestedBy: val })}
                            >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select User" />
                            </SelectTrigger>
                            <SelectContent>
                                {users.map((u) => (
                                    <SelectItem key={u._id} value={u._id}>{u.name || u.email}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Row 2: Customer, Contact/Location, Customer PO # */}
                    <div className="space-y-2">
                        <Label>Customer</Label>
                            <Select 
                            value={formData.customer} 
                            onValueChange={(val) => setFormData({ ...formData, customer: val, contact: "" })}
                            required
                            >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select Customer" />
                            </SelectTrigger>
                            <SelectContent>
                                {customers.map((c) => (
                                    <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Contact / Location</Label>
                        <Select 
                            value={formData.contact} 
                            onValueChange={(val) => setFormData({ ...formData, contact: val })}
                            disabled={!selectedCustomer}
                            >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select Location" />
                            </SelectTrigger>
                            <SelectContent>
                                {selectedCustomer?.location?.map((loc: any, i: number) => (
                                    <SelectItem key={i} value={loc.locationName || `Loc ${i+1}`}>
                                        {loc.locationName || loc.fullAddress || "Unknown Location"}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Customer PO #</Label>
                        <Input 
                                value={formData.poNo || ""}
                                onChange={(e) => setFormData({...formData, poNo: e.target.value})}
                                placeholder="Enter PO Number"
                                required
                        />
                    </div>
                </div>
            </div>

            {/* SECTION 2: Products */}
            <div className="space-y-4">
                 <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg flex items-center gap-2"><Trash className="w-4 h-4"/> Order Details</h3>
                    <Button type="button" size="sm" variant="outline" onClick={addProductRow}>
                        <Plus className="w-4 h-4 mr-2" /> Add Product
                    </Button>
                 </div>
                 
                 <div className="border rounded-md overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="p-3 text-left w-[40%]">Product</th>
                                <th className="p-3 text-left w-[20%]">Release Qty</th>
                                <th className="p-3 text-left w-[30%]">Lot / Serial #</th>
                                <th className="p-3 w-[10%]"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {formData.releaseOrderProducts?.map((row, idx) => (
                                <tr key={idx} className="bg-background">
                                    <td className="p-2">
                                         <ProductCombobox
                                           products={products}
                                           value={row.product}
                                           onChange={(val) => updateProductRow(idx, 'product', val)}
                                         />
                                    </td>
                                    <td className="p-2">
                                        <Input 
                                            type="number" 
                                            value={row.qty}
                                            onChange={(e) => updateProductRow(idx, 'qty', Number(e.target.value))}
                                            className="h-8 shadow-none"
                                        />
                                    </td>
                                    <td className="p-2">
                                        <Input 
                                            value={row.lotSerial}
                                            onChange={(e) => updateProductRow(idx, 'lotSerial', e.target.value)}
                                            className="h-8 shadow-none"
                                        />
                                    </td>
                                    <td className="p-2 text-center">
                                        <Button 
                                            type="button" 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500"
                                            onClick={() => removeProductRow(idx)}
                                        >
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                 </div>
            </div>

            {/* SECTION 3: Pickup Details */}
            <div className="space-y-4">
                 <h3 className="font-semibold text-lg flex items-center gap-2"><Truck className="w-4 h-4"/> Pickup Information</h3>
                 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="space-y-2">
                         <Label>Carrier</Label>
                         <Popover open={carrierPopoverOpen} onOpenChange={setCarrierPopoverOpen}>
                           <PopoverTrigger asChild>
                             <Button
                               variant="outline"
                               role="combobox"
                               aria-expanded={carrierPopoverOpen}
                               className="w-full justify-between font-normal"
                             >
                               {formData.carrier || "Select Carrier..."}
                               <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                             </Button>
                           </PopoverTrigger>
                           <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                             <Command shouldFilter={false}>
                               <CommandInput
                                 placeholder="Search carriers..."
                                 value={carrierSearch}
                                 onValueChange={setCarrierSearch}
                               />
                               <CommandList>
                                 <CommandEmpty className="p-0" />
                                 <CommandGroup>
                                   {carriers
                                     .filter(c => c.name.toLowerCase().includes(carrierSearch.toLowerCase()))
                                     .map((c) => (
                                       <CommandItem
                                         key={c._id}
                                         value={c.name}
                                         onSelect={() => {
                                           setFormData({ ...formData, carrier: c.name });
                                           setCarrierPopoverOpen(false);
                                           setCarrierSearch("");
                                         }}
                                       >
                                         <Check
                                           className={cn(
                                             "mr-2 h-4 w-4",
                                             formData.carrier === c.name ? "opacity-100" : "opacity-0"
                                           )}
                                         />
                                         {c.name}
                                       </CommandItem>
                                     ))}
                                 </CommandGroup>
                                 {carrierSearch.trim() && !carriers.some(c => c.name.toLowerCase() === carrierSearch.trim().toLowerCase()) && (
                                   <>
                                     <CommandSeparator />
                                     <CommandGroup>
                                       <CommandItem
                                         onSelect={async () => {
                                           try {
                                             const res = await fetch("/api/admin/carriers", {
                                               method: "POST",
                                               headers: { "Content-Type": "application/json" },
                                               body: JSON.stringify({ name: carrierSearch.trim() }),
                                             });
                                             if (!res.ok) throw new Error("Failed to create carrier");
                                             const newCarrier = await res.json();
                                             setCarriers(prev => [...prev, newCarrier].sort((a, b) => a.name.localeCompare(b.name)));
                                             setFormData({ ...formData, carrier: newCarrier.name });
                                             setCarrierPopoverOpen(false);
                                             setCarrierSearch("");
                                             toast.success(`Carrier "${newCarrier.name}" added`);
                                           } catch {
                                             toast.error("Failed to add carrier");
                                           }
                                         }}
                                         className="text-primary"
                                       >
                                         <Plus className="mr-2 h-4 w-4" />
                                         Add &quot;{carrierSearch.trim()}&quot;
                                       </CommandItem>
                                     </CommandGroup>
                                   </>
                                 )}
                               </CommandList>
                             </Command>
                           </PopoverContent>
                         </Popover>
                      </div>
                      <div className="space-y-2">
                         <Label>Requested Date/Time</Label>
                         <Input 
                            type="datetime-local" 
                            value={formData.requestedPickupTime ? new Date(formData.requestedPickupTime).toISOString().slice(0, 16) : ""}
                            onChange={(e) => setFormData({...formData, requestedPickupTime: e.target.value})}
                         />
                      </div>
                       <div className="space-y-2">
                         <Label>Confirmed Date</Label>
                         <Input 
                            type="date"
                            value={formData.scheduledPickupDate || ""}
                            onChange={(e) => setFormData({...formData, scheduledPickupDate: e.target.value})}
                         />
                      </div>
                       <div className="space-y-2">
                         <Label>Confirmed Time</Label>
                         <Input 
                            type="time"
                            value={formData.scheduledPickupTime || ""}
                            onChange={(e) => setFormData({...formData, scheduledPickupTime: e.target.value})}
                         />
                      </div>
                 </div>
            </div>

             {/* SECTION 4: Instructions */}
            <div className="space-y-4">
                 <h3 className="font-semibold text-lg flex items-center gap-2"><MapPin className="w-4 h-4"/> Instructions</h3>
                 <Textarea 
                    value={formData.instructions || ""}
                    onChange={(e) => setFormData({...formData, instructions: e.target.value})}
                    placeholder="Additional delivery or handling instructions..."
                    className="min-h-[100px]"
                 />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
                 <Button variant="outline" type="button" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                 <Button type="submit" size="lg" className="min-w-[150px]">
                    {editingItem ? "Update Request" : "Create Request"}
                 </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
