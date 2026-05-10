"use client";

import { useEffect, useState, useMemo, useLayoutEffect } from "react";
import { useRouter } from "next/navigation";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Search,
  ClipboardList,
  Pencil,
  Trash2,
  Package,
  MapPin,
  Calendar,
  TrendingUp,
  Plus,
} from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { TablePageSkeleton } from "@/components/skeletons";
import { ViewToggle } from "@/components/admin/view-toggle";
import { AddCustomerPODialog } from "@/components/admin/add-customer-po-dialog";
import { CPOGroupSidebar } from "@/components/admin/cpo-group-sidebar";
import { useUserDataStore } from "@/store/useUserDataStore";

interface CustomerPO {
  _id: string;
  vbpoNo?: string;
  VBNumber?: string;
  poNo?: string;
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
  vidaPOId?: string;
  createdAt?: string;
}

export default function CustomerPOsCardPage() {
  const router = useRouter();
  const { setActions, setLeftContent } = useHeaderActions();
  const [data, setData] = useState<CustomerPO[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CustomerPO | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [sidebarVBNumber, setSidebarVBNumber] = useState<string | null>(null);

  const { customers: storeCustomers } = useUserDataStore();
  const customers = storeCustomers || [];

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

  useEffect(() => {
    fetchData();
  }, []);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/vb-customer-po/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
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
        (item.VBNumber || item.vidaPOId || item.vbpoNo || 'Unlinked') === sidebarVBNumber
      );
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(item => {
        const searchable = [item.VBNumber, item.VBSerialNumber, item.vbpoNo, item.poNo, item.customer, item.customerPONo, item.warehouse].filter(Boolean).join(' ').toLowerCase();
        return searchable.includes(q);
      });
    }
    return result;
  }, [data, searchQuery, sidebarVBNumber]);

  // Set header actions
  useLayoutEffect(() => {
    const headerContent = (
      <div className="flex items-center gap-2">
        <ViewToggle currentView="card" basePath="/admin/customer-pos" />
        <div className="h-5 w-px bg-border mx-1" />
        <div className="relative">
          <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 w-[180px] rounded-md border border-input bg-background pl-8 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        <Button onClick={openAdd} size="sm" className="h-8">
          <Plus className="mr-2 h-4 w-4" /> Add New
        </Button>
      </div>
    );
    setActions(headerContent);

    const timer = setTimeout(() => setActions(headerContent), 50);
    return () => { clearTimeout(timer); setActions(null); setLeftContent(null); };
  }, [setActions, setLeftContent, searchQuery]);

  if (loading) return <TablePageSkeleton />;

  return (
    <div className="w-full h-full flex">
      <CPOGroupSidebar
        data={data}
        activeVBNumber={sidebarVBNumber}
        onSelect={(vb) => setSidebarVBNumber(vb)}
      />
      <div className="flex-1 min-w-0 overflow-auto p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredData.map((item) => {
            const percent = (item.qtyOrdered && item.qtyOrdered > 0)
              ? Math.round(((item.qtyReceived || 0) / item.qtyOrdered) * 100)
              : 0;
            const custName = customers.find((c: any) => c.vbId === item.customer)?.name || item.customer;

            return (
              <div
                key={item._id}
                className="group relative overflow-hidden rounded-xl border border-border bg-card text-card-foreground transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-0.5 hover:border-primary/30"
              >
                {/* Hover gradient */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-gradient-to-br from-primary/5 via-transparent to-transparent" />

                {/* Header */}
                <div className="relative px-4 pt-4 pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 transition-transform duration-300 group-hover:scale-110">
                        <ClipboardList className="h-4.5 w-4.5 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold tracking-tight leading-none">{item.VBSerialNumber || item.poNo || "—"}</h3>
                        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                          {item.vbpoNo || "—"}
                        </p>
                      </div>
                    </div>
                    {item.UOM && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-muted/50 text-muted-foreground">
                        {item.UOM}
                      </span>
                    )}
                  </div>
                </div>

                {/* Meta */}
                <div className="relative px-4 pb-2 space-y-1.5">
                  {custName && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Package className="h-3 w-3" />
                      <span className="truncate font-medium">{custName}</span>
                    </div>
                  )}
                  {item.warehouse && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      <span className="truncate">{item.warehouse}</span>
                    </div>
                  )}
                  {(item.customerPODate || item.requestedDeliveryDate) && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>{formatDate(item.customerPODate)}</span>
                      {item.requestedDeliveryDate && (
                        <span className="text-amber-600 dark:text-amber-400 font-semibold">→ {formatDate(item.requestedDeliveryDate)}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Progress bar */}
                <div className="relative border-t border-border/50 px-4 py-2.5 mt-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-3 w-3 text-muted-foreground" />
                      <span className={`text-[10px] font-bold ${percent >= 100 ? "text-emerald-600 dark:text-emerald-400" : percent > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                        {percent}%
                      </span>
                      <div className="w-16 h-1 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-1000 ${
                            percent >= 100 ? "bg-emerald-500"
                              : percent > 50 ? "bg-blue-500"
                              : percent > 0 ? "bg-amber-400"
                              : "bg-transparent"
                          }`}
                          style={{ width: `${Math.min(percent, 100)}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-[9px] text-muted-foreground/60 tabular-nums">
                      {(item.qtyReceived || 0).toLocaleString()} / {(item.qtyOrdered || 0).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="relative px-4 pb-3">
                  <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button
                      onClick={(e) => { e.stopPropagation(); openEdit(item); }}
                      className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteId(item._id); }}
                      className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredData.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              No Customer POs found
            </div>
          )}
        </div>

        {/* Unified Add/Edit Dialog */}
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
      </div>
    </div>
  );
}
