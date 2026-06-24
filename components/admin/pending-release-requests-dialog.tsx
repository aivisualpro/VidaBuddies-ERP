"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { AddReleaseRequestDialog } from "@/components/admin/add-release-request-dialog";
import { toast } from "sonner";
import {
  ClipboardList,
  CheckCircle2,
  XCircle,
  Trash2,
  ExternalLink,
  Plus,
  Search,
  Loader2,
  Package,
  Building2,
  Calendar,
  User,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface PendingRR {
  _id: string;
  date?: string;
  poNo: any;
  transferOrder: any;
  customer?: any;
  warehouse?: any;
  requestedBy?: any;
  contact?: string;
  releaseOrderProducts?: any[];
  pickedUp?: boolean;
  createdAt?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Called after a mutation so the parent can refresh its counter */
  onRefresh?: () => void;
}

export function PendingReleaseRequestsDialog({ open, onOpenChange, onRefresh }: Props) {
  const router = useRouter();
  const [records, setRecords] = useState<PendingRR[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/release-requests");
      const data = await res.json();
      if (Array.isArray(data)) {
        setRecords(data.filter((r: any) => !r.pickedUp));
      }
    } catch {
      toast.error("Failed to load release requests");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchData();
    else { setSearch(""); setRecords([]); }
  }, [open, fetchData]);

  const filtered = useMemo(() => {
    if (!search.trim()) return records;
    const q = search.toLowerCase();
    return records.filter(r => {
      const poLabel =
        typeof r.poNo === "object" && r.poNo
          ? r.poNo.customerPONo || r.poNo.VBSerialNumber || ""
          : r.poNo || "";
      const custName = r.customer?.name || "";
      const whName = r.warehouse?.name || "";
      return [poLabel, custName, whName, r.contact || ""].some(v =>
        v.toLowerCase().includes(q)
      );
    });
  }, [records, search]);

  const handleTogglePickedUp = async (item: PendingRR) => {
    setTogglingId(item._id);
    try {
      const res = await fetch(`/api/admin/release-requests/${item._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pickedUp: true }),
      });
      if (!res.ok) throw new Error();
      toast.success("Marked as Picked Up \u2713");
      setRecords(prev => prev.filter(r => r._id !== item._id));
      onRefresh?.();
    } catch {
      toast.error("Failed to update");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (item: PendingRR) => {
    toast.warning("Delete this release request?", {
      description: "This cannot be undone.",
      action: {
        label: "Delete",
        onClick: async () => {
          setDeletingId(item._id);
          try {
            const res = await fetch(`/api/admin/release-requests/${item._id}`, { method: "DELETE" });
            if (!res.ok) throw new Error();
            toast.success("Deleted");
            setRecords(prev => prev.filter(r => r._id !== item._id));
            onRefresh?.();
          } catch {
            toast.error("Failed to delete");
          } finally {
            setDeletingId(null);
          }
        },
      },
      cancel: { label: "Cancel", onClick: () => {} },
    });
  };

  const poLabel = (item: PendingRR) => {
    if (typeof item.poNo === "object" && item.poNo)
      return item.poNo.customerPONo || item.poNo.VBSerialNumber || "\u2014";
    return item.poNo || "\u2014";
  };

  const shipmentLabel = (item: PendingRR) => {
    const to = item.transferOrder;
    if (!to) return null;
    if (typeof to === "object") return to.VBShipmentNumber || to.svbid || null;
    return null;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[88vh] flex flex-col p-0 gap-0">
          {/* Header */}
          <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <ClipboardList className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <DialogTitle className="text-base font-semibold flex items-center gap-2">
                    Pending Release Requests
                    {!loading && (
                      <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                        {records.length}
                      </span>
                    )}
                  </DialogTitle>
                  <DialogDescription className="text-xs mt-0.5">
                    Toggle the switch on any row to mark it as picked up and remove it from this list
                  </DialogDescription>
                </div>
              </div>
              <Button
                size="sm"
                className="gap-1.5 h-8"
                onClick={() => setAddOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </Button>
            </div>
          </DialogHeader>

          {/* Search bar */}
          <div className="px-6 py-3 border-b border-border shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search by PO #, customer, warehouse..."
                className="pl-9 h-8 text-sm"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {loading ? (
              <div className="flex items-center justify-center h-40 gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Loading...</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
                <CheckCircle2 className="h-10 w-10 opacity-20 text-emerald-500" />
                <p className="text-sm font-medium">
                  {search ? "No results match your search" : "All requests have been picked up!"}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map(item => (
                  <div
                    key={item._id}
                    className="flex items-center gap-3 px-6 py-4 hover:bg-muted/30 transition-colors group"
                  >
                    {/* Status icon */}
                    <div className="shrink-0">
                      <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                        <XCircle className="h-4 w-4 text-amber-500" />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm font-mono">{poLabel(item)}</span>
                        {shipmentLabel(item) && (
                          <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">
                            {shipmentLabel(item)}
                          </Badge>
                        )}
                        {item.date && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(item.date), "MMM dd, yyyy")}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
                        {item.customer?.name && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {item.customer.name}
                          </span>
                        )}
                        {item.warehouse?.name && (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {item.warehouse.name}
                          </span>
                        )}
                        {(item.releaseOrderProducts?.length ?? 0) > 0 && (
                          <span className="flex items-center gap-1">
                            <Package className="h-3 w-3" />
                            {item.releaseOrderProducts!.length} product{item.releaseOrderProducts!.length !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Icon actions — visible on hover */}
                    <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                        title="Open detail page"
                        onClick={() => {
                          router.push(`/inventory/release-requests/${item._id}`);
                          onOpenChange(false);
                        }}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        title="Delete"
                        disabled={deletingId === item._id}
                        onClick={() => handleDelete(item)}
                      >
                        {deletingId === item._id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Trash2 className="h-3.5 w-3.5" />}
                      </Button>
                    </div>

                    {/* Picked Up toggle */}
                    <div className="shrink-0 flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider hidden sm:block">
                        Picked Up
                      </span>
                      {togglingId === item._id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : (
                        <Switch
                          checked={false}
                          onCheckedChange={() => handleTogglePickedUp(item)}
                          className="data-[state=checked]:bg-emerald-500"
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-border shrink-0 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {filtered.length} pending request{filtered.length !== 1 ? "s" : ""}
              {search && records.length !== filtered.length && ` (${records.length} total)`}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-8 text-xs"
              onClick={() => {
                router.push("/inventory/release-requests?pickedUp=no");
                onOpenChange(false);
              }}
            >
              <ExternalLink className="h-3 w-3" />
              Open full page
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add new release request */}
      <AddReleaseRequestDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSaved={() => {
          fetchData();
          onRefresh?.();
        }}
      />
    </>
  );
}
