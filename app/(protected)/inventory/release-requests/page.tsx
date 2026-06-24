"use client";

import { useEffect, useState, useMemo, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { SimpleDataTable } from "@/components/admin/simple-data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { Pencil, Trash, Plus, X, Hash, Truck, MapPin, ChevronsUpDown, Check, Eye, CheckCircle, Circle } from "lucide-react";
import { format } from "date-fns";
import { useProducts } from "@/hooks/queries/useProducts";
import { useWarehouses } from "@/hooks/queries/useWarehouses";
import { useCustomers } from "@/hooks/queries/useCustomers";
import { useUsers } from "@/hooks/queries/useUsers";
import { useCarriers } from "@/hooks/queries/useCarriers";
import { useCustomerPOs } from "@/hooks/queries/useCustomerPOs";
import { useQueryClient } from "@tanstack/react-query";
import { TablePageSkeleton } from "@/components/skeletons";
import { cn } from "@/lib/utils";

interface IReleaseOrderProduct {
  product: string;
  qty: number;
  lotSerial: string;
}

interface ReleaseRequest {
  _id: string;
  poNo: any;
  transferOrder: any;
  date: string;
  warehouse: any;
  requestedBy: any;
  customer: any;
  contact: string;
  releaseOrderProducts: IReleaseOrderProduct[];
  hasPickupInfo?: boolean;
  pickedUp?: boolean;
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
          <CommandList 
            className="pointer-events-auto"
            onWheel={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
          >
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

const RELEASE_REQUEST_FILTER_DEFAULTS = { search: "", warehouse: "all", pickedUp: "all" };

export default function ReleaseRequestsPage() {
  return (
    <Suspense>
      <ReleaseRequestsContent />
    </Suspense>
  );
}

function ReleaseRequestsContent() {
  const router = useRouter();
  const { filters, inputs, setFilter } = useUrlFilters(RELEASE_REQUEST_FILTER_DEFAULTS, ["search", "warehouse", "pickedUp"], 300);
  const { data: products = [] } = useProducts();
  const { data: warehouses = [] } = useWarehouses();
  const { data: customers = [] } = useCustomers();
  const { data: users = [] } = useUsers();
  const { data: carriers = [] } = useCarriers();
  const { data: customerPOs = [] } = useCustomerPOs();
  const queryClient = useQueryClient();

  // Transfer orders — for Shipment # picker (deduplicated by vbShipmentNumber)
  const [uniqueShipments, setUniqueShipments] = useState<any[]>([]);
  useEffect(() => {
    fetch('/api/admin/transfer-orders')
      .then(r => r.json())
      .then(d => {
        if (!Array.isArray(d)) return;
        // Deduplicate by vbShipmentNumber ObjectId
        const seen = new Map<string, any>();
        for (const to of d) {
          const ship = to.vbShipmentNumber;
          if (!ship) continue;
          const shipId = typeof ship === 'object' ? ship._id : ship;
          if (shipId && !seen.has(String(shipId))) {
            seen.set(String(shipId), {
              shipId: String(shipId),
              label: typeof ship === 'object' ? (ship.VBShipmentNumber || ship.svbid || String(shipId)) : String(shipId),
            });
          }
        }
        setUniqueShipments(Array.from(seen.values()));
      })
      .catch(() => {});
  }, []);

  // Inventory data — for warehouse-based product filtering
  const [inventoryData, setInventoryData] = useState<any[]>([]);
  const fetchInventoryData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/inventory-management');
      const d = await res.json();
      if (Array.isArray(d)) setInventoryData(d);
    } catch {}
  }, []);
  useEffect(() => { fetchInventoryData(); }, [fetchInventoryData]);

  // Release requests — own fetch
  const [rawData, setRawData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const fetchReleaseRequests = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/release-requests');
      const d = await res.json();
      if (Array.isArray(d)) setRawData(d);
    } catch {} finally { setIsLoading(false); }
  }, []);
  useEffect(() => { fetchReleaseRequests(); }, [fetchReleaseRequests]);
  const refetchReleaseRequests = fetchReleaseRequests;
  const refetchCarriers = () => queryClient.invalidateQueries({ queryKey: ["carriers"] });

  const data = useMemo(() => {
    return [...rawData].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [rawData]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ReleaseRequest | null>(null);

  // Handle ?edit=<id> query param (from detail page Edit button)
  const searchParams = useSearchParams();
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId && data.length > 0) {
      const item = data.find((r: any) => r._id === editId);
      if (item) {
        openEditDialog(item);
        // Clean up URL
        router.replace('/inventory/release-requests', { scroll: false });
      }
    }
    const addParam = searchParams.get('add');
    if (addParam === 'true') {
      openAddDialog();
      router.replace('/inventory/release-requests', { scroll: false });
    }
  }, [searchParams, data]);
  
  // Search states for dropdowns
  const [carrierSearch, setCarrierSearch] = useState("");
  const [carrierPopoverOpen, setCarrierPopoverOpen] = useState(false);
  const [cpoSearch, setCpoSearch] = useState("");
  const [cpoPopoverOpen, setCpoPopoverOpen] = useState(false);
  const [toSearch, setToSearch] = useState("");
  const [toPopoverOpen, setToPopoverOpen] = useState(false);

  const defaultFormData: Partial<ReleaseRequest> = {
    poNo: "",
    transferOrder: "",
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
    hasPickupInfo: false,
    carrier: "",
    requestedPickupTime: "",
    scheduledPickupDate: "",
    scheduledPickupTime: "",
    instructions: ""
  };

  const [formData, setFormData] = useState<Partial<ReleaseRequest>>(defaultFormData);



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
      refetchReleaseRequests();
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
            refetchReleaseRequests();
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
  };

  const openEditDialog = (item: ReleaseRequest) => {
    setEditingItem(item);
    setFormData({
      ...item,
      poNo: typeof item.poNo === 'object' && item.poNo?._id ? item.poNo._id : (item.poNo || ""),
      transferOrder: typeof item.transferOrder === 'object' && item.transferOrder?._id ? item.transferOrder._id : (item.transferOrder || ""),
      warehouse: item.warehouse?._id || item.warehouse,
      requestedBy: item.requestedBy?._id || item.requestedBy,
      customer: item.customer?._id || item.customer,
      date: item.date ? new Date(item.date).toISOString().split('T')[0] : "",
      hasPickupInfo: item.hasPickupInfo || false,
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

  // Products filtered by warehouse from inventory data (only products with available qty > 0)
  const warehouseFilteredProducts = useMemo(() => {
    if (!formData.warehouse) return products; // No warehouse selected → show all products
    const warehouseId = formData.warehouse;
    const productIdsInWarehouse = new Set<string>();
    for (const row of inventoryData) {
      const rowWarehouse = row.warehouse?._id ? String(row.warehouse._id) : String(row.warehouse || '');
      if (rowWarehouse === warehouseId && (row.availableQty || 0) > 0) {
        const prodId = row.product?._id ? String(row.product._id) : String(row.product || '');
        if (prodId) productIdsInWarehouse.add(prodId);
      }
    }
    if (productIdsInWarehouse.size === 0) return products; // Fallback: if no inventory data, show all
    return products.filter((p: any) => productIdsInWarehouse.has(p._id));
  }, [formData.warehouse, inventoryData, products]);

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

  // Filter data by warehouse + pickedUp
  const filteredData = useMemo(() => {
    let result = data;
    if (filters.warehouse !== "all") {
      result = result.filter(d => d.warehouse?._id === filters.warehouse);
    }
    if (filters.pickedUp === "yes") {
      result = result.filter(d => !!d.pickedUp);
    } else if (filters.pickedUp === "no") {
      result = result.filter(d => !d.pickedUp);
    }
    return result;
  }, [data, filters.warehouse, filters.pickedUp]);

  // Custom global filter that searches across key fields
  const globalFilterFn = useCallback((row: any, _columnId: string, filterValue: string) => {
    const search = filterValue.toLowerCase();
    const d = row.original as ReleaseRequest;
    const poLabel = typeof d.poNo === 'object' && d.poNo ? ((d.poNo as any).customerPONo || (d.poNo as any).VBSerialNumber || '') : (d.poNo || '');
    return [
      poLabel,
      d.customer?.name,
      d.warehouse?.name,
      d.carrier,
      d.createdBy,
      d.contact,
      d.date ? format(new Date(d.date), "MMM dd, yyyy") : "",
    ].some(val => val?.toLowerCase().includes(search));
  }, []);

  // Header extra: warehouse + picked-up filter dropdowns
  const headerExtra = (
    <div className="flex items-center gap-2">
      <Select value={filters.warehouse} onValueChange={(v) => setFilter("warehouse", v)}>
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

      <Select value={filters.pickedUp} onValueChange={(v) => setFilter("pickedUp", v)}>
        <SelectTrigger className={cn(
          "h-8 w-[150px] text-xs transition-colors",
          filters.pickedUp === "yes" && "border-emerald-500/50 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400",
          filters.pickedUp === "no"  && "border-amber-500/50 bg-amber-500/5 text-amber-700 dark:text-amber-400",
        )}>
          <SelectValue placeholder="Picked Up" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="yes">Picked Up</SelectItem>
          <SelectItem value="no">Waiting</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  const columns: ColumnDef<ReleaseRequest>[] = [
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ row }) => row.original.date ? format(new Date(row.original.date), "MMM dd, yyyy") : "-",
    },
    {
      id: "shipment",
      header: "Shipment #",
      accessorFn: (row) => {
        const to = row.transferOrder;
        if (!to) return "-";
        // transferOrder is now populated directly from VBshipping
        if (typeof to === 'object') return to.VBShipmentNumber || to.svbid || "-";
        return "-";
      },
      cell: ({ row }) => {
        const to = row.original.transferOrder;
        if (!to) return "-";
        if (typeof to === 'object') {
          return <span className="font-mono font-semibold text-primary">{to.VBShipmentNumber || to.svbid || "-"}</span>;
        }
        return "-";
      },
    },
    {
      accessorKey: "poNo",
      header: "Customer PO #",
      cell: ({ row }) => {
        const po = row.original.poNo;
        if (typeof po === 'object' && po) return po.customerPONo || po.VBSerialNumber || '-';
        return po || '-';
      },
    },
    {
      accessorKey: "customer",
      header: "Customer",
      cell: ({ row }) => row.original.customer?.name || "-",
    },
    {
      accessorKey: "warehouse.name",
      header: "Warehouse",
      cell: ({ row }) => row.original.warehouse?.name || "-",
    },
    {
        id: "productsList",
        header: "Products",
        cell: ({ row }) => {
          const items = row.original.releaseOrderProducts;
          if (!items || items.length === 0) return <span className="text-muted-foreground">-</span>;
          return (
            <div className="flex flex-col divide-y divide-border">
              {items.map((item, i) => {
                const name = typeof item.product === 'object' && item.product
                  ? (item.product as any).name || (item.product as any).vbId || '-'
                  : '-';
                return <span key={i} className="text-xs leading-snug truncate max-w-[220px] py-1">{name}</span>;
              })}
            </div>
          );
        },
    },
    {
        id: "productQty",
        header: "Qty",
        cell: ({ row }) => {
          const items = row.original.releaseOrderProducts;
          if (!items || items.length === 0) return <span className="text-muted-foreground">-</span>;
          return (
            <div className="flex flex-col divide-y divide-border">
              {items.map((item, i) => (
                <span key={i} className="text-xs leading-snug font-mono py-1">{item.qty}</span>
              ))}
            </div>
          );
        },
    },
    {
      accessorKey: "createdBy",
      header: "Created By",
    },
    {
      id: "pickedUp",
      header: "Picked Up",
      cell: ({ row }) => {
        const item = row.original;
        const picked = !!item.pickedUp;
        const toggle = async (e: React.MouseEvent) => {
          e.stopPropagation();
          const next = !picked;
          try {
            const res = await fetch(`/api/admin/release-requests/${item._id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ pickedUp: next }),
            });
            if (!res.ok) throw new Error();
            // Optimistically update local list
            setRawData(prev =>
              prev.map(r => r._id === item._id ? { ...r, pickedUp: next } : r)
            );
            toast.success(next ? 'Marked as Picked Up' : 'Marked as Not Picked Up');
          } catch {
            toast.error('Failed to update');
          }
        };
        return (
          <button
            onClick={toggle}
            title={picked ? 'Mark as not picked up' : 'Mark as picked up'}
            className={cn(
              'inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border transition-all duration-200',
              picked
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/20'
                : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
            )}
          >
            {picked
              ? <CheckCircle className="h-3 w-3" />
              : <Circle className="h-3 w-3" />}
            {picked ? 'Yes' : 'No'}
          </button>
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
              onClick={(e) => { e.stopPropagation(); router.push(`/inventory/release-requests/${item._id}`); }}
              className="h-8 w-8 p-0"
              title="View Details"
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => { e.stopPropagation(); openEditDialog(item); }}
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
        data={filteredData}
        onAdd={openAddDialog}
        onRowClick={(item) => router.push(`/inventory/release-requests/${item._id}`)}
        title="Release Requests"
        showColumnToggle={false}
        globalFilter={inputs.search}
        onGlobalFilterChange={(v: string) => setFilter("search", v)}
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
                        <Label>Shipment #</Label>
                        <Popover open={toPopoverOpen} onOpenChange={setToPopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={toPopoverOpen}
                              className="w-full justify-between font-normal"
                            >
                              <span className="truncate">
                                {formData.transferOrder
                                  ? (uniqueShipments.find((s: any) => s.shipId === formData.transferOrder)?.label || 'Selected')
                                  : 'Select Shipment...'}
                              </span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                            <Command shouldFilter={false}>
                              <CommandInput
                                placeholder="Search shipments..."
                                value={toSearch}
                                onValueChange={setToSearch}
                              />
                              <CommandList
                                className="pointer-events-auto"
                                onWheel={(e) => e.stopPropagation()}
                                onTouchMove={(e) => e.stopPropagation()}
                              >
                                <CommandEmpty>No shipments found.</CommandEmpty>
                                <CommandGroup>
                                  {uniqueShipments
                                    .filter((s: any) => {
                                      if (!toSearch) return true;
                                      return s.label.toLowerCase().includes(toSearch.toLowerCase());
                                    })
                                    .slice(0, 50)
                                    .map((s: any) => (
                                      <CommandItem
                                        key={s.shipId}
                                        value={s.shipId}
                                        onSelect={async () => {
                                          setToPopoverOpen(false);
                                          setToSearch('');

                                          // 1. Auto-populate warehouse, customer, contact from shipment details
                                          let autoWarehouse = '';
                                          let autoCustomer = '';
                                          let autoContact = '';
                                          try {
                                            const detailRes = await fetch(`/api/admin/shipment-details?shipmentId=${s.shipId}`);
                                            const detail = await detailRes.json();
                                            if (detailRes.ok) {
                                              autoWarehouse = detail.warehouse || '';
                                              autoCustomer = detail.customer || '';
                                              autoContact = detail.contactName || '';
                                            }
                                          } catch {}

                                          // 2. Auto-populate products from inventory management (available qty > 0)
                                          let autoProducts: IReleaseOrderProduct[] = [];
                                          try {
                                            const matching = inventoryData.filter((row: any) => {
                                              const shipId = row.vbShipmentNumber?._id ? String(row.vbShipmentNumber._id) : String(row.vbShipmentNumber || '');
                                              return shipId === s.shipId && (row.availableQty || 0) > 0;
                                            });
                                            if (matching.length > 0) {
                                              autoProducts = matching.map((row: any) => ({
                                                product: row.product?._id ? String(row.product._id) : String(row.product || ''),
                                                qty: row.availableQty || 0,
                                                lotSerial: row.serialNumber || '',
                                              }));
                                              // Use warehouse from inventory if shipment-details didn't return one
                                              if (!autoWarehouse) {
                                                autoWarehouse = matching[0].warehouse?._id ? String(matching[0].warehouse._id) : String(matching[0].warehouse || '');
                                              }
                                            }
                                          } catch {}

                                          setFormData(prev => ({
                                            ...prev,
                                            transferOrder: s.shipId,
                                            warehouse: autoWarehouse || prev.warehouse,
                                            customer: autoCustomer || prev.customer,
                                            contact: autoContact || prev.contact,
                                            releaseOrderProducts: autoProducts.length > 0 ? autoProducts : prev.releaseOrderProducts,
                                          }));
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            formData.transferOrder === s.shipId ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                        <span className="font-mono">{s.label}</span>
                                      </CommandItem>
                                    ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
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
                            value={
                              selectedCustomer?.location?.find((loc: any) => 
                                (loc.locationName || loc.fullAddress || '') === formData.contact
                              )?._id || formData.contact || ""
                            }
                            onValueChange={(val) => {
                              const loc = selectedCustomer?.location?.find((l: any) => l._id === val);
                              setFormData({ ...formData, contact: loc?.locationName || loc?.fullAddress || val });
                            }}
                            disabled={!selectedCustomer}
                            >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select Location" />
                            </SelectTrigger>
                            <SelectContent>
                                {selectedCustomer?.location?.map((loc: any, i: number) => (
                                    <SelectItem key={`loc-${i}`} value={loc._id || `loc-${i}`}>
                                        {loc.locationName || loc.fullAddress || `Location ${i + 1}`}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Customer PO #</Label>
                        <Popover open={cpoPopoverOpen} onOpenChange={setCpoPopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={cpoPopoverOpen}
                              className="w-full justify-between font-normal"
                            >
                              <span className="truncate">
                                {formData.poNo
                                  ? (customerPOs.find((c: any) => c._id === formData.poNo)?.customerPONo ||
                                     customerPOs.find((c: any) => c._id === formData.poNo)?.VBSerialNumber ||
                                     String(formData.poNo))
                                  : 'Select or type Customer PO...'}
                              </span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                            <Command shouldFilter={false}>
                              <CommandInput
                                placeholder="Search or type PO #..."
                                value={cpoSearch}
                                onValueChange={setCpoSearch}
                              />
                              <CommandList
                                className="pointer-events-auto"
                                onWheel={(e) => e.stopPropagation()}
                                onTouchMove={(e) => e.stopPropagation()}
                              >
                                {/* Allow using the typed text as a custom value */}
                                {cpoSearch && !customerPOs.find((c: any) =>
                                  (c.customerPONo || '').toLowerCase() === cpoSearch.toLowerCase() ||
                                  (c.VBSerialNumber || '').toLowerCase() === cpoSearch.toLowerCase()
                                ) && (
                                  <CommandItem
                                    value={`custom:${cpoSearch}`}
                                    onSelect={() => {
                                      setFormData({ ...formData, poNo: cpoSearch });
                                      setCpoPopoverOpen(false);
                                      setCpoSearch('');
                                    }}
                                  >
                                    <span className="text-muted-foreground mr-2">Use:</span>
                                    <span className="font-semibold">&quot;{cpoSearch}&quot;</span>
                                  </CommandItem>
                                )}
                                <CommandGroup heading="From Customer POs">
                                  {customerPOs
                                    .filter((c: any) => {
                                      if (!cpoSearch) return true;
                                      const q = cpoSearch.toLowerCase();
                                      return (c.customerPONo || '').toLowerCase().includes(q) ||
                                             (c.VBSerialNumber || '').toLowerCase().includes(q);
                                    })
                                    .slice(0, 50)
                                    .map((c: any) => (
                                      <CommandItem
                                        key={c._id}
                                        value={c._id}
                                        onSelect={() => {
                                          setFormData({ ...formData, poNo: c._id });
                                          setCpoPopoverOpen(false);
                                          setCpoSearch('');
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            formData.poNo === c._id ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                        <span>{c.customerPONo || c.VBSerialNumber || c._id}</span>
                                      </CommandItem>
                                    ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
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
                                           products={warehouseFilteredProducts}
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

            {/* SECTION 3: Pickup & Instructions Toggle */}
            <div className="space-y-4">
                 <div className="flex items-center justify-between">
                   <h3 className="font-semibold text-lg flex items-center gap-2"><Truck className="w-4 h-4"/> Pickup Information</h3>
                   <div className="flex items-center gap-2">
                     <Label htmlFor="pickup-toggle" className="text-sm text-muted-foreground">Include Pickup & Instructions</Label>
                     <Switch
                       id="pickup-toggle"
                       checked={formData.hasPickupInfo || false}
                       onCheckedChange={(checked) => setFormData({...formData, hasPickupInfo: checked})}
                     />
                   </div>
                 </div>

                 {formData.hasPickupInfo && (
                 <div className="border rounded-lg p-4 space-y-6 bg-muted/20">
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
                               <CommandList
                                 className="pointer-events-auto"
                                 onWheel={(e) => e.stopPropagation()}
                                 onTouchMove={(e) => e.stopPropagation()}
                               >
                                 <CommandEmpty className="p-0" />
                                 <CommandGroup>
                                   {carriers
                                     .filter(c => c.name.toLowerCase().includes(carrierSearch.toLowerCase()))
                                     .map((c) => (
                                       <CommandItem
                                         key={c._id}
                                         value={c._id}
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
                                             await refetchCarriers();
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

                 {/* Instructions (inside the same box) */}
                 <div className="space-y-3">
                   <h4 className="font-semibold text-base flex items-center gap-2"><MapPin className="w-4 h-4"/> Instructions</h4>
                   <Textarea 
                      value={formData.instructions || ""}
                      onChange={(e) => setFormData({...formData, instructions: e.target.value})}
                      placeholder="Additional delivery or handling instructions..."
                      className="min-h-[100px]"
                   />
                 </div>
                 </div>
                 )}
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
