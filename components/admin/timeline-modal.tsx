"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
    Plus,
    Search,
    MessageSquare,
    AlertTriangle,
    Ship,
    Trash2,
    Clock,
    CalendarDays,
    Tag,
    Pencil,
    Bot,
} from "lucide-react";

interface TimelineEntry {
    _id: string;
    vbpoNo?: string;
    poNo?: string;
    svbid?: string;
    date?: string;
    reminder?: string;
    type: string;
    comments?: string;
    status?: string;
    category?: string;
    createdBy?: string;
    timestamp: string;
}

interface TimelineModalProps {
    open: boolean;
    onClose: () => void;
    vbpoNo?: string;
    poNo?: string;
    svbid?: string;
    title?: string;
    users?: Record<string, string>;
}

const TYPE_OPTIONS = ["Notes", "Shipping Status", "Action Required"];

const CATEGORY_OPTIONS = [
    "Arrival Notice",
    "Trucker Notified Date",
    "Supplier Invoice",
    "Packing List",
    "Certificate Of Origin",
    "Bill Of Lading",
    "Drayage Assigned",
    "Certificate Of Analysis",
    "Customs Status",
    "Manufacturer Security ISF",
    "VB ISF Filing",
    "Documents To Broker",
    "Delivery Order Created",
    "Genset Required",
    "Collect Fees Paid",
];

const TYPE_ICONS: Record<string, React.ReactNode> = {
    Notes: <MessageSquare className="h-3.5 w-3.5" />,
    "Shipping Status": <Ship className="h-3.5 w-3.5" />,
    "Action Required": <AlertTriangle className="h-3.5 w-3.5" />,
};

const TYPE_COLORS: Record<string, string> = {
    Notes:
        "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800",
    "Shipping Status":
        "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800",
    "Action Required":
        "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
};

export default function TimelineModal({
    open,
    onClose,
    vbpoNo,
    poNo,
    svbid,
    title,
    users = {},
}: TimelineModalProps) {
    const [entries, setEntries] = useState<TimelineEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [showAddForm, setShowAddForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [customCategory, setCustomCategory] = useState("");
    const [showCustomCategory, setShowCustomCategory] = useState(false);
    const [editingEntry, setEditingEntry] = useState<TimelineEntry | null>(null);

    // Form state
    const [formType, setFormType] = useState("Notes");
    const [formCategory, setFormCategory] = useState("");
    const [formComments, setFormComments] = useState("");
    const [formDate, setFormDate] = useState(
        new Date().toISOString().split("T")[0]
    );
    const [formReminder, setFormReminder] = useState("");
    const [formStatus, setFormStatus] = useState("Open");

    const fetchEntries = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (vbpoNo) params.set("vbpoNo", vbpoNo);
            if (poNo) params.set("poNo", poNo);
            if (svbid) params.set("svbid", svbid);

            const res = await fetch(`/api/admin/timeline?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setEntries(data);
            }
        } catch {
            toast.error("Failed to load timeline");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open) {
            fetchEntries();
            setShowAddForm(false);
            setSearch("");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, vbpoNo, poNo, svbid]);

    const handleAdd = async () => {
        setSaving(true);
        try {
            const body: any = {
                type: formType,
                category: showCustomCategory ? customCategory : formCategory,
                comments: formComments,
                date: formDate || undefined,
                reminder: formReminder || undefined,
                status: formStatus,
            };
            if (vbpoNo) body.vbpoNo = vbpoNo;
            if (poNo) body.poNo = poNo;
            if (svbid) body.svbid = svbid;

            const res = await fetch("/api/admin/timeline", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (!res.ok) throw new Error();
            toast.success("Timeline entry added");
            setShowAddForm(false);
            resetForm();
            fetchEntries();
        } catch {
            toast.error("Failed to add entry");
        } finally {
            setSaving(false);
        }
    };

    const handleUpdate = async () => {
        if (!editingEntry) return;
        setSaving(true);
        try {
            const body: any = {
                type: formType,
                category: showCustomCategory ? customCategory : formCategory,
                comments: formComments,
                date: formDate || undefined,
                reminder: formReminder || undefined,
                status: formStatus,
            };

            const res = await fetch(`/api/admin/timeline/${editingEntry._id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (!res.ok) throw new Error();
            toast.success("Timeline entry updated");
            setShowAddForm(false);
            setEditingEntry(null);
            resetForm();
            fetchEntries();
        } catch {
            toast.error("Failed to update entry");
        } finally {
            setSaving(false);
        }
    };

    const startEdit = (entry: TimelineEntry) => {
        setEditingEntry(entry);
        setFormType(entry.type);
        setFormCategory(entry.category || "");
        setFormComments(entry.comments || "");
        setFormDate(entry.date ? new Date(entry.date).toISOString().split("T")[0] : "");
        setFormReminder(entry.reminder ? new Date(entry.reminder).toISOString().split("T")[0] : "");
        setFormStatus(entry.status || "Open");
        setShowAddForm(true);
        setShowCustomCategory(false);
        setCustomCategory("");
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this timeline entry?")) return;
        try {
            const res = await fetch(`/api/admin/timeline/${id}`, {
                method: "DELETE",
            });
            if (!res.ok) throw new Error();
            toast.success("Entry deleted");
            setEntries((prev) => prev.filter((e) => e._id !== id));
        } catch {
            toast.error("Failed to delete");
        }
    };

    const resetForm = () => {
        setFormType("Notes");
        setFormCategory("");
        setFormComments("");
        setFormDate(new Date().toISOString().split("T")[0]);
        setFormReminder("");
        setFormStatus("Open");
        setCustomCategory("");
        setShowCustomCategory(false);
        setEditingEntry(null);
    };

    // Filter entries
    const filtered = useMemo(() => {
        if (!search) return entries;
        const q = search.toLowerCase();
        return entries.filter(
            (e) =>
                e.comments?.toLowerCase().includes(q) ||
                e.type?.toLowerCase().includes(q) ||
                e.category?.toLowerCase().includes(q) ||
                e.createdBy?.toLowerCase().includes(q)
        );
    }, [entries, search]);

    // Group by date
    const grouped = useMemo(() => {
        const groups: Record<string, TimelineEntry[]> = {};
        filtered.forEach((entry) => {
            const d = entry.timestamp
                ? new Date(entry.timestamp).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                })
                : "Unknown Date";
            if (!groups[d]) groups[d] = [];
            groups[d].push(entry);
        });
        return groups;
    }, [filtered]);

    const resolveUser = (email?: string) => {
        if (!email) return "System";
        return users[email.toLowerCase()] || email.split("@")[0];
    };

    const displayTitle =
        title ||
        (svbid
            ? `Timeline — ${svbid}`
            : poNo
                ? `Timeline — ${poNo}`
                : vbpoNo
                    ? `Timeline — ${vbpoNo}`
                    : "Timeline");

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-[950px] h-[80vh] p-0 gap-0 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-5 pt-5 pb-3 border-b space-y-3">
                    <DialogHeader>
                        <DialogTitle className="text-base flex items-center gap-2">
                            <Clock className="h-4 w-4 text-primary" />
                            {displayTitle}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search timeline..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="h-7 w-full pl-8 pr-3 rounded-md border border-input bg-background text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            />
                        </div>
                        <Button
                            size="sm"
                            className="h-7 px-3 text-xs"
                            onClick={() => { setEditingEntry(null); resetForm(); setShowAddForm(!showAddForm); }}
                        >
                            <Plus className="h-3 w-3 mr-1" />
                            Add
                        </Button>
                    </div>
                </div>

                {/* Add Form */}
                {showAddForm && (
                    <div className="px-5 py-3 border-b bg-muted/30 space-y-3">
                        <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1">
                                <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                    Type
                                </Label>
                                <select
                                    value={formType}
                                    onChange={(e) => setFormType(e.target.value)}
                                    className="w-full h-8 border rounded-md px-2 text-xs bg-background"
                                >
                                    {TYPE_OPTIONS.map((t) => (
                                        <option key={t} value={t}>
                                            {t}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                    Category
                                </Label>
                                {showCustomCategory ? (
                                    <div className="flex gap-1">
                                        <Input
                                            value={customCategory}
                                            onChange={(e) => setCustomCategory(e.target.value)}
                                            placeholder="Custom category..."
                                            className="h-8 text-xs"
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 px-2 text-[10px]"
                                            onClick={() => {
                                                setShowCustomCategory(false);
                                                setCustomCategory("");
                                            }}
                                        >
                                            ✕
                                        </Button>
                                    </div>
                                ) : (
                                    <select
                                        value={formCategory}
                                        onChange={(e) => {
                                            if (e.target.value === "__add_new__") {
                                                setShowCustomCategory(true);
                                                setFormCategory("");
                                            } else {
                                                setFormCategory(e.target.value);
                                            }
                                        }}
                                        className="w-full h-8 border rounded-md px-2 text-xs bg-background"
                                    >
                                        <option value="">Select category...</option>
                                        {CATEGORY_OPTIONS.map((c) => (
                                            <option key={c} value={c}>
                                                {c}
                                            </option>
                                        ))}
                                        <option value="__add_new__">＋ Add New...</option>
                                    </select>
                                )}
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                    Status
                                </Label>
                                <select
                                    value={formStatus}
                                    onChange={(e) => setFormStatus(e.target.value)}
                                    className="w-full h-8 border rounded-md px-2 text-xs bg-background"
                                >
                                    <option value="Open">Open</option>
                                    <option value="In Progress">In Progress</option>
                                    <option value="Completed">Completed</option>
                                    <option value="Closed">Closed</option>
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                    Date
                                </Label>
                                <Input
                                    type="date"
                                    value={formDate}
                                    onChange={(e) => setFormDate(e.target.value)}
                                    className="h-8 text-xs"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                    Reminder
                                </Label>
                                <Input
                                    type="date"
                                    value={formReminder}
                                    onChange={(e) => setFormReminder(e.target.value)}
                                    className="h-8 text-xs"
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Comments
                            </Label>
                            <textarea
                                value={formComments}
                                onChange={(e) => setFormComments(e.target.value)}
                                placeholder="Add details, notes, or context..."
                                className="w-full min-h-[60px] border rounded-md px-3 py-2 text-xs bg-background resize-y"
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => {
                                    setShowAddForm(false);
                                    setEditingEntry(null);
                                    resetForm();
                                }}
                            >
                                Cancel
                            </Button>
                            <Button
                                size="sm"
                                className="h-7 text-xs"
                                onClick={editingEntry ? handleUpdate : handleAdd}
                                disabled={saving || !formComments.trim()}
                            >
                                {saving ? "Saving..." : editingEntry ? "Update Entry" : "Add Entry"}
                            </Button>
                        </div>
                    </div>
                )}

                {/* Timeline Table Content */}
                <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-muted">
                    {loading ? (
                        <div className="flex items-center justify-center h-32 text-xs text-muted-foreground">
                            Loading timeline...
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
                            <Clock className="h-8 w-8 opacity-30" />
                            <span className="text-xs">
                                No timeline entries yet. Click &quot;Add&quot; to create one.
                            </span>
                        </div>
                    ) : (
                        <table className="w-full text-xs">
                            <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
                                <tr className="border-b">
                                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">Date</th>
                                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">Type</th>
                                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">Category</th>
                                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Comments</th>
                                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">Status</th>
                                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">Reminder</th>
                                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">Created By</th>
                                    <th className="w-14 px-2 py-2"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((entry) => {
                                    const isSystem = entry.createdBy === "System";
                                    return (
                                        <tr
                                            key={entry._id}
                                            className={`group border-b border-border/50 hover:bg-muted/30 transition-colors ${isSystem ? "bg-muted/10" : ""}`}
                                        >
                                            <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                                                {entry.date
                                                    ? new Date(entry.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                                                    : entry.timestamp
                                                        ? new Date(entry.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                                                        : "—"}
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                <span
                                                    className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${TYPE_COLORS[entry.type] || "bg-muted"}`}
                                                >
                                                    {TYPE_ICONS[entry.type]}
                                                    {entry.type}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                                                {entry.category || "—"}
                                            </td>
                                            <td className={`px-3 py-2 max-w-[260px] truncate ${isSystem ? "italic text-muted-foreground" : ""}`} title={entry.comments}>
                                                {entry.comments || "—"}
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                <span
                                                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${entry.status === "Completed"
                                                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                                            : entry.status === "In Progress"
                                                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                                                                : entry.status === "Closed"
                                                                    ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                                                                    : "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400"
                                                        }`}
                                                >
                                                    {entry.status || "Open"}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                                                {entry.reminder ? (
                                                    <span className="text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                                                        🔔 {new Date(entry.reminder).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                                    </span>
                                                ) : "—"}
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                                                {isSystem ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-violet-600 dark:text-violet-400">
                                                        <Bot className="h-3 w-3" />
                                                        System
                                                    </span>
                                                ) : resolveUser(entry.createdBy)}
                                            </td>
                                            <td className="px-2 py-2">
                                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {!isSystem && (
                                                        <button
                                                            onClick={() => startEdit(entry)}
                                                            className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-primary hover:bg-primary/10"
                                                        >
                                                            <Pencil className="h-3 w-3" />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleDelete(entry._id)}
                                                        className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer Stats */}
                <div className="px-5 py-2 border-t bg-muted/20 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>
                        {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
                        {search && ` matching "${search}"`}
                    </span>
                    <div className="flex gap-3">
                        {TYPE_OPTIONS.map((t) => {
                            const count = filtered.filter((e) => e.type === t).length;
                            if (count === 0) return null;
                            return (
                                <span key={t} className="flex items-center gap-1">
                                    {TYPE_ICONS[t]}
                                    {count}
                                </span>
                            );
                        })}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
