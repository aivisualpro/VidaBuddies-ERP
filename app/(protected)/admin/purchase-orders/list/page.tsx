"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUserDataStore } from "@/store/useUserDataStore";
import { SimpleDataTable } from "@/components/admin/simple-data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ColumnDef } from "@tanstack/react-table";
import { Pencil, Trash, ShoppingCart, Calendar, Ship, CheckCircle2, Clock, Mail, Archive, ArchiveRestore, FileCheck } from "lucide-react";
import { TablePageSkeleton } from "@/components/skeletons";
import TimelineModal from "@/components/admin/timeline-modal";
import { AttachmentsModal } from "@/components/attachments-modal";
import { ViewToggle } from "@/components/admin/view-toggle";

interface PurchaseOrder {
  _id: string;
  vbpoNo: string;
  orderType: string;
  category: string;
  date: string;
  createdBy: string;
  isArchived?: boolean;
  isNigalu?: boolean;
  customerPO?: {
    shipping?: {
      status?: string;
      [key: string]: any;
    }[];
  }[];
}

function normalizeStatus(raw: string): string {
  if (!raw) return 'pending';
  const s = raw.toLowerCase().trim();
  if (s === 'delivered' || s === 'arrived') return 'delivered';
  if (s === 'in transit' || s === 'in_transit' || s === 'on water') return 'in transit';
  if (s === 'planned' || s === 'booking confirmed') return 'planned';
  return 'pending';
}

export default function PurchaseOrdersPage() {
  const router = useRouter();
  
  // Connect to global store
  const { purchaseOrders, users: rawUsers, isLoading, refetchPurchaseOrders } = useUserDataStore();
  
  // Current user role
  const [userRole, setUserRole] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/user/permissions")
      .then(r => r.json())
      .then(d => setUserRole(d.role || ""))
      .catch(() => setUserRole(""));
  }, []);
  
  // Sort latest on top
  const data = useMemo(() => {
    return [...purchaseOrders].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [purchaseOrders]);

  const users = useMemo(() => {
    const mapping: Record<string, string> = {};
    if (Array.isArray(rawUsers)) {
      rawUsers.forEach((u: any) => {
        if(u.email) mapping[u.email.toLowerCase()] = u.name;
      });
    }
    return mapping;
  }, [rawUsers]);

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PurchaseOrder | null>(null);

  // Filters
  const [filterOrderType, setFilterOrderType] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterShipStatus, setFilterShipStatus] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showArchived, setShowArchived] = useState(false);
  const [timelineCounts, setTimelineCounts] = useState<Record<string, number>>({});
  const [timelineOpen, setTimelineOpen] = useState<{ vbpoNo?: string; title?: string } | null>(null);
  const [emailCounts, setEmailCounts] = useState<Record<string, number>>({});
  const [invoiceCounts, setInvoiceCounts] = useState<Record<string, number>>({});
  const [attachmentsOpen, setAttachmentsOpen] = useState<{ poNumber: string } | null>(null);

  const [formData, setFormData] = useState<Partial<PurchaseOrder>>({
    vbpoNo: "",
    orderType: "",
    category: "",
    createdBy: "",
    date: new Date().toISOString().split('T')[0],
  });



  // After data loads, fetch email counts
  useEffect(() => {
    if (data.length > 0) {
      fetchEmailCountsForPOs(data);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.length]);

  const fetchTimelineCounts = async () => {
    try {
      const response = await fetch("/api/admin/timeline");
      const items = await response.json();
      if (Array.isArray(items)) {
        const counts: Record<string, number> = {};
        items.forEach((t: any) => {
          if (t.vbpoNo) {
            counts[t.vbpoNo] = (counts[t.vbpoNo] || 0) + 1;
          }
        });
        setTimelineCounts(counts);
      }
    } catch (error) {
      console.error("Failed to fetch timeline counts", error);
    }
  };

  const fetchEmailCountsForPOs = async (poList: PurchaseOrder[]) => {
    const counts: Record<string, number> = {};
    const invCounts: Record<string, number> = {};
    try {
      // Batch: fetch all emails across all POs
      const promises = poList.map(async (po) => {
        try {
          const res = await fetch(`/api/admin/emails?vbpoNo=${encodeURIComponent(po.vbpoNo)}`);
          const data = await res.json();
          if (res.ok && data.emails) {
            counts[po.vbpoNo] = data.emails.length;
            invCounts[po.vbpoNo] = data.emails.filter((e: any) => e.type === "Invoice").length;
          }
        } catch { /* silent */ }
      });
      await Promise.all(promises);
      setEmailCounts(counts);
      setInvoiceCounts(invCounts);
    } catch (error) {
      console.error("Failed to fetch email counts", error);
    }
  };

  useEffect(() => {
    fetchTimelineCounts();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingItem
        ? `/api/admin/purchase-orders/${editingItem._id}`
        : "/api/admin/purchase-orders";
      const method = editingItem ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error("Failed to save");

      toast.success(editingItem ? "Purchase Order updated" : "Purchase Order created");
      setIsSheetOpen(false);
      refetchPurchaseOrders();
    } catch (error) {
      toast.error("An error occurred");
    }
  };

  const updateFieldInline = async (id: string, field: string, value: string) => {
    try {
      const response = await fetch(`/api/admin/purchase-orders/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!response.ok) throw new Error("Failed");
      refetchPurchaseOrders();
      toast.success(`Updated ${field}`);
    } catch {
      toast.error(`Failed to update ${field}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this purchase order?")) return;
    try {
      const response = await fetch(`/api/admin/purchase-orders/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete");
      toast.success("Purchase Order deleted");
      refetchPurchaseOrders();
    } catch (error) {
      toast.error("Failed to delete purchase order");
    }
  };

  const openAddSheet = () => {
    setEditingItem(null);
    // Auto-generate next VB PO #
    let nextVbpoNo = "VB1";
    if (data.length > 0) {
      const numbers = data
        .map((item) => {
          const match = item.vbpoNo?.match(/^VB(\d+)$/i);
          return match ? parseInt(match[1], 10) : 0;
        })
        .filter((n) => n > 0);
      if (numbers.length > 0) {
        const maxNum = Math.max(...numbers);
        nextVbpoNo = `VB${maxNum + 1}`;
      }
    }
    setFormData({
      vbpoNo: nextVbpoNo,
      orderType: "",
      category: "",
      date: new Date().toISOString().split('T')[0],
    });
    setIsSheetOpen(true);
  };

  const openEditSheet = (item: PurchaseOrder) => {
    setEditingItem(item);
    // Ensure date is formatted for input
    const formattedDate = item.date ? new Date(item.date).toISOString().split('T')[0] : "";
    setFormData({ ...item, date: formattedDate });
    setIsSheetOpen(true);
  };

  const columns: ColumnDef<PurchaseOrder>[] = [
    {
      accessorKey: "vbpoNo",
      header: "VB PO #",
    },
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ row }) => {
        const dateAttr = row.getValue("date");
        if (!dateAttr) return "-";
        const d = new Date(dateAttr as string);
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${mm}/${dd}/${yyyy}`;
      },
    },
    {
      accessorKey: "orderType",
      header: "Order Type",
      cell: ({ row }) => {
        const value = row.original.orderType || '';
        const colorMap: Record<string, string> = {
          'Export': 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
          'Import': 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
          'Dropship': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
          'DROPSHIP': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
          'Inventory': 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
          'INVENTORY': 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
          'IMPORT': 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
        };
        const chipColor = colorMap[value] || 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
        return (
          <select
            value={value}
            onChange={(e) => { e.stopPropagation(); updateFieldInline(row.original._id, 'orderType', e.target.value); }}
            onClick={(e) => e.stopPropagation()}
            className={`appearance-none cursor-pointer text-[11px] font-medium px-2 py-0.5 rounded-full border-0 outline-none ${chipColor}`}
          >
            <option value="Export">Export</option>
            <option value="Import">Import</option>
            <option value="Dropship">Dropship</option>
            <option value="Inventory">Inventory</option>
          </select>
        );
      },
    },
    {
      accessorKey: "category",
      header: "Category",
      cell: ({ row }) => {
        const value = row.original.category || '';
        const colorMap: Record<string, string> = {
          'CONVENTIONAL': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
          'ORGANIC': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
        };
        const chipColor = colorMap[value] || 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
        return (
          <select
            value={value}
            onChange={(e) => { e.stopPropagation(); updateFieldInline(row.original._id, 'category', e.target.value); }}
            onClick={(e) => e.stopPropagation()}
            className={`appearance-none cursor-pointer text-[11px] font-medium px-2 py-0.5 rounded-full border-0 outline-none ${chipColor}`}
          >
            <option value="CONVENTIONAL">CONVENTIONAL</option>
            <option value="ORGANIC">ORGANIC</option>
          </select>
        );
      },
    },
    {
      id: "customerPos",
      header: "Customer POs",
      cell: ({ row }) => {
        const count = row.original.customerPO?.length || 0;
        return (
          <div className="flex items-center gap-1">
            <span className="text-foreground">{count}</span>
          </div>
        );
      },
    },
    {
      id: "shippings",
      header: "Shippings",
      cell: ({ row }) => {
        const count = row.original.customerPO?.reduce((acc, cpo) => acc + (cpo.shipping?.length || 0), 0) || 0;
        return (
          <div className="flex items-center gap-1">
            <span className="text-primary">{count}</span>
          </div>
        );
      },
    },
    {
      id: "planned",
      header: "Planned",
      cell: ({ row }) => {
        let count = 0;
        row.original.customerPO?.forEach((cpo) => {
          cpo.shipping?.forEach((ship) => {
            const status = normalizeStatus(ship.status || '');
            if (status === 'planned') count++;
          });
        });
        if (count === 0) return <span className="text-muted-foreground">-</span>;
        return (
          <span className="inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            {count}
          </span>
        );
      },
    },
    {
      id: "inTransit",
      header: "In Transit",
      cell: ({ row }) => {
        let count = 0;
        row.original.customerPO?.forEach((cpo) => {
          cpo.shipping?.forEach((ship) => {
            const status = normalizeStatus(ship.status || '');
            if (status === 'in transit') count++;
          });
        });
        if (count === 0) return <span className="text-muted-foreground">-</span>;
        return (
          <span className="inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
            <Ship className="h-3 w-3" />
            {count}
          </span>
        );
      },
    },
    {
      id: "delivered",
      header: "Delivered",
      cell: ({ row }) => {
        let count = 0;
        row.original.customerPO?.forEach((cpo) => {
          cpo.shipping?.forEach((ship) => {
            const status = normalizeStatus(ship.status || '');
            if (status === 'delivered') count++;
          });
        });
        
        const vbpoNo = row.original.vbpoNo;
        const invCount = invoiceCounts[vbpoNo] || 0;
        
        if (count === 0 && invCount === 0) return <span className="text-muted-foreground">-</span>;
        
        const isDeficient = count > 0 && invCount < count;

        return (
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
              <CheckCircle2 className="h-3 w-3" />
              {count}
            </span>
            <span className="text-muted-foreground/50 text-[10px] font-bold">/</span>
            <span className={`inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full ${
              isDeficient 
                ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 shadow-[0_0_8px_rgba(239,68,68,0.2)]" 
                : "bg-muted text-muted-foreground"
            }`}>
              <FileCheck className="h-3 w-3" />
              {invCount}
            </span>
          </div>
        );
      },
    },
    {
      id: "completion",
      header: "Completion",
      cell: ({ row }) => {
        let totalOrdered = 0;
        let totalReceived = 0;
        row.original.customerPO?.forEach((cpo: any) => {
          totalOrdered += Number(cpo.qtyOrdered) || 0;
          totalReceived += Number(cpo.qtyReceived) || 0;
        });

        const percent = totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0;
        
        return (
          <div className="w-20 group relative">
            <div className="flex items-center justify-between text-[10px] font-bold mb-1">
              <span className={percent >= 100 ? "text-emerald-600 dark:text-emerald-400" : percent > 0 ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"}>
                {percent}%
              </span>
              <span className="text-[9px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity absolute right-0 -top-4 whitespace-nowrap bg-white/90 dark:bg-black/90 px-1 py-0.5 rounded shadow border">
                {totalReceived.toLocaleString()} / {totalOrdered.toLocaleString()}
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
      id: "timeline",
      header: "Timeline",
      cell: ({ row }) => {
        const vbpoNo = row.original.vbpoNo;
        const count = timelineCounts[vbpoNo] || 0;
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setTimelineOpen({ vbpoNo, title: `Timeline — ${vbpoNo}` });
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
      id: "emails",
      header: "Emails",
      cell: ({ row }) => {
        const vbpoNo = row.original.vbpoNo;
        const count = emailCounts[vbpoNo] || 0;
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setAttachmentsOpen({ poNumber: vbpoNo });
            }}
            className={`inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full transition-colors ${count > 0
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 cursor-pointer'
              : 'text-muted-foreground hover:bg-muted cursor-pointer'
              }`}
          >
            <Mail className="h-3 w-3" />
            {count > 0 ? count : '—'}
          </button>
        );
      },
    },
    {
      accessorKey: "createdBy",
      header: "Created By",
      cell: ({ row }) => {
        const email = row.getValue("createdBy") as string;
        if (!email) return "-";
        return users[email.toLowerCase()] || email;
      },
    },
    {
      id: "nigalu",
      header: "NIGALU",
      cell: ({ row }) => {
        const isNigalu = row.original.isNigalu;
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleNigalu(row.original._id, !isNigalu);
            }}
            title={isNigalu ? 'Remove from NIGALU' : 'Mark as NIGALU'}
            className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full transition-colors ${
              isNigalu
                ? 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300 hover:bg-fuchsia-200'
                : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500 hover:bg-zinc-200'
            }`}
          >
            {isNigalu ? 'ON' : 'OFF'}
          </button>
        );
      },
      size: 60,
    },
    {
      id: "archive",
      header: "",
      cell: ({ row }) => {
        const isArchived = row.original.isArchived;
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleArchive(row.original._id, !isArchived);
            }}
            title={isArchived ? 'Restore from archive' : 'Archive this PO'}
            className={`p-1 rounded-md transition-colors ${
              isArchived
                ? 'text-amber-500 hover:bg-amber-500/10'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            {isArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
          </button>
        );
      },
      size: 40,
    },
  ];

  // Hide admin-only columns from NIGALU users
  const visibleColumns = userRole === 'NIGALU'
    ? columns.filter(c => c.id !== 'nigalu' && c.id !== 'archive')
    : columns;

  if (isLoading || userRole === null) {
    return <TablePageSkeleton />;
  }

  // Compute unique filter options
  const orderTypes = [...new Set(data.map(d => d.orderType).filter(Boolean))].sort();
  const categories = [...new Set(data.map(d => d.category).filter(Boolean))].sort();

  // Filter data
  const filteredData = data.filter(po => {
    // NIGALU role: only show POs where isNigalu is true
    if (userRole === 'NIGALU' && !po.isNigalu) return false;
    // Archive filter: hide archived unless toggled on
    if (!showArchived && po.isArchived) return false;
    if (showArchived && !po.isArchived) return false;
    if (filterOrderType && po.orderType !== filterOrderType) return false;
    if (filterCategory && po.category !== filterCategory) return false;
    if (filterShipStatus) {
      const hasStatus = po.customerPO?.some((cpo: any) =>
        cpo.shipping?.some((ship: any) => normalizeStatus(ship.status || '') === filterShipStatus)
      );
      if (!hasStatus) return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const createdByName = users[po.createdBy?.toLowerCase()] || po.createdBy || '';
      const searchable = [
        po.vbpoNo, po.orderType, po.category, po.date, po.createdBy, createdByName
      ].filter(Boolean).join(' ').toLowerCase();
      if (!searchable.includes(q)) return false;
    }
    return true;
  });

  const hasActiveFilters = filterOrderType || filterCategory || filterShipStatus;

  const archivedCount = data.filter(po => po.isArchived).length;

  const toggleArchive = async (poId: string, archive: boolean) => {
    try {
      const res = await fetch(`/api/admin/purchase-orders/${poId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: archive }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success(archive ? 'Purchase Order archived' : 'Purchase Order restored');
      refetchPurchaseOrders();
    } catch {
      toast.error('Failed to update archive status');
    }
  };

  const toggleNigalu = async (poId: string, nigalu: boolean) => {
    try {
      const res = await fetch(`/api/admin/purchase-orders/${poId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isNigalu: nigalu }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success(nigalu ? 'Marked as NIGALU' : 'Removed NIGALU flag');
      refetchPurchaseOrders();
    } catch {
      toast.error('Failed to update NIGALU status');
    }
  };

  const headerFilters = (
    <div className="flex items-center gap-1.5">
      <ViewToggle currentView="list" />
      <div className="h-5 w-px bg-border mx-1" />
      <input
        type="text"
        placeholder="Search..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="h-8 w-[160px] rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      <select
        value={filterOrderType}
        onChange={(e) => setFilterOrderType(e.target.value)}
        className={`h-8 rounded-md border px-2 text-xs bg-background transition-colors ${filterOrderType ? 'border-primary text-primary font-medium' : 'border-input text-muted-foreground'
          }`}
      >
        <option value="">All Types</option>
        {orderTypes.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      <select
        value={filterCategory}
        onChange={(e) => setFilterCategory(e.target.value)}
        className={`h-8 rounded-md border px-2 text-xs bg-background transition-colors ${filterCategory ? 'border-primary text-primary font-medium' : 'border-input text-muted-foreground'
          }`}
      >
        <option value="">All Categories</option>
        {categories.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <select
        value={filterShipStatus}
        onChange={(e) => setFilterShipStatus(e.target.value)}
        className={`h-8 rounded-md border px-2 text-xs bg-background transition-colors ${filterShipStatus ? 'border-primary text-primary font-medium' : 'border-input text-muted-foreground'
          }`}
      >
        <option value="">All Statuses</option>
        <option value="pending">Pending</option>
        <option value="planned">Planned</option>
        <option value="in transit">In Transit</option>
        <option value="delivered">Delivered</option>
      </select>
      {hasActiveFilters && (
        <button
          onClick={() => { setFilterOrderType(""); setFilterCategory(""); setFilterShipStatus(""); }}
          className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Clear
        </button>
      )}
      <div className="h-5 w-px bg-border mx-1" />
      <button
        onClick={() => setShowArchived(!showArchived)}
        className={`h-8 px-2.5 rounded-md border text-xs font-medium flex items-center gap-1.5 transition-colors ${
          showArchived
            ? 'border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400'
            : 'border-input text-muted-foreground hover:text-foreground hover:bg-muted'
        }`}
      >
        <Archive className="h-3.5 w-3.5" />
        Archived{archivedCount > 0 ? ` (${archivedCount})` : ''}
      </button>
    </div>
  );

  return (
    <div className="w-full h-full">
      <SimpleDataTable
        columns={visibleColumns}
        data={filteredData}
        onAdd={userRole === 'NIGALU' ? undefined : openAddSheet}
        onRowClick={(row) => router.push(`/admin/purchase-orders/${row._id}`)}
        showColumnToggle={false}
        headerExtra={headerFilters}
      />

      <Dialog open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <DialogContent className="max-w-2xl overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Purchase Order" : "Add Purchase Order"}</DialogTitle>
            <DialogDescription className="sr-only">{editingItem ? "Update purchase order details" : "Create a new purchase order"}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="vbpoNo">VB PO #</Label>
                <div className="relative">
                  <ShoppingCart className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="vbpoNo"
                    className="pl-9"
                    value={formData.vbpoNo || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, vbpoNo: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="date">Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="date"
                    type="date"
                    className="pl-9"
                    value={formData.date || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, date: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="orderType">Order Type</Label>
                <select
                  id="orderType"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={formData.orderType || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, orderType: e.target.value })
                  }
                  required
                >
                  <option value="" disabled>Select type...</option>
                  <option value="Export">Export</option>
                  <option value="Import">Import</option>
                  <option value="Dropship">Dropship</option>
                  <option value="Inventory">Inventory</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="category">Category</Label>
                <select
                  id="category"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={formData.category || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                  required
                >
                  <option value="" disabled>Select category...</option>
                  <option value="CONVENTIONAL">Conventional</option>
                  <option value="ORGANIC">Organic</option>
                </select>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:space-x-0">
              <Button variant="outline" type="button" onClick={() => setIsSheetOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{editingItem ? "Save Changes" : "Create PO"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Timeline Modal */}
      <TimelineModal
        open={!!timelineOpen}
        onClose={() => { setTimelineOpen(null); fetchTimelineCounts(); }}
        vbpoNo={timelineOpen?.vbpoNo}
        title={timelineOpen?.title}
        users={users}
      />

      {/* Attachments Modal (Emails tab) */}
      <AttachmentsModal
        open={!!attachmentsOpen}
        onClose={() => setAttachmentsOpen(null)}
        poNumber={attachmentsOpen?.poNumber || ''}
        defaultTab="emails"
      />
    </div>
  );
}
