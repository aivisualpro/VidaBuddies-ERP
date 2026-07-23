"use client";

import { useEffect, useState, useMemo, Suspense, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { SimpleDataTable } from "@/components/admin/simple-data-table";
import { toast } from "sonner";
import { ColumnDef } from "@tanstack/react-table";
import { Pencil, Trash2, MessageCircle, Paperclip, Clock, Package, Truck, X, Plus, Check, ChevronsUpDown } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { TablePageSkeleton } from "@/components/skeletons";
import { ViewToggle } from "@/components/admin/view-toggle";
import { RecordChatDrawer } from "@/components/chat/record-chat-drawer";
import { AddCustomerPODialog } from "@/components/admin/add-customer-po-dialog";
import { CPOGroupSidebar } from "@/components/admin/cpo-group-sidebar";
import { useCustomers } from "@/hooks/queries/useCustomers";
import { usePurchaseOrders } from "@/hooks/queries/usePurchaseOrders";
import { useProducts } from "@/hooks/queries/useProducts";
import { DriveDocumentsModal } from "@/components/drive-documents-modal";
import TimelineModal from "@/components/admin/timeline-modal";
import { useWarehouses } from "@/hooks/queries/useWarehouses";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

interface CustomerPO {
  _id: string;
  VBNumber?: string;
  VBSerialNumber?: string;
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
  products?: string[];
  createdAt?: string;
  updatedAt?: string;
  driveDocuments?: any[];
}

const CPO_FILTER_DEFAULTS = { search: "" };

export default function CustomerPOsListPage() {
  return (
    <Suspense>
      <CustomerPOsListContent />
    </Suspense>
  );
}

function CustomerPOsListContent() {
  const router = useRouter();
  const { filters, inputs, setFilter } = useUrlFilters(CPO_FILTER_DEFAULTS, ["search"], 300);
  const [data, setData] = useState<CustomerPO[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CustomerPO | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [sidebarVBNumber, setSidebarVBNumber] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState<{ refKind: "VBSerialNumber" | "VBNumber" | "VBShipmentNumber"; refId: string; display: string; parentRefId?: string } | null>(null);
  const [chatInfo, setChatInfo] = useState<Record<string, { unread: number; hasConversation: boolean }>>({});
  const [currentUserId, setCurrentUserId] = useState("");
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [attachmentsPoNumber, setAttachmentsPoNumber] = useState<{ poNumber: string; spoNumber?: string } | null>(null);
  const [timelineCounts, setTimelineCounts] = useState<Record<string, number>>({});
  const [timelineOpen, setTimelineOpen] = useState<{ VBNumber?: string; VBSerialNumber?: string; title?: string } | null>(null);
  const [productsModal, setProductsModal] = useState<{ cpo: CustomerPO } | null>(null);
  const [productPopoverOpen, setProductPopoverOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [savingProducts, setSavingProducts] = useState(false);

  const { data: storeCustomers = [] } = useCustomers();
  const { data: purchaseOrders = [] } = usePurchaseOrders();
  const customers = storeCustomers;

  // Resolve location ObjectId → display name
  const locationMap = useMemo(() => {
    const map: Record<string, string> = {};
    customers.forEach((cust: any) => {
      (cust.location || []).forEach((loc: any) => {
        if (loc._id) map[loc._id] = loc.locationName || loc.vbId || 'Unknown';
        if (loc.vbId) map[loc.vbId] = loc.locationName || loc.vbId;
      });
    });
    return map;
  }, [customers]);

  // Resolve VBNumber ObjectId → VidaPO display name (e.g. "VB300")
  const poDisplayMap = useMemo(() => {
    const map: Record<string, string> = {};
    (purchaseOrders || []).forEach((po: any) => {
      if (po._id && po.VBNumber) map[po._id] = po.VBNumber;
    });
    return map;
  }, [purchaseOrders]);

  // Resolve warehouse ObjectId → display name
  const { data: storeWarehouses = [] } = useWarehouses();
  const warehouseNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    (storeWarehouses || []).forEach((w: any) => { if (w._id) map[w._id] = w.name; });
    return map;
  }, [storeWarehouses]);

  // Products lookup
  const { data: allProducts = [] } = useProducts();
  const productNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    (allProducts || []).forEach((p: any) => { if (p._id) map[p._id] = p.name || p.vbId || p._id; });
    return map;
  }, [allProducts]);
  const filteredProductOptions = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    return (allProducts || []).filter((p: any) =>
      !q || (p.name || p.vbId || '').toLowerCase().includes(q)
    );
  }, [allProducts, productSearch]);

  // Save products list for a CPO
  const saveProducts = async (cpoId: string, products: string[]) => {
    setSavingProducts(true);
    try {
      const res = await fetch(`/api/admin/vb-customer-po/${cpoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products }),
      });
      if (!res.ok) throw new Error();
      // Update local state so counter refreshes instantly
      setData(prev => prev.map(c => c._id === cpoId ? { ...c, products } : c));
      if (productsModal?.cpo._id === cpoId) {
        setProductsModal(prev => prev ? { cpo: { ...prev.cpo, products } } : null);
      }
      toast.success('Products updated');
    } catch {
      toast.error('Failed to save products');
    } finally {
      setSavingProducts(false);
    }
  };

  const toggleProductInModal = async (productId: string) => {
    if (!productsModal) return;
    const current = productsModal.cpo.products || [];
    const next = current.includes(productId)
      ? current.filter(p => p !== productId)
      : [...current, productId];
    await saveProducts(productsModal.cpo._id, next);
  };

  const removeProductFromModal = async (productId: string) => {
    if (!productsModal) return;
    const next = (productsModal.cpo.products || []).filter(p => p !== productId);
    await saveProducts(productsModal.cpo._id, next);
  };

  const fetchData = async () => {
    try {
      const res = await fetch("/api/admin/vb-customer-po");
      const items = await res.json();
      setData(Array.isArray(items) ? items : []);
    } catch {
      toast.error("Failed to fetch Customer POs");
    } finally {
      setLoading(false);
    }
  };

  const fetchChatInfo = async (items?: CustomerPO[]) => {
    try {
      // Fetch conversations for VBSerialNumber (own ID) AND VBNumber (parent)
      const [serRes, vbRes] = await Promise.all([
        fetch("/api/admin/chat/unread-by-refs?kind=VBSerialNumber"),
        fetch("/api/admin/chat/unread-by-refs?kind=VBNumber"),
      ]);
      const serData = serRes.ok ? await serRes.json() : {};
      const vbData = vbRes.ok ? await vbRes.json() : {};

      console.log("[Chat] VBSerialNumber convs:", Object.keys(serData).length, serData);
      console.log("[Chat] VBNumber convs:", Object.keys(vbData).length, vbData);

      // Build a merged map keyed by CPO _id
      const merged: Record<string, { unread: number; hasConversation: boolean }> = {};
      const rows = items || data;

      for (const cpo of rows) {
        const cpoId = cpo._id;
        let unread = 0;
        let hasConv = false;

        // Check by own _id as VBSerialNumber ref
        if (serData[cpoId]) {
          unread += serData[cpoId].unread || 0;
          if (serData[cpoId].hasConversation) hasConv = true;
        }

        const parentId = cpo.VBNumber;
        if (parentId && vbData[parentId]) {
          unread += vbData[parentId].unread || 0;
          if (vbData[parentId].hasConversation) hasConv = true;
        }

        if (unread > 0 || hasConv) {
          merged[cpoId] = { unread, hasConversation: hasConv };
        }
      }
      console.log("[Chat] Merged CPO chat info:", Object.keys(merged).length, "rows with conversations");
      setChatInfo(merged);
    } catch {}
  };

  useEffect(() => {
    fetchData().then(() => {
      // Need data to be loaded first for vidaPOId mapping
    });
    fetch("/api/admin/chat")
      .then((r) => r.json())
      .then((d) => {
        setCurrentUserId(d.currentUser?.id || "");
        setAllUsers(d.users || []);
      })
      .catch(() => {});
    fetch("/api/admin/timeline")
      .then((r) => r.json())
      .then((items) => {
        if (Array.isArray(items)) {
          const counts: Record<string, number> = {};
          items.forEach((t: any) => {
            const serialKey = (t.VBSerialNumber || '')?.toString();
            const vbKey = (t.VBNumber || '')?.toString();
            if (serialKey) counts[serialKey] = (counts[serialKey] || 0) + 1;
            else if (vbKey) counts[vbKey] = (counts[vbKey] || 0) + 1;
          });
          setTimelineCounts(counts);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch chat info once data is loaded
  useEffect(() => {
    if (data.length > 0) fetchChatInfo(data);
  }, [data]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/vb-customer-po/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete");
      toast.success("Customer PO deleted");
      fetchData();
    } catch {
      toast.error("Failed to delete");
    } finally {
      setDeleteId(null);
    }
  };

  const openAdd = () => {
    setEditingItem(null);
    setIsDialogOpen(true);
  };

  const openEdit = (item: CustomerPO) => {
    setEditingItem(item);
    setIsDialogOpen(true);
  };

  const filteredData = useMemo(() => {
    let result = data;
    // Sidebar filter
    if (sidebarVBNumber) {
      result = result.filter(item =>
        (item.VBNumber || 'Unlinked') === sidebarVBNumber
      );
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(item => {
        const customerName = customers.find((c: any) => c._id === item.customer)?.name || '';
        const locName = locationMap[item.customerLocation || ''] || '';
        const poDisplay = poDisplayMap[item.VBNumber || ''] || '';
        const searchable = [poDisplay, item.VBNumber, item.VBSerialNumber, customerName, item.customer, locName, item.customerPONo, item.warehouse, item.UOM, formatDate(item.customerPODate), formatDate(item.requestedDeliveryDate)].filter(Boolean).join(' ').toLowerCase();
        return searchable.includes(q);
      });
    }
    return result;
  }, [data, filters.search, sidebarVBNumber]);

  const columns: ColumnDef<CustomerPO>[] = [
    {
      id: "VBNumber",
      header: "VB #",
      cell: ({ row }) => poDisplayMap[row.original.VBNumber || ""] || row.original.VBNumber || "-",
    },
    {
      accessorKey: "poNo",
      header: "Contract #",
      cell: ({ row }) => row.original.VBSerialNumber || "-",
    },
    {
      accessorKey: "customer",
      header: "Customer",
      cell: ({ row }) => {
        const cust = customers.find((c: any) => c._id === row.original.customer || c._id === row.original.customer?.toString());
        return cust?.name || row.original.customer || "-";
      },
    },
    {
      accessorKey: "customerLocation",
      header: "Location",
      cell: ({ row }) => locationMap[row.original.customerLocation || ""] || row.original.customerLocation || "-",
    },
    { accessorKey: "customerPONo", header: "Customer PO #" },
    {
      accessorKey: "customerPODate",
      header: "CPO Date",
      cell: ({ row }) => formatDate(row.original.customerPODate),
    },
    {
      accessorKey: "requestedDeliveryDate",
      header: "Delivery Date",
      cell: ({ row }) => formatDate(row.original.requestedDeliveryDate),
    },
    {
      accessorKey: "qtyOrdered",
      header: "Qty Ordered",
      cell: ({ row }) => row.original.qtyOrdered?.toLocaleString() || "-",
    },
    {
      accessorKey: "qtyReceived",
      header: "Qty Received",
      cell: ({ row }) => row.original.qtyReceived?.toLocaleString() || "-",
    },
    { accessorKey: "UOM", header: "UOM" },
    {
      id: "directShipment",
      header: "Direct Ship",
      cell: ({ row }) => {
        const yes = !!row.original.isDirectShipment;
        return (
          <span className={cn(
            "inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border",
            yes
              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
              : "bg-muted text-muted-foreground border-border"
          )}>
            {yes ? <Truck className="h-2.5 w-2.5" /> : null}
            {yes ? "Yes" : "No"}
          </span>
        );
      },
    },
    {
      accessorKey: "warehouse",
      header: "Warehouse",
      cell: ({ row }) => warehouseNameMap[row.original.warehouse || ""] || row.original.warehouse || "-",
    },
    {
      id: "completion",
      header: "Completion",
      cell: ({ row }) => {
        const ordered = Number(row.original.qtyOrdered) || 0;
        const received = Number(row.original.qtyReceived) || 0;
        const percent = ordered > 0 ? Math.round((received / ordered) * 100) : 0;
        return (
          <div className="w-20 group relative">
            <div className="flex items-center justify-between text-[10px] font-bold mb-1">
              <span className={percent >= 100 ? "text-emerald-600 dark:text-emerald-400" : percent > 0 ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"}>
                {percent}%
              </span>
            </div>
            <div className="h-1.5 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden shadow-inner">
              <div
                className={`h-full transition-all duration-700 ease-out rounded-full ${percent >= 100 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : percent > 50 ? 'bg-blue-500' : percent > 0 ? 'bg-amber-400' : 'bg-transparent'}`}
                style={{ width: `${Math.min(percent, 100)}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      id: "products",
      header: "Products",
      cell: ({ row }) => {
        const count = (row.original.products || []).length;
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setProductSearch("");
              setProductPopoverOpen(false);
              setProductsModal({ cpo: row.original });
            }}
            className={cn(
              "inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full transition-colors",
              count > 0
                ? "bg-violet-500/10 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            <Package className="h-3 w-3" />
            {count > 0 ? count : "—"}
          </button>
        );
      },
    },
    {
      id: "documents",
      header: "Docs",
      cell: ({ row }) => {
        const count = (row.original.driveDocuments || []).filter((d: any) => d?.mimeType !== "application/vnd.google-apps.folder").length;
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              const poNo = row.original.VBNumber || "";
              if (poNo) setAttachmentsPoNumber({ poNumber: poNo, spoNumber: row.original.VBSerialNumber || undefined });
            }}
            className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full transition-colors ${count > 0 ? 'bg-primary/10 text-primary hover:bg-primary/20' : 'text-muted-foreground hover:bg-muted'}`}
          >
            <Paperclip className="h-3 w-3" />
            {count > 0 ? count : '—'}
          </button>
        );
      },
    },
    {
      id: "timeline",
      header: "Timeline",
      cell: ({ row }) => {
        const cpoId = row.original._id;
        const count = timelineCounts[cpoId] || 0;
        const display = row.original.VBSerialNumber || cpoId;
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setTimelineOpen({
                VBNumber: row.original.VBNumber?.toString() || undefined,
                VBSerialNumber: cpoId?.toString() || undefined,
                title: `Timeline — ${display}`,
              });
            }}
            className={`inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full transition-colors ${count > 0
              ? 'bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer'
              : 'text-muted-foreground hover:bg-muted cursor-pointer'
              }`}
          >
            <Clock className="h-3 w-3" />
            {count > 0 ? count : '—'}
          </button>
        );
      },
    },
    {
      id: "chat",
      header: "Chat",
      cell: ({ row }) => {
        const cpoId = row.original._id;
        const display = row.original.VBSerialNumber || cpoId;
        const info = chatInfo[cpoId];
        const count = info?.unread || 0;
        const hasConv = info?.hasConversation || false;
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              const parentId = row.original.VBNumber;
              setChatOpen({ refKind: "VBSerialNumber", refId: cpoId, display, parentRefId: parentId || undefined });
            }}
            className={`inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full transition-colors ${count > 0
              ? 'bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer'
              : hasConv
              ? 'text-primary/60 hover:bg-primary/10 cursor-pointer'
              : 'text-muted-foreground hover:bg-muted cursor-pointer'
              }`}
            aria-label={`Chat for ${display}`}
          >
            <MessageCircle className={`h-3 w-3 ${hasConv ? 'fill-current' : ''}`} />
            {count > 0 ? count : hasConv ? '' : '—'}
          </button>
        );
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); openEdit(row.original); }}
            className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setDeleteId(row.original._id); }}
            className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
      size: 80,
    },
  ];

  if (loading) return <TablePageSkeleton />;

  const headerFilters = (
    <div className="flex items-center gap-1.5">
      <ViewToggle currentView="list" basePath="/admin/customer-pos" />
      <div className="h-5 w-px bg-border mx-1" />
      <input
        type="text"
        placeholder="Search..."
        value={inputs.search}
        onChange={(e) => setFilter("search", e.target.value)}
        className="h-8 w-[160px] rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
    </div>
  );

  return (
    <div className="w-full h-full flex">
      <CPOGroupSidebar
        data={data}
        activeVBNumber={sidebarVBNumber}
        onSelect={(vb) => setSidebarVBNumber(vb)}
      />
      <div className="flex-1 min-w-0">
        <SimpleDataTable
          columns={columns}
          data={filteredData}
          onAdd={openAdd}
          showColumnToggle={false}
          headerExtra={headerFilters}
          onRowClick={(row) => openEdit(row)}
        />
      </div>

      <AddCustomerPODialog
        open={isDialogOpen}
        onClose={() => { setIsDialogOpen(false); setEditingItem(null); }}
        editingData={editingItem}
        mode="standalone"
        existingCPOs={data}
        onSaved={fetchData}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer PO</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this Customer PO? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && handleDelete(deleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Record Chat Drawer */}
      {chatOpen && (
        <RecordChatDrawer
          open={!!chatOpen}
          onClose={() => {
            setChatOpen(null);
            fetchChatInfo();
          }}
          refKind={chatOpen.refKind}
          refId={chatOpen.refId}
          display={chatOpen.display}
          currentUserId={currentUserId}
          users={allUsers}
          parentRefId={chatOpen.parentRefId}
          parentRefKind="VBNumber"
        />
      )}

      {/* Drive Documents Modal */}
      <DriveDocumentsModal
        open={!!attachmentsPoNumber}
        onClose={() => setAttachmentsPoNumber(null)}
        poNumber={attachmentsPoNumber?.poNumber || ""}
        spoNumber={attachmentsPoNumber?.spoNumber}
      />

      {/* Timeline Modal */}
      <TimelineModal
        open={!!timelineOpen}
        onClose={() => setTimelineOpen(null)}
        VBNumber={timelineOpen?.VBNumber}
        VBSerialNumber={timelineOpen?.VBSerialNumber}
        title={timelineOpen?.title}
      />

      {/* Products CRUD Modal */}
      <Dialog
        open={!!productsModal}
        onOpenChange={(v) => { if (!v) { setProductsModal(null); setProductSearch(""); setProductPopoverOpen(false); } }}
      >
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-4 w-4 text-violet-500" />
              Products
              <span className="text-xs font-normal text-muted-foreground">
                {productsModal?.cpo.VBSerialNumber || productsModal?.cpo._id}
              </span>
            </DialogTitle>
            <DialogDescription className="sr-only">Manage products linked to this Customer PO</DialogDescription>
          </DialogHeader>

          {/* Add product — searchable popover */}
          <div className="shrink-0">
            <Popover
              open={productPopoverOpen}
              onOpenChange={(v) => { setProductPopoverOpen(v); if (!v) setProductSearch(""); }}
            >
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between h-9 text-sm font-normal">
                  <span className="text-muted-foreground">Add product…</span>
                  <ChevronsUpDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <div className="flex flex-col">
                  <div className="flex items-center border-b px-3">
                    <svg className="mr-2 h-4 w-4 shrink-0 opacity-50" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                    <input
                      className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                      placeholder="Search products…"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      autoFocus
                    />
                    {productSearch && (
                      <button onClick={() => setProductSearch("")} className="text-muted-foreground hover:text-foreground p-1">
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <div className="max-h-[200px] overflow-y-auto">
                    {filteredProductOptions.length === 0 ? (
                      <div className="py-6 text-center text-sm text-muted-foreground">No products found.</div>
                    ) : (
                      filteredProductOptions.map((p: any) => {
                        const isSelected = (productsModal?.cpo.products || []).includes(p._id);
                        return (
                          <button
                            key={p._id}
                            type="button"
                            onClick={() => toggleProductInModal(p._id)}
                            className={cn(
                              "relative flex w-full cursor-pointer select-none items-center rounded-sm px-3 py-1.5 text-sm outline-none transition-colors hover:bg-accent",
                              isSelected && "bg-accent"
                            )}
                          >
                            <Check className={cn("mr-2 h-4 w-4 shrink-0", isSelected ? "opacity-100" : "opacity-0")} />
                            <span className="truncate">{p.name || p.vbId}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Linked products list */}
          <div className="flex-1 overflow-y-auto space-y-1.5 min-h-0">
            {(productsModal?.cpo.products || []).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
                <Package className="h-8 w-8 opacity-20" />
                <p className="text-sm">No products linked yet.</p>
                <p className="text-xs opacity-60">Use the picker above to add products.</p>
              </div>
            ) : (
              (productsModal?.cpo.products || []).map((pid) => {
                const name = productNameMap[pid] || pid;
                return (
                  <div
                    key={pid}
                    className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 group"
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-md bg-violet-500/10 flex items-center justify-center shrink-0">
                        <Package className="h-3 w-3 text-violet-500" />
                      </div>
                      <span className="text-sm font-medium">{name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeProductFromModal(pid)}
                      disabled={savingProducts}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                      aria-label={`Remove ${name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer summary */}
          {(productsModal?.cpo.products || []).length > 0 && (
            <div className="shrink-0 pt-2 border-t border-border text-xs text-muted-foreground">
              {(productsModal?.cpo.products || []).length} product{(productsModal?.cpo.products || []).length !== 1 ? 's' : ''} linked
              {savingProducts && <span className="ml-2 animate-pulse">Saving…</span>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
