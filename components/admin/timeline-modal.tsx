"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { TimelineEntryDialog } from "@/components/admin/timeline-entry-dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
    Plus,
    Search,
    MessageSquare,
    AlertTriangle,
    Ship,
    Trash2,
    Clock,
    Pencil,
    Bot,
    Package,
    Anchor,
} from "lucide-react";
import { useUserDataStore } from "@/store/useUserDataStore";

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

interface TimelineModalProps {
    open: boolean;
    onClose: () => void;
    VBNumber?: string;
    VBSerialNumber?: string;
    VBShipmentNumber?: string;
    title?: string;
    users?: Record<string, string>;
}

const TYPE_OPTIONS = ["Notes", "Shipping", "Action Required"];

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
    Shipping: <Ship className="h-3.5 w-3.5" />,
    "Action Required": <AlertTriangle className="h-3.5 w-3.5" />,
};

const TYPE_COLORS: Record<string, string> = {
    Notes:
        "bg-slate-500/10 text-slate-600 border-slate-500/20 dark:text-slate-400",
    Shipping:
        "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400",
    "Action Required":
        "bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400",
};

// ---- Hierarchy types (use display names as values, matching what timeline stores) ----
interface POOption { value: string; label: string; }
interface CPOOption { value: string; label: string; parentVBNumber: string; }
interface ShipOption { value: string; label: string; parentVBNumber: string; parentSerial: string; }

// ---- Table rows ----
function TimelineTable({
    entries,
    resolveUser,
    onEdit,
    onDelete,
    poOptions,
    cpoOptions,
    shipOptions,
    onFieldChange,
    resolveVBNumber,
    resolveSerial,
    resolveShip,
}: {
    entries: TimelineEntry[];
    resolveUser: (email?: string) => string;
    onEdit: (entry: TimelineEntry) => void;
    onDelete: (id: string) => void;
    poOptions: { value: string; label: string }[];
    cpoOptions: CPOOption[];
    shipOptions: ShipOption[];
    onFieldChange: (id: string, field: string, value: string, cascadeClear?: string[]) => void;
    resolveVBNumber: (raw?: string) => string;
    resolveSerial: (raw?: string) => string;
    resolveShip: (raw?: string) => string;
}) {
    if (entries.length === 0) return null;
    return (
        <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
                <tr className="border-b">
                    <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground whitespace-nowrap">VBNumber</th>
                    <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground whitespace-nowrap">Serial #</th>
                    <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground whitespace-nowrap">Shipment #</th>
                    <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground whitespace-nowrap">Date</th>
                    <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground whitespace-nowrap">Type</th>
                    <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground whitespace-nowrap">Category</th>
                    <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground" style={{ minWidth: 160 }}>Comments</th>
                    <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground whitespace-nowrap">Status</th>
                    <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground whitespace-nowrap">Reminder</th>
                    <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground whitespace-nowrap">Created By</th>
                    <th className="w-14 px-2 py-1.5"></th>
                </tr>
            </thead>
            <tbody>
                {entries.map((entry) => {
                    const isSystem = entry.createdBy === "System";
                    // Raw ObjectId strings for matching dropdown option values
                    const rawVB = entry.VBNumber?.toString() || "";
                    const rawSerial = entry.VBSerialNumber?.toString() || "";
                    const rawShip = entry.VBShipmentNumber?.toString() || "";

                    // Resolved display names for cascading filters
                    const displayVB = entry._VBNumberDisplay || resolveVBNumber(rawVB);
                    const displaySerial = entry._VBSerialNumberDisplay || resolveSerial(rawSerial);

                    // Cascading by ObjectId references (also handle display-string VBNumbers)
                    // rawVB may be an ObjectId or a display name; resolve to ObjectId for matching
                    const isObjectId = rawVB && poOptions.some(p => p.value === rawVB);
                    const resolvedVBId = isObjectId
                        ? rawVB
                        : rawVB ? (poOptions.find(p => p.label === rawVB)?.value || rawVB) : "";
                    let filteredCPOs = resolvedVBId
                        ? cpoOptions.filter(c => c.parentVBNumber === resolvedVBId || c.parentVBNumber === rawVB)
                        : cpoOptions;
                    // Fallback: if no CPOs matched by parent and rawVB looks like a display name,
                    // show CPOs whose label matches or starts with the display name
                    if (filteredCPOs.length === 0 && rawVB && !isObjectId) {
                        filteredCPOs = cpoOptions.filter(c => c.label === rawVB || c.label.startsWith(rawVB + "-"));
                    }
                    const filteredShips = rawSerial
                        ? shipOptions.filter(s => s.parentSerial === rawSerial)
                        : resolvedVBId
                            ? shipOptions.filter(s => s.parentVBNumber === resolvedVBId || s.parentVBNumber === rawVB)
                            : shipOptions;

                    return (
                        <tr key={entry._id} className={`group border-b border-border/50 hover:bg-muted/30 transition-colors ${isSystem ? "bg-muted/10" : ""}`}>
                            {/* VBNumber — searchable */}
                            <td className="px-1 py-1 align-top" style={{ minWidth: 110 }}>
                                <SearchableSelect
                                    options={poOptions}
                                    value={rawVB}
                                    onChange={(v) => onFieldChange(entry._id, "VBNumber", v, ["VBSerialNumber", "VBShipmentNumber"])}
                                    placeholder="—"
                                    searchPlaceholder="Search VB#..."
                                    className="h-6 text-[10px] px-1.5 min-w-[100px]"
                                    allowClear
                                />
                            </td>
                            {/* VBSerialNumber — searchable, cascaded */}
                            <td className="px-1 py-1 align-top" style={{ minWidth: 110 }}>
                                <SearchableSelect
                                    options={filteredCPOs}
                                    value={rawSerial}
                                    onChange={(v) => onFieldChange(entry._id, "VBSerialNumber", v, ["VBShipmentNumber"])}
                                    placeholder="—"
                                    searchPlaceholder="Search Serial..."
                                    className="h-6 text-[10px] px-1.5 min-w-[100px]"
                                    allowClear
                                />
                            </td>
                            {/* VBShipmentNumber — searchable, cascaded */}
                            <td className="px-1 py-1 align-top" style={{ minWidth: 120 }}>
                                <SearchableSelect
                                    options={filteredShips}
                                    value={rawShip}
                                    onChange={(v) => onFieldChange(entry._id, "VBShipmentNumber", v)}
                                    placeholder="—"
                                    searchPlaceholder="Search Shipment..."
                                    className="h-6 text-[10px] px-1.5 min-w-[100px]"
                                    allowClear
                                />
                            </td>
                            <td className="px-2 py-2 whitespace-nowrap text-muted-foreground align-top">
                                {entry.date
                                    ? new Date(entry.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                                    : entry.timestamp
                                        ? new Date(entry.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                                        : "—"}
                            </td>
                            <td className="px-2 py-2 whitespace-nowrap align-top">
                                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border ${TYPE_COLORS[entry.type] || "bg-muted text-muted-foreground border-border"}`}>
                                    {TYPE_ICONS[entry.type]}
                                    {entry.type}
                                </span>
                            </td>
                            <td className="px-2 py-2 whitespace-nowrap text-muted-foreground align-top">
                                {entry.category || "—"}
                            </td>
                            <td className={`px-2 py-2 align-top ${isSystem ? "italic text-muted-foreground" : ""}`} style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                                {entry.comments || "—"}
                            </td>
                            <td className="px-2 py-2 whitespace-nowrap align-top">
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${entry.status === "In Progress" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                                    : entry.status === "Closed" ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                                        : "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400"
                                    }`}>
                                    {entry.status || "Open"}
                                </span>
                            </td>
                            <td className="px-2 py-2 whitespace-nowrap text-muted-foreground align-top">
                                {entry.reminder ? (
                                    <span className="text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                                        🔔 {new Date(entry.reminder).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                    </span>
                                ) : "—"}
                            </td>
                            <td className="px-2 py-2 whitespace-nowrap text-muted-foreground align-top">
                                {isSystem ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-violet-600 dark:text-violet-400">
                                        <Bot className="h-3 w-3" /> System
                                    </span>
                                ) : resolveUser(entry.createdBy)}
                            </td>
                            <td className="px-2 py-2 align-top">
                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {!isSystem && (
                                        <button onClick={() => onEdit(entry)} className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-primary hover:bg-primary/10">
                                            <Pencil className="h-3 w-3" />
                                        </button>
                                    )}
                                    <button onClick={() => onDelete(entry._id)} className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                                        <Trash2 className="h-3 w-3" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}

// ---- Main Component ----
export default function TimelineModal({
    open,
    onClose,
    VBNumber,
    VBSerialNumber,
    VBShipmentNumber,
    title,
    users = {},
}: TimelineModalProps) {
    const [entries, setEntries] = useState<TimelineEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [editingEntry, setEditingEntry] = useState<TimelineEntry | null>(null);
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [sidebarSelection, setSidebarSelection] = useState<string>("all");

    // ── Hierarchy data from store + standalone collections ──
    const { purchaseOrders } = useUserDataStore();

    // Fetch standalone CPOs and shippings from separate collections
    const [standaloneCPOs, setStandaloneCPOs] = useState<any[]>([]);
    const [standaloneShips, setStandaloneShips] = useState<any[]>([]);

    useEffect(() => {
        if (!open) return;
        fetchHierarchy();
    }, [open]);

    const fetchHierarchy = () => {
        Promise.all([
            fetch("/api/admin/vb-customer-po").then(r => r.json()).catch(() => []),
            fetch("/api/admin/vb-shipping").then(r => r.json()).catch(() => []),
        ]).then(([cpos, ships]) => {
            setStandaloneCPOs(Array.isArray(cpos) ? cpos : []);
            setStandaloneShips(Array.isArray(ships) ? ships : []);
        });
    };

    // Build PO id→display map
    const poIdToDisplay = useMemo(() => {
        const m: Record<string, string> = {};
        (purchaseOrders || []).forEach((po: any) => {
            const id = po._id?.toString() || "";
            const display = po.VBNumber || "";
            if (id && display) { m[id] = display; m[display] = display; }
        });
        return m;
    }, [purchaseOrders]);

    // Resolve any stored value (ObjectId or display name) to display name
    const resolveVBNumber = useCallback((raw?: string) => raw ? (poIdToDisplay[raw] || raw) : "", [poIdToDisplay]);

    // Build id→display maps for serials (from BOTH embedded and standalone)
    const idToSerial = useMemo(() => {
        const m: Record<string, string> = {};
        // From embedded
        (purchaseOrders || []).forEach((po: any) => {
            if (po.customerPO && Array.isArray(po.customerPO)) {
                po.customerPO.forEach((cpo: any) => {
                    const id = cpo._id?.toString() || "";
                    const display = cpo.VBSerialNumber || cpo.poNo || "";
                    if (id && display) { m[id] = display; m[display] = display; }
                });
            }
        });
        // From standalone
        standaloneCPOs.forEach((cpo: any) => {
            const id = cpo._id?.toString() || "";
            const display = cpo.VBSerialNumber || cpo.poNo || "";
            if (id && display) { m[id] = display; m[display] = display; }
        });
        return m;
    }, [purchaseOrders, standaloneCPOs]);

    const idToShip = useMemo(() => {
        const m: Record<string, string> = {};
        // From embedded
        (purchaseOrders || []).forEach((po: any) => {
            if (po.customerPO && Array.isArray(po.customerPO)) {
                po.customerPO.forEach((cpo: any) => {
                    if (cpo.shipping && Array.isArray(cpo.shipping)) {
                        cpo.shipping.forEach((ship: any) => {
                            const id = ship._id?.toString() || "";
                            const display = ship.svbid || ship.VBShipmentNumber || "";
                            if (id && display) { m[id] = display; m[display] = display; }
                        });
                    }
                });
            }
        });
        // From standalone
        standaloneShips.forEach((ship: any) => {
            const id = ship._id?.toString() || "";
            const display = ship.svbid || ship.VBShipmentNumber || "";
            if (id && display) { m[id] = display; m[display] = display; }
        });
        return m;
    }, [purchaseOrders, standaloneShips]);

    const resolveSerial = useCallback((raw?: string) => raw ? (idToSerial[raw] || raw) : "", [idToSerial]);
    const resolveShip = useCallback((raw?: string) => raw ? (idToShip[raw] || raw) : "", [idToShip]);

    // PO options (from store)
    const poOptions = useMemo<POOption[]>(() => {
        const seen = new Set<string>();
        return (purchaseOrders || []).map((po: any) => {
            const display = po.VBNumber || "";
            return { value: po._id?.toString() || display, label: display };
        }).filter((p: POOption) => {
            if (!p.value || seen.has(p.value)) return false;
            seen.add(p.value); return true;
        }).sort((a: POOption, b: POOption) => a.label.localeCompare(b.label));
    }, [purchaseOrders]);

    // CPO options: merge embedded + standalone, deduplicated by display name
    const cpoOptions = useMemo<CPOOption[]>(() => {
        const seen = new Set<string>();
        const list: CPOOption[] = [];
        const addCPO = (cpoId: string, serialDisplay: string, parentVBId: string) => {
            if (!cpoId || seen.has(cpoId)) return;
            seen.add(cpoId);
            list.push({ value: cpoId, label: serialDisplay, parentVBNumber: parentVBId });
        };
        // From embedded PO.customerPO
        (purchaseOrders || []).forEach((po: any) => {
            const poId = po._id?.toString() || "";
            if (po.customerPO && Array.isArray(po.customerPO)) {
                po.customerPO.forEach((cpo: any) => {
                    addCPO(cpo._id?.toString() || "", cpo.VBSerialNumber || cpo.poNo || "", poId);
                });
            }
        });
        // From standalone vbcustomerpos collection
        standaloneCPOs.forEach((cpo: any) => {
            const poId = cpo.VBNumber?.toString() || "";
            addCPO(cpo._id?.toString() || "", cpo.VBSerialNumber || cpo.poNo || "", poId);
        });
        return list.filter(c => c.value && c.label);
    }, [purchaseOrders, standaloneCPOs]);

    // Ship options: merge embedded + standalone, deduplicated
    const shipOptions = useMemo<ShipOption[]>(() => {
        const seen = new Set<string>();
        const list: ShipOption[] = [];
        const addShip = (shipId: string, shipDisplay: string, parentVBId: string, parentSerialId: string) => {
            if (!shipId || seen.has(shipId)) return;
            seen.add(shipId);
            list.push({ value: shipId, label: shipDisplay, parentVBNumber: parentVBId, parentSerial: parentSerialId });
        };
        // From embedded
        (purchaseOrders || []).forEach((po: any) => {
            const poId = po._id?.toString() || "";
            if (po.customerPO && Array.isArray(po.customerPO)) {
                po.customerPO.forEach((cpo: any) => {
                    const cpoId = cpo._id?.toString() || "";
                    if (cpo.shipping && Array.isArray(cpo.shipping)) {
                        cpo.shipping.forEach((ship: any) => {
                            addShip(ship._id?.toString() || "", ship.svbid || ship.VBShipmentNumber || "", poId, cpoId);
                        });
                    }
                });
            }
        });
        // From standalone vbshippings
        standaloneShips.forEach((ship: any) => {
            const shipId = ship._id?.toString() || "";
            const shipDisplay = ship.svbid || ship.VBShipmentNumber || "";
            const cpoId = ship.VBSerialNumber?.toString() || ship.VBNumber?.toString() || "";
            const matchingCPO = standaloneCPOs.find((c: any) => c._id?.toString() === cpoId);
            const parentVBId = matchingCPO ? (matchingCPO.VBNumber?.toString() || "") : "";
            addShip(shipId, shipDisplay, parentVBId, cpoId);
        });
        return list.filter(s => s.value && s.label);
    }, [purchaseOrders, standaloneShips, standaloneCPOs, poIdToDisplay, idToSerial]);

    // ── Inline field change handler ──
    // Map raw field names to their enriched display counterparts
    const DISPLAY_FIELD_MAP: Record<string, string> = {
        VBNumber: "_VBNumberDisplay",
        VBSerialNumber: "_VBSerialNumberDisplay",
        VBShipmentNumber: "_VBShipmentNumberDisplay",
    };

    const handleFieldChange = useCallback(async (id: string, field: string, value: string, cascadeClear?: string[]) => {
        // Optimistic update — also sync/clear the enriched _*Display fields
        setEntries(prev => prev.map(e => {
            if (e._id !== id) return e;
            const updated: any = { ...e, [field]: value || undefined };
            // Set the display field to match the new value (display name)
            const displayField = DISPLAY_FIELD_MAP[field];
            if (displayField) {
                let displayValue = value;
                if (value) {
                    if (field === "VBNumber") displayValue = resolveVBNumber(value);
                    else if (field === "VBSerialNumber") displayValue = resolveSerial(value);
                    else if (field === "VBShipmentNumber") displayValue = resolveShip(value);
                }
                updated[displayField] = displayValue || undefined;
            }
            // Clear cascaded fields AND their display counterparts
            if (cascadeClear) cascadeClear.forEach(f => {
                updated[f] = undefined;
                const df = DISPLAY_FIELD_MAP[f];
                if (df) updated[df] = undefined;
            });
            return updated;
        }));

        const body: Record<string, any> = { [field]: value || null };
        if (cascadeClear) cascadeClear.forEach(f => { body[f] = null; });

        try {
            const res = await fetch(`/api/admin/timeline/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error();
        } catch {
            toast.error("Failed to update");
            fetchEntries(); // revert
        }
    }, [resolveVBNumber, resolveSerial, resolveShip]);

    const fetchEntries = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (VBNumber) params.set("VBNumber", VBNumber);
            if (VBSerialNumber) params.set("VBSerialNumber", VBSerialNumber);
            if (VBShipmentNumber) params.set("VBShipmentNumber", VBShipmentNumber);
            const res = await fetch(`/api/admin/timeline?${params.toString()}`);
            if (res.ok) setEntries(await res.json());
        } catch {
            toast.error("Failed to load timeline");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open) { fetchEntries(); setShowAddDialog(false); setSearch(""); setSidebarSelection("all"); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, VBNumber, VBSerialNumber, VBShipmentNumber]);

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/admin/timeline/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error();
            toast.success("Entry deleted");
            setEntries((prev) => prev.filter((e) => e._id !== id));
        } catch {
            toast.error("Failed to delete");
        }
    };

    // Filter by search
    const searchFiltered = useMemo(() => {
        let result = entries;
        if (search) {
            const q = search.toLowerCase();
            result = result.filter((e) =>
                e.comments?.toLowerCase().includes(q) ||
                e.type?.toLowerCase().includes(q) ||
                e.category?.toLowerCase().includes(q) ||
                e.VBSerialNumber?.toLowerCase().includes(q) ||
                e.VBShipmentNumber?.toLowerCase().includes(q) ||
                e.createdBy?.toLowerCase().includes(q)
            );
        }
        return [...result].sort((a, b) => {
            const dateA = new Date(a.date || a.timestamp).getTime();
            const dateB = new Date(b.date || b.timestamp).getTime();
            return dateB - dateA;
        });
    }, [entries, search]);

    // Build sidebar tree
    const sidebarTree = useMemo(() => {
        const serials = new Map<string, {
            display: string;
            count: number;
            shippings: Map<string, { display: string; count: number }>;
        }>();

        searchFiltered.forEach((entry) => {
            const serialKey = entry.VBSerialNumber || "";
            if (!serialKey) return;

            if (!serials.has(serialKey)) {
                serials.set(serialKey, {
                    display: entry._VBSerialNumberDisplay || serialKey,
                    count: 0,
                    shippings: new Map(),
                });
            }
            const serial = serials.get(serialKey)!;
            serial.count++;

            if (entry.VBShipmentNumber) {
                const shipKey = entry.VBShipmentNumber;
                if (!serial.shippings.has(shipKey)) {
                    serial.shippings.set(shipKey, {
                        display: entry._VBShipmentNumberDisplay || shipKey,
                        count: 0,
                    });
                }
                serial.shippings.get(shipKey)!.count++;
            }
        });

        return serials;
    }, [searchFiltered]);

    // Filter by sidebar selection
    const displayEntries = useMemo(() => {
        if (sidebarSelection === "all") return searchFiltered;
        if (sidebarSelection.startsWith("ship:")) {
            const shipId = sidebarSelection.slice(5);
            return searchFiltered.filter((e) => e.VBShipmentNumber?.toString() === shipId);
        }
        return searchFiltered.filter((e) => e.VBSerialNumber?.toString() === sidebarSelection);
    }, [searchFiltered, sidebarSelection]);

    const resolveUser = (email?: string) => {
        if (!email) return "System";
        if (email === "System") return "System";
        return users[email.toLowerCase()] || email.split("@")[0];
    };

    const displayTitle = title || (VBShipmentNumber ? `Timeline — ${VBShipmentNumber}` : VBSerialNumber ? `Timeline — ${VBSerialNumber}` : VBNumber ? `Timeline — ${VBNumber}` : "Timeline");

    const showSidebar = !VBShipmentNumber && sidebarTree.size > 0;

    return (
        <>
            <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
                <DialogContent className="max-w-[1400px] h-[85vh] p-0 gap-0 flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="px-5 pt-5 pb-3 border-b space-y-3">
                        <DialogHeader>
                            <DialogTitle className="text-base flex items-center gap-2">
                                <Clock className="h-4 w-4 text-primary" />
                                {displayTitle}
                            </DialogTitle>
                            <DialogDescription className="sr-only">View and manage timeline entries for this purchase order</DialogDescription>
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
                            <Button size="sm" className="h-7 px-3 text-xs" onClick={() => setShowAddDialog(true)}>
                                <Plus className="h-3 w-3 mr-1" /> Add
                            </Button>
                        </div>
                    </div>

                    {/* Body: Sidebar + Content */}
                    <div className="flex-1 flex overflow-hidden">
                        {/* Sidebar */}
                        {showSidebar && (
                            <div className="w-[175px] min-w-[175px] border-r overflow-y-auto bg-muted/10 scrollbar-thin scrollbar-thumb-muted">
                                {/* All */}
                                <button
                                    onClick={() => setSidebarSelection("all")}
                                    className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold transition-colors ${sidebarSelection === "all"
                                        ? "bg-primary/10 text-primary border-l-2 border-primary"
                                        : "text-foreground/70 hover:bg-muted/40"
                                        }`}
                                >
                                    <span>All</span>
                                    <span className="text-[10px] font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{searchFiltered.length}</span>
                                </button>

                                {/* Serial groups */}
                                {Array.from(sidebarTree.entries()).map(([serialKey, serial]) => (
                                    <div key={serialKey}>
                                        <button
                                            onClick={() => setSidebarSelection(serialKey)}
                                            className={`w-full flex items-center justify-between px-3 py-1.5 text-[11px] transition-colors ${sidebarSelection === serialKey
                                                ? "bg-primary/10 text-primary border-l-2 border-primary font-semibold"
                                                : "text-foreground/60 hover:bg-muted/40 font-medium"
                                                }`}
                                        >
                                            <span className="flex items-center gap-1.5 truncate">
                                                <Package className="h-3 w-3 shrink-0" />
                                                <span className="truncate">{serial.display}</span>
                                            </span>
                                            <span className="text-[10px] font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full ml-1 shrink-0">{serial.count}</span>
                                        </button>

                                        {/* Shipping children */}
                                        {Array.from(serial.shippings.entries()).map(([shipKey, ship]) => (
                                            <button
                                                key={shipKey}
                                                onClick={() => setSidebarSelection(`ship:${shipKey}`)}
                                                className={`w-full flex items-center justify-between pl-7 pr-3 py-1.5 text-[10px] transition-colors ${sidebarSelection === `ship:${shipKey}`
                                                    ? "bg-primary/10 text-primary border-l-2 border-primary font-semibold"
                                                    : "text-foreground/50 hover:bg-muted/40 font-medium"
                                                    }`}
                                            >
                                                <span className="flex items-center gap-1 truncate">
                                                    <Anchor className="h-2.5 w-2.5 shrink-0 text-violet-500" />
                                                    <span className="truncate">{ship.display}</span>
                                                </span>
                                                <span className="text-[10px] font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full ml-1 shrink-0">{ship.count}</span>
                                            </button>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Content */}
                        <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-muted">
                            {loading ? (
                                <div className="flex items-center justify-center h-32 text-xs text-muted-foreground">Loading timeline...</div>
                            ) : displayEntries.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
                                    <Clock className="h-8 w-8 opacity-30" />
                                    <span className="text-xs">No timeline entries yet. Click &quot;Add&quot; to create one.</span>
                                </div>
                            ) : (
                                <TimelineTable entries={displayEntries} resolveUser={resolveUser} onEdit={setEditingEntry} onDelete={handleDelete} poOptions={poOptions} cpoOptions={cpoOptions} shipOptions={shipOptions} onFieldChange={handleFieldChange} resolveVBNumber={resolveVBNumber} resolveSerial={resolveSerial} resolveShip={resolveShip} />
                            )}
                        </div>
                    </div>

                    {/* Footer Stats */}
                    <div className="px-5 py-2 border-t bg-muted/20 flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>
                            {displayEntries.length} {displayEntries.length === 1 ? "entry" : "entries"}
                            {sidebarSelection !== "all" && ` (filtered)`}
                            {search && ` matching "${search}"`}
                        </span>
                        <div className="flex gap-3">
                            {TYPE_OPTIONS.map((t) => {
                                const count = displayEntries.filter((e) => e.type === t).length;
                                if (count === 0) return null;
                                return <span key={t} className="flex items-center gap-1">{TYPE_ICONS[t]} {count}</span>;
                            })}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Add/Edit Dialog (shared component) */}
            <TimelineEntryDialog
                open={showAddDialog}
                onClose={() => setShowAddDialog(false)}
                parentIds={{ VBNumber, VBSerialNumber, VBShipmentNumber }}
                onSaved={() => { setShowAddDialog(false); fetchEntries(); }}
            />
            <TimelineEntryDialog
                open={!!editingEntry}
                entry={editingEntry}
                onClose={() => setEditingEntry(null)}
                onSaved={() => { setEditingEntry(null); fetchEntries(); }}
                onDelete={(id) => {
                    setEditingEntry(null);
                    handleDelete(id);
                }}
            />
        </>
    );
}
