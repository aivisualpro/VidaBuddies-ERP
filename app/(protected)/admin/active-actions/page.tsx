"use client";

import { useEffect, useState, useMemo, useLayoutEffect } from "react";
import { toast } from "sonner";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import { ActiveActionsGroupSidebar } from "@/components/admin/active-actions-sidebar";
import { TimelineEntryDialog } from "@/components/admin/timeline-entry-dialog";
import { TablePageSkeleton } from "@/components/skeletons";
import { cn } from "@/lib/utils";
import {
  Search,
  Clock,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Ship,
  CalendarClock,
  Pencil,
  ChevronDown,
  User,
  Tag,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface TimelineEntry {
  _id: string;
  VBNumber?: string;
  VBSerialNumber?: string;
  VBShipmentNumber?: string;
  _VBNumberDisplay?: string;
  _VBSerialNumberDisplay?: string;
  _VBShipmentNumberDisplay?: string;
  date?: string;
  reminder?: string;
  type: string;
  comments?: string;
  status?: string;
  category?: string;
  createdBy?: string;
  timestamp: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: typeof AlertCircle }> = {
  Open: { label: "Open", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", icon: AlertCircle },
  "In Progress": { label: "In Progress", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30", icon: Clock },
  Closed: { label: "Closed", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", icon: CheckCircle2 },
};

const TYPE_COLORS: Record<string, string> = {
  Notes: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
  Shipping: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  "Action Required": "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
};


export default function ActiveActionsPage() {
  const { setActions, setLeftContent } = useHeaderActions();
  const [data, setData] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Sidebar filter state
  const [filterType, setFilterType] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterVBNumber, setFilterVBNumber] = useState<string | null>(null);
  const [filterVBSerial, setFilterVBSerial] = useState<string | null>(null);
  const [filterVBShipment, setFilterVBShipment] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<TimelineEntry | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/admin/timeline");
      const items = await res.json();
      setData(Array.isArray(items) ? items : []);
    } catch {
      toast.error("Failed to fetch timeline entries");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this timeline entry?")) return;
    try {
      const res = await fetch(`/api/admin/timeline/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Entry deleted");
      fetchData();
    } catch {
      toast.error("Failed to delete");
    }
  };

  const handleStatusChange = async (entryId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/admin/timeline/${entryId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(`Status → ${newStatus}`);
      fetchData();
    } catch {
      toast.error("Failed to update status");
    }
  };

  const handleReminderChange = async (entryId: string, dateStr: string) => {
    try {
      const res = await fetch(`/api/admin/timeline/${entryId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reminder: dateStr || null }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(dateStr ? `Reminder set` : `Reminder cleared`);
      fetchData();
    } catch {
      toast.error("Failed to update reminder");
    }
  };

  // Filter data based on sidebar selection + search
  const filteredData = useMemo(() => {
    let result = data;

    if (filterType) {
      result = result.filter((e) => e.type === filterType);
    }
    if (filterStatus) {
      result = result.filter((e) => (e.status || "Open") === filterStatus);
    }
    if (filterVBNumber) {
      result = result.filter((e) => (e.VBNumber || "Unlinked") === filterVBNumber);
    }
    if (filterVBSerial) {
      result = result.filter((e) => e.VBSerialNumber === filterVBSerial);
    }
    if (filterVBShipment) {
      result = result.filter((e) => e.VBShipmentNumber === filterVBShipment);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((e) =>
        [e.VBNumber, e.VBSerialNumber, e.VBShipmentNumber, e.comments, e.category, e.createdBy, e.type]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }

    return result;
  }, [data, filterType, filterStatus, filterVBNumber, filterVBSerial, filterVBShipment, searchQuery]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };

  const resolveUser = (email?: string) => {
    if (!email) return "System";
    return email.split("@")[0];
  };

  // Header
  useLayoutEffect(() => {
    const headerContent = (
      <div className="flex items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search actions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 w-[220px] rounded-md border border-input bg-background pl-8 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      </div>
    );
    setActions(headerContent);
    const timer = setTimeout(() => setActions(headerContent), 50);
    return () => { clearTimeout(timer); setActions(null); setLeftContent(null); };
  }, [setActions, setLeftContent, searchQuery]);

  // Status summary counts — must be before any early returns (React hooks rule)
  // Type counts for tabs
  const typeCounts = useMemo(() => {
    const c: Record<string, number> = { all: data.length };
    data.forEach((e) => { c[e.type] = (c[e.type] || 0) + 1; });
    return c;
  }, [data]);

  if (loading) return <TablePageSkeleton />;

  return (
    <div className="w-full h-full flex">
      <ActiveActionsGroupSidebar
        data={data}
        activeStatus={filterStatus}
        activeVBNumber={filterVBNumber}
        activeVBSerial={filterVBSerial}
        activeVBShipment={filterVBShipment}
        onSelect={(status, vb, ser, ship) => {
          setFilterStatus(status);
          setFilterVBNumber(vb);
          setFilterVBSerial(ser);
          setFilterVBShipment(ship);
        }}
      />
      <div className="flex-1 min-w-0 overflow-auto">
        {/* Type tabs */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-2.5">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              {/* All tab */}
              <button
                onClick={() => {
                  setFilterType(null);
                  setFilterStatus(null);
                  setFilterVBNumber(null);
                  setFilterVBSerial(null);
                  setFilterVBShipment(null);
                }}
                className={cn(
                  "rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all duration-200 flex items-center gap-1.5",
                  !filterType
                    ? "bg-primary/10 text-primary border-primary/30 shadow-sm"
                    : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                )}
              >
                <FileText className="h-3 w-3" />
                All ({typeCounts.all || 0})
              </button>

              {/* Type tabs */}
              {(["Notes", "Shipping", "Action Required"] as const).map((type) => {
                const isActive = filterType === type;
                const typeStyle = TYPE_COLORS[type] || "bg-muted text-muted-foreground border-border";
                const Icon = type === "Notes" ? MessageSquare : type === "Shipping" ? Ship : AlertCircle;
                return (
                  <button
                    key={type}
                    onClick={() => {
                      if (isActive) {
                        setFilterType(null);
                      } else {
                        setFilterType(type);
                      }
                      setFilterStatus(null);
                      setFilterVBNumber(null);
                      setFilterVBSerial(null);
                      setFilterVBShipment(null);
                    }}
                    className={cn(
                      "rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all duration-200 flex items-center gap-1.5",
                      isActive
                        ? `${typeStyle} shadow-sm`
                        : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    {type} ({typeCounts[type] || 0})
                  </button>
                );
              })}
            </div>

            {/* Active filter breadcrumb */}
            {(filterVBNumber || filterVBSerial || filterVBShipment) && (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                {filterVBNumber && (
                  <span className="font-semibold text-primary/70">{filterVBNumber}</span>
                )}
                {filterVBSerial && (
                  <>
                    {filterVBNumber && <span className="text-muted-foreground/40">/</span>}
                    <span className="font-medium">{filterVBSerial}</span>
                  </>
                )}
                {filterVBShipment && (
                  <>
                    {(filterVBNumber || filterVBSerial) && <span className="text-muted-foreground/40">/</span>}
                    <span className="font-medium text-violet-500">{filterVBShipment}</span>
                  </>
                )}
              </div>
            )}

            <div className="ml-auto text-[10px] text-muted-foreground font-mono">
              {filteredData.length} of {data.length}
            </div>
          </div>
        </div>

        {/* Entries table */}
        <div className="px-4 py-2">
          {filteredData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <FileText className="h-10 w-10 mb-3 text-muted-foreground/20" />
              <p className="text-sm font-medium">No entries found</p>
              <p className="text-xs mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10 bg-background">
                <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="text-left py-1.5 px-1.5 whitespace-nowrap">Status</th>
                  <th className="text-left py-1.5 px-1.5 whitespace-nowrap">Type</th>
                  <th className="text-left py-1.5 px-1.5 whitespace-nowrap">VB #</th>
                  <th className="text-left py-1.5 px-1.5 whitespace-nowrap">Serial #</th>
                  <th className="text-left py-1.5 px-1.5 whitespace-nowrap">Shipment #</th>
                  <th className="text-left py-1.5 px-1.5 whitespace-nowrap min-w-[120px]">Category</th>
                  <th className="text-left py-1.5 px-1.5 min-w-[250px]">Comments</th>
                  <th className="text-left py-1.5 px-1.5">Date</th>
                  <th className="text-left py-1.5 px-1.5">Reminder</th>
                  <th className="text-left py-1.5 px-1.5">By</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((entry) => {
                  const cfg = STATUS_CONFIG[entry.status || "Open"] || STATUS_CONFIG.Open;
                  const StatusIcon = cfg.icon;
                  const isClosed = entry.status === "Closed";

                  return (
                    <tr
                      key={entry._id}
                      onClick={() => setEditingEntry(entry)}
                      className={cn(
                        "border-b border-border/40 transition-colors hover:bg-muted/20 group cursor-pointer"
                      )}
                    >
                      {/* Status — clickable dropdown */}
                      <td className="py-2 px-1.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="relative inline-flex">
                          <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all", cfg.bg, cfg.color, cfg.border)}>
                            <StatusIcon className="h-2.5 w-2.5" />
                            {entry.status || "Open"}
                            <ChevronDown className="h-2.5 w-2.5 opacity-50" />
                          </span>
                          <select
                            value={entry.status || "Open"}
                            onChange={(e) => handleStatusChange(entry._id, e.target.value)}
                            className="absolute inset-0 w-full opacity-0 cursor-pointer"
                            aria-label="Change status"
                          >
                            <option value="Open">Open</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Closed">Closed</option>
                          </select>
                        </div>
                      </td>

                      {/* Type */}
                      <td className="py-2 px-1.5 whitespace-nowrap">
                        {(() => {
                          const TypeIcon = entry.type === "Notes" ? MessageSquare : entry.type === "Shipping" ? Ship : AlertCircle;
                          return (
                            <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md border", TYPE_COLORS[entry.type] || "bg-muted text-muted-foreground border-border")}>
                              <TypeIcon className="h-3 w-3" />
                              {entry.type}
                            </span>
                          );
                        })()}
                      </td>

                      {/* VBNumber */}
                      <td className="py-2 px-1.5 whitespace-nowrap">
                        <span className="font-semibold text-foreground">{entry._VBNumberDisplay || entry.VBNumber || "—"}</span>
                      </td>

                      {/* VBSerialNumber */}
                      <td className="py-2 px-1.5 whitespace-nowrap">
                        <span className="text-muted-foreground">{entry._VBSerialNumberDisplay || entry.VBSerialNumber || "—"}</span>
                      </td>

                      {/* VBShipmentNumber */}
                      <td className="py-2 px-1.5 whitespace-nowrap">
                        {(entry._VBShipmentNumberDisplay || entry.VBShipmentNumber) ? (
                          <span className="text-violet-600 dark:text-violet-400 font-medium">{entry._VBShipmentNumberDisplay || entry.VBShipmentNumber}</span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>

                      {/* Category */}
                      <td className="py-2 px-1.5">
                        {entry.category ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Tag className="h-2.5 w-2.5" />
                            {entry.category}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>

                      {/* Comments */}
                      <td className="py-2 px-1.5">
                        <p className="text-foreground/80" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{entry.comments || "—"}</p>
                      </td>

                      {/* Date */}
                      <td className="py-2 px-1.5 text-muted-foreground whitespace-nowrap">
                        {formatDate(entry.date || entry.timestamp)}
                      </td>

                      {/* Reminder — clickable date picker if not Closed */}
                      <td className="py-2 px-1.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {isClosed ? (
                          entry.reminder ? (
                            <span className="inline-flex items-center gap-1 text-muted-foreground/50">
                              <CalendarClock className="h-3 w-3" />
                              {formatDate(entry.reminder)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )
                        ) : (
                          <div className="relative inline-flex cursor-pointer group/rem">
                            {entry.reminder ? (
                              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 cursor-pointer hover:underline">
                                <CalendarClock className="h-3 w-3" />
                                {formatDate(entry.reminder)}
                                <Pencil className="h-2.5 w-2.5 opacity-0 group-hover/rem:opacity-60 transition-opacity" />
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-muted-foreground/40 hover:text-primary/60 cursor-pointer transition-colors">
                                <CalendarClock className="h-3 w-3" />
                                <span className="text-[10px]">Set</span>
                              </span>
                            )}
                            <input
                              type="date"
                              value={entry.reminder ? new Date(entry.reminder).toISOString().split("T")[0] : ""}
                              onChange={(e) => handleReminderChange(entry._id, e.target.value)}
                              className="absolute inset-0 w-full opacity-0 cursor-pointer"
                              aria-label="Set reminder date"
                            />
                          </div>
                        )}
                      </td>

                      {/* Created By */}
                      <td className="py-2 px-1.5">
                        <span className="inline-flex items-center gap-1 text-muted-foreground whitespace-nowrap">
                          <User className="h-3 w-3" />
                          {resolveUser(entry.createdBy)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Edit Dialog */}
      <TimelineEntryDialog
        open={!!editingEntry}
        entry={editingEntry}
        onClose={() => setEditingEntry(null)}
        onSaved={() => { setEditingEntry(null); fetchData(); }}
        onDelete={(id) => {
          setEditingEntry(null);
          handleDelete(id);
        }}
      />
    </div>
  );
}
