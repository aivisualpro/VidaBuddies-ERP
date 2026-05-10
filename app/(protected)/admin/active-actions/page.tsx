"use client";

import { useEffect, useState, useMemo, useLayoutEffect } from "react";
import { toast } from "sonner";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import { ActiveActionsGroupSidebar } from "@/components/admin/active-actions-sidebar";
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
  Trash2,
  Plus,
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
  Done: { label: "Done", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", icon: CheckCircle2 },
};

const TYPE_COLORS: Record<string, string> = {
  Notes: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
  "Shipping Status": "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  "Action Required": "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
};

export default function ActiveActionsPage() {
  const { setActions, setLeftContent } = useHeaderActions();
  const [data, setData] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Sidebar filter state
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterVBNumber, setFilterVBNumber] = useState<string | null>(null);
  const [filterVBSerial, setFilterVBSerial] = useState<string | null>(null);
  const [filterVBShipment, setFilterVBShipment] = useState<string | null>(null);

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

  const handleStatusToggle = async (entry: TimelineEntry) => {
    const nextStatus = entry.status === "Done" ? "Open" : "Done";
    try {
      const res = await fetch(`/api/admin/timeline/${entry._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(`Marked as ${nextStatus}`);
      fetchData();
    } catch {
      toast.error("Failed to update");
    }
  };

  // Filter data based on sidebar selection + search
  const filteredData = useMemo(() => {
    let result = data;

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
  }, [data, filterStatus, filterVBNumber, filterVBSerial, filterVBShipment, searchQuery]);

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
  const statusCounts = useMemo(() => {
    const c: Record<string, number> = {};
    data.forEach((e) => { const s = e.status || "Open"; c[s] = (c[s] || 0) + 1; });
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
        {/* Summary pills */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-2.5">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                const count = statusCounts[key] || 0;
                const isActive = filterStatus === key;
                return (
                  <button
                    key={key}
                    onClick={() => {
                      if (isActive) {
                        setFilterStatus(null);
                        setFilterVBNumber(null);
                        setFilterVBSerial(null);
                        setFilterVBShipment(null);
                      } else {
                        setFilterStatus(key);
                        setFilterVBNumber(null);
                        setFilterVBSerial(null);
                        setFilterVBShipment(null);
                      }
                    }}
                    className={cn(
                      "rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all duration-200 flex items-center gap-1.5",
                      isActive
                        ? `${cfg.bg} ${cfg.color} ${cfg.border} shadow-sm`
                        : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                    )}
                  >
                    <cfg.icon className="h-3 w-3" />
                    {cfg.label} ({count})
                  </button>
                );
              })}
            </div>

            {/* Active filter breadcrumb */}
            {filterStatus && (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <span className="font-bold text-foreground/60">{filterStatus}</span>
                {filterVBNumber && (
                  <>
                    <span className="text-muted-foreground/40">/</span>
                    <span className="font-semibold text-primary/70">{filterVBNumber}</span>
                  </>
                )}
                {filterVBSerial && (
                  <>
                    <span className="text-muted-foreground/40">/</span>
                    <span className="font-medium">{filterVBSerial}</span>
                  </>
                )}
                {filterVBShipment && (
                  <>
                    <span className="text-muted-foreground/40">/</span>
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
              <thead>
                <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="text-left py-2 px-2 w-8"></th>
                  <th className="text-left py-2 px-2">Status</th>
                  <th className="text-left py-2 px-2">Type</th>
                  <th className="text-left py-2 px-2">VB #</th>
                  <th className="text-left py-2 px-2">Serial #</th>
                  <th className="text-left py-2 px-2">Shipment #</th>
                  <th className="text-left py-2 px-2">Category</th>
                  <th className="text-left py-2 px-2 min-w-[250px]">Comments</th>
                  <th className="text-left py-2 px-2">Date</th>
                  <th className="text-left py-2 px-2">Reminder</th>
                  <th className="text-left py-2 px-2">By</th>
                  <th className="text-right py-2 px-2 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((entry) => {
                  const cfg = STATUS_CONFIG[entry.status || "Open"] || STATUS_CONFIG.Open;
                  const StatusIcon = cfg.icon;
                  const isDone = entry.status === "Done";

                  return (
                    <tr
                      key={entry._id}
                      className={cn(
                        "border-b border-border/40 transition-colors hover:bg-muted/20 group",
                        isDone && "opacity-50"
                      )}
                    >
                      {/* Toggle */}
                      <td className="py-2 px-2">
                        <button
                          onClick={() => handleStatusToggle(entry)}
                          className={cn(
                            "h-5 w-5 rounded-md border-2 flex items-center justify-center transition-all",
                            isDone
                              ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-500"
                              : "border-border hover:border-primary/50 text-transparent hover:text-primary/30"
                          )}
                        >
                          <CheckCircle2 className="h-3 w-3" />
                        </button>
                      </td>

                      {/* Status */}
                      <td className="py-2 px-2">
                        <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border", cfg.bg, cfg.color, cfg.border)}>
                          <StatusIcon className="h-2.5 w-2.5" />
                          {entry.status || "Open"}
                        </span>
                      </td>

                      {/* Type */}
                      <td className="py-2 px-2">
                        <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-md border", TYPE_COLORS[entry.type] || "bg-muted text-muted-foreground border-border")}>
                          {entry.type}
                        </span>
                      </td>

                      {/* VBNumber */}
                      <td className="py-2 px-2">
                        <span className="font-semibold text-foreground">{entry._VBNumberDisplay || entry.VBNumber || "—"}</span>
                      </td>

                      {/* VBSerialNumber */}
                      <td className="py-2 px-2">
                        <span className="text-muted-foreground">{entry._VBSerialNumberDisplay || entry.VBSerialNumber || "—"}</span>
                      </td>

                      {/* VBShipmentNumber */}
                      <td className="py-2 px-2">
                        {(entry._VBShipmentNumberDisplay || entry.VBShipmentNumber) ? (
                          <span className="text-violet-600 dark:text-violet-400 font-medium">{entry._VBShipmentNumberDisplay || entry.VBShipmentNumber}</span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>

                      {/* Category */}
                      <td className="py-2 px-2">
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
                      <td className="py-2 px-2">
                        <p className={cn("text-foreground/80 line-clamp-2", isDone && "line-through")}>{entry.comments || "—"}</p>
                      </td>

                      {/* Date */}
                      <td className="py-2 px-2 text-muted-foreground whitespace-nowrap">
                        {formatDate(entry.date || entry.timestamp)}
                      </td>

                      {/* Reminder */}
                      <td className="py-2 px-2">
                        {entry.reminder ? (
                          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 whitespace-nowrap">
                            <CalendarClock className="h-3 w-3" />
                            {formatDate(entry.reminder)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>

                      {/* Created By */}
                      <td className="py-2 px-2">
                        <span className="inline-flex items-center gap-1 text-muted-foreground whitespace-nowrap">
                          <User className="h-3 w-3" />
                          {resolveUser(entry.createdBy)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-2 px-2 text-right">
                        <button
                          onClick={() => handleDelete(entry._id)}
                          className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
