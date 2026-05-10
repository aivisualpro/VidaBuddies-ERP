"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Download,
  FileJson,
  FileSpreadsheet,
  Ship,
  Package,
  ClipboardList,
  Loader2,
  CheckSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ExportCollection {
  key: string;
  label: string;
  description: string;
  icon: any;
  color: string;
}

const COLLECTIONS: ExportCollection[] = [
  {
    key: "vbshippings",
    label: "Shipments",
    description: "All VB Shipping records including tracking, logistics, and financial data",
    icon: Ship,
    color: "from-blue-500/20 to-blue-600/5 border-blue-500/30",
  },
  {
    key: "vbcustomerpos",
    label: "Customer POs",
    description: "Customer Purchase Orders with quantities, warehouses, and delivery info",
    icon: Package,
    color: "from-violet-500/20 to-violet-600/5 border-violet-500/30",
  },
  {
    key: "vidapos",
    label: "VB Purchase Orders",
    description: "Main VidaBuddies Purchase Orders with nested Customer POs and Shipments",
    icon: ClipboardList,
    color: "from-emerald-500/20 to-emerald-600/5 border-emerald-500/30",
  },
  {
    key: "vidatimelines",
    label: "Timelines / Active Actions",
    description: "All timeline entries with status, comments, categories, and linked PO/CPO/Shipment references",
    icon: CheckSquare,
    color: "from-amber-500/20 to-amber-600/5 border-amber-500/30",
  },
];

function flattenObject(obj: any, prefix = ""): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const val = obj[key];
    if (val === null || val === undefined) {
      result[fullKey] = "";
    } else if (Array.isArray(val)) {
      result[fullKey] = JSON.stringify(val);
    } else if (typeof val === "object" && !(val instanceof Date)) {
      Object.assign(result, flattenObject(val, fullKey));
    } else {
      result[fullKey] = String(val);
    }
  }
  return result;
}

function jsonToCSV(data: any[]): string {
  if (!data.length) return "";
  const flattened = data.map((row) => flattenObject(row));
  const allKeys = new Set<string>();
  flattened.forEach((row) => Object.keys(row).forEach((k) => allKeys.add(k)));
  const headers = Array.from(allKeys);

  const escape = (val: string) => {
    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const lines = [headers.map(escape).join(",")];
  flattened.forEach((row) => {
    lines.push(headers.map((h) => escape(row[h] || "")).join(","));
  });
  return lines.join("\n");
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function ExportsPage() {
  const [loadingState, setLoadingState] = useState<Record<string, boolean>>({});
  const [recordCounts, setRecordCounts] = useState<Record<string, number | null>>({});

  const handleExport = async (collectionKey: string, format: "csv" | "json") => {
    const stateKey = `${collectionKey}_${format}`;
    setLoadingState((p) => ({ ...p, [stateKey]: true }));

    try {
      const res = await fetch(`/api/admin/exports?collection=${collectionKey}`);
      if (!res.ok) throw new Error("Failed to fetch data");
      const data = await res.json();

      if (!Array.isArray(data) || data.length === 0) {
        toast.error("No records found for this collection");
        return;
      }

      setRecordCounts((p) => ({ ...p, [collectionKey]: data.length }));

      const timestamp = new Date().toISOString().split("T")[0];
      const filename = `${collectionKey}_${timestamp}`;

      if (format === "json") {
        downloadFile(JSON.stringify(data, null, 2), `${filename}.json`, "application/json");
        toast.success(`Exported ${data.length} records as JSON`);
      } else {
        const csv = jsonToCSV(data);
        downloadFile(csv, `${filename}.csv`, "text/csv");
        toast.success(`Exported ${data.length} records as CSV`);
      }
    } catch (err) {
      toast.error("Export failed");
    } finally {
      setLoadingState((p) => ({ ...p, [stateKey]: false }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold">Data Exports</h3>
        <p className="text-sm text-muted-foreground">
          Export your data as CSV or JSON files for reporting, migration, or backup.
        </p>
      </div>

      {/* Collection Cards */}
      <div className="grid gap-4">
        {COLLECTIONS.map((col) => {
          const Icon = col.icon;
          const csvLoading = loadingState[`${col.key}_csv`];
          const jsonLoading = loadingState[`${col.key}_json`];
          const count = recordCounts[col.key];

          return (
            <div
              key={col.key}
              className={`rounded-xl border bg-gradient-to-r ${col.color} p-5 transition-all hover:shadow-md`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-background/80 flex items-center justify-center shadow-sm">
                    <Icon className="h-5 w-5 text-foreground" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold">{col.label}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5 max-w-md">
                      {col.description}
                    </p>
                    {count !== null && count !== undefined && (
                      <p className="text-[10px] text-muted-foreground mt-1 font-mono">
                        Last export: {count} records
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => handleExport(col.key, "csv")}
                    disabled={csvLoading || jsonLoading}
                  >
                    {csvLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                    )}
                    CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => handleExport(col.key, "json")}
                    disabled={csvLoading || jsonLoading}
                  >
                    {jsonLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FileJson className="h-3.5 w-3.5" />
                    )}
                    JSON
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Info */}
      <div className="rounded-lg border border-dashed border-muted-foreground/30 p-4">
        <div className="flex items-start gap-2">
          <Download className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <div className="text-xs text-muted-foreground space-y-1">
            <p><strong>CSV</strong> — flat spreadsheet format, nested fields are JSON-stringified. Best for Excel/Google Sheets.</p>
            <p><strong>JSON</strong> — full document export preserving nested structure. Best for data migration or backup.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
