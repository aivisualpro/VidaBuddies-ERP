"use client";

/**
 * Customs Package Wizard — 5 steps (spec v2 §2):
 *   1 Route & Stage · 2 Documents · 3 Review Fields · 4 Compliance & Timing · 5 Preview & Send
 *
 * Design: existing dark ERP theme, amber primary accent, text+icon statuses
 * (never colour alone), autosave on every change, resumable.
 * Hard controls: no invented PARS/PAPS, blockers stop Ready-to-Send.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Ship,
  Truck,
  TrainFront,
  Plane,
  MapPin,
  ScanSearch,
  ClipboardCheck,
  Clock,
  Send,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  FileText,
  FileCheck2,
  FileWarning,
  ExternalLink,
  Loader2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Landmark,
  X,
  Plus,
  Download,
  Stamp,
} from "lucide-react";
import { toast } from "sonner";
import {
  BROKERS,
  PACKAGE_TYPE_LABELS,
  FSVP_LABELS,
  GENERATED_FOLDER,
  routeSummary,
  packageFileName,
  countdownLabel,
  deadlineStatus,
  readyToSendBlockers,
  STAGES,
  type CustomsRoute,
  type PackageType,
  type FsvpStatus,
  type BorderMode,
  type InlandMode,
} from "@/lib/customs/rules";

/* ────────────────────────────── types ────────────────────────────── */

interface WizardProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  shipmentId: string;
  shipNumber: string;
  /** The shipment's resolved Drive folder id (record root) */
  folderId: string | null;
  poNumber?: string;
  /** Called after generating a package file so the file manager can refresh */
  onDocsChanged?: () => void;
}

type Pkg = any;

const STEPS = [
  { label: "Route & Stage", icon: MapPin },
  { label: "Documents", icon: ScanSearch },
  { label: "Review Fields", icon: ClipboardCheck },
  { label: "Compliance & Timing", icon: Clock },
  { label: "Preview & Send", icon: Send },
];

/* ─────────────────────────── small helpers ─────────────────────────── */

const inputCls =
  "h-8 w-full rounded-lg border border-border/60 bg-muted/30 px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-all";

function dstr(v?: string | null): string {
  if (!v) return "";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function StateChip({ state }: { state: string }) {
  const map: Record<string, { cls: string; icon: any; label: string }> = {
    RECEIVED: { cls: "text-emerald-500 bg-emerald-500/10 border-emerald-500/25", icon: CheckCircle2, label: "Received" },
    NOT_YET_EXPECTED: { cls: "text-slate-400 bg-slate-500/10 border-slate-500/25", icon: CircleDashed, label: "Not yet expected" },
    REQUESTED: { cls: "text-sky-500 bg-sky-500/10 border-sky-500/25", icon: Clock, label: "Requested" },
    MISSING: { cls: "text-red-500 bg-red-500/10 border-red-500/25", icon: FileWarning, label: "Missing" },
    OVERDUE: { cls: "text-red-500 bg-red-500/10 border-red-500/25", icon: AlertTriangle, label: "Overdue" },
    NOT_APPLICABLE: { cls: "text-muted-foreground bg-muted/40 border-border/60", icon: X, label: "N/A" },
  };
  const m = map[state] || map.MISSING;
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${m.cls}`}>
      <Icon className="h-3 w-3" /> {m.label}
    </span>
  );
}

function FieldStatusDot({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    verified: { cls: "text-emerald-500 bg-emerald-500/10 border-emerald-500/25", label: "Verified" },
    review: { cls: "text-amber-500 bg-amber-500/10 border-amber-500/25", label: "Review" },
    conflict: { cls: "text-red-500 bg-red-500/10 border-red-500/25", label: "Conflict" },
    missing: { cls: "text-red-500 bg-red-500/10 border-red-500/25", label: "Missing" },
    waived: { cls: "text-muted-foreground bg-muted/40 border-border/60", label: "Waived" },
  };
  const m = map[status] || map.missing;
  return <span className={`inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${m.cls}`}>{m.label}</span>;
}

function ModeCard({
  active,
  onClick,
  icon: Icon,
  label,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  icon: any;
  label: string;
  sub?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 rounded-xl border px-2 py-3 transition-all ${
        active
          ? "border-amber-500/70 bg-amber-500/10 text-amber-500 shadow-sm"
          : "border-border/60 bg-muted/20 text-muted-foreground hover:border-border hover:bg-muted/40"
      }`}
    >
      <Icon className="h-5 w-5" />
      <span className="text-[11px] font-semibold">{label}</span>
      {sub && <span className="text-[9px] opacity-70">{sub}</span>}
    </button>
  );
}

/* ────────────────────────────── component ────────────────────────────── */

export default function CustomsPackageWizard({
  open,
  onOpenChange,
  shipmentId,
  shipNumber,
  folderId,
  poNumber,
  onDocsChanged,
}: WizardProps) {
  const [pkg, setPkg] = useState<Pkg | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [step, setStep] = useState(0);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [recipientInput, setRecipientInput] = useState("");
  const [sendNote, setSendNote] = useState("");
  const [approved, setApproved] = useState(false);
  const [scannedOnce, setScannedOnce] = useState(false);

  /* ── load / create package on open ── */
  useEffect(() => {
    if (!open || !shipmentId) return;
    setStep(0);
    setApproved(false);
    setLoading(true);
    fetch("/api/admin/customs-packages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shipmentId }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setPkg(d.package);
        setRecipients(d.package?.brokerEmails || []);
        if (d.created) toast.success("Compliance plan created for " + (d.package?.shipNumber || shipNumber));
      })
      .catch((e) => toast.error("Could not open customs package: " + e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, shipmentId]);

  /* ── autosave (PATCH) ── */
  const patch = useCallback(
    async (updates: any, silent = true) => {
      if (!pkg?._id) return null;
      setSaving(true);
      try {
        const r = await fetch("/api/admin/customs-packages", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ packageId: pkg._id, ...updates }),
        });
        const d = await r.json();
        if (d.error) throw new Error(d.error);
        setPkg(d.package);
        if (!silent) toast.success("Saved");
        return d.package;
      } catch (e: any) {
        toast.error("Save failed: " + e.message);
        return null;
      } finally {
        setSaving(false);
      }
    },
    [pkg?._id]
  );

  const route: CustomsRoute | null = pkg?.route || null;
  const primaryType = (pkg?.packageTypes?.[0] || "CA_ENTRY") as PackageType;
  const isTruck = route?.borderMode === "TRUCK";
  const isUS = route?.countryOfImport === "US";

  /* ── derived readiness ── */
  const criticalMissing = useMemo(
    () =>
      (pkg?.documents || [])
        .filter(
          (d: any) =>
            ["CRITICAL", "TRUCK_BLOCKER", "OCEAN_CRITICAL"].includes(d.readiness) &&
            d.state !== "RECEIVED" &&
            d.state !== "NOT_APPLICABLE"
        )
        .map((d: any) => d.label),
    [pkg?.documents]
  );

  const blockers = useMemo(() => {
    if (!route) return [];
    return readyToSendBlockers({
      route,
      parsNumber: pkg?.compliance?.parsNumber,
      papsNumber: pkg?.compliance?.papsNumber,
      portOfEntry: pkg?.compliance?.portOfEntry,
      fsvpStatus: pkg?.compliance?.fsvpStatus as FsvpStatus,
      fsvpDuns: pkg?.compliance?.fsvpDuns,
      isFood: pkg?.compliance?.isFood,
      priorNoticeResponsible: pkg?.compliance?.priorNoticeResponsible,
      criticalDocsMissing: criticalMissing,
    });
  }, [route, pkg?.compliance, criticalMissing]);

  /* ── scan documents ── */
  const runScan = async () => {
    if (!pkg?._id) return;
    if (!folderId) {
      toast.error("Shipment folder is still being resolved — try again in a moment");
      return;
    }
    setScanning(true);
    try {
      const r = await fetch("/api/admin/customs-packages/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId: pkg._id, folderId }),
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setPkg(d.package);
      setScannedOnce(true);
      toast.success(`Scanned ${d.scannedCount} files — matched ${d.matchedCount} requirements`);
    } catch (e: any) {
      toast.error("Scan failed: " + e.message);
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    // Auto-scan the first time the user reaches step 2
    if (open && step === 1 && pkg?._id && !scannedOnce && !scanning && folderId) runScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, open, pkg?._id, folderId]);

  /* ── generate PDF cover sheet + upload to Drive ── */
  const generatePackage = async () => {
    if (!pkg || !folderId) {
      toast.error("Shipment folder not resolved yet");
      return;
    }
    setGenerating(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const W = doc.internal.pageSize.getWidth();
      const fileName = packageFileName(pkg.shipNumber, primaryType, pkg.version);

      // Header band
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, W, 86, "F");
      doc.setTextColor(245, 158, 11);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("VIDA BUDDIES INC.", 40, 30);
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(17);
      doc.text(`Customs Package — ${pkg.shipNumber}`, 40, 52);
      doc.setFontSize(10);
      doc.setTextColor(148, 163, 184);
      doc.setFont("helvetica", "normal");
      doc.text(`${PACKAGE_TYPE_LABELS[primaryType] || primaryType} · Version ${pkg.version} · ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`, 40, 68);

      doc.setTextColor(51, 65, 85);
      doc.setFontSize(10);
      doc.text(routeSummary(pkg.route), 40, 108, { maxWidth: W - 80 });

      const fv = (k: string) => pkg.fields?.find((f: any) => f.key === k)?.value || "—";
      const fmt = (v?: string) => (v ? new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—");

      autoTable(doc, {
        startY: 124,
        theme: "grid",
        styles: { fontSize: 8.5, cellPadding: 5, textColor: [30, 41, 59], lineColor: [226, 232, 240] },
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold" },
        head: [["Shipment & Route", ""]],
        body: [
          ["Importer of record", pkg.importerName || "Vida Buddies Inc."],
          ["Broker", `${pkg.brokerName || ""} (${pkg.brokerCode || ""})`],
          ["Container / BOL", `${fv("containerNo")} / ${fv("bolNumber")}`],
          ["Vessel / Carrier", `${fv("vessel")} / ${fv("carrier")}`],
          ["Port of lading → arrival", `${fv("portOfLading")} → ${fv("portOfArrival")}`],
          ["Customs port of entry", pkg.compliance?.portOfEntry || "—"],
          ...(pkg.compliance?.parsNumber ? [["PARS / CCN (carrier-provided)", pkg.compliance.parsNumber]] : []),
          ...(pkg.compliance?.papsNumber ? [["PAPS / SCN (carrier-provided)", pkg.compliance.papsNumber]] : []),
          ["ETD / ETA", `${fmt(pkg.etd)} / ${fmt(pkg.eta)}`],
          ["Product", fv("product")],
          ["Invoice value", fv("invoiceValue")],
          ["Net / gross weight (kg)", `${fv("netWeightKG")} / ${fv("grossWeightKG")}`],
          ...(isUS
            ? [
                ["FSVP status", FSVP_LABELS[(pkg.compliance?.fsvpStatus as FsvpStatus) || "UNKNOWN"]],
                ["FDA Prior Notice", pkg.compliance?.priorNoticeResponsible ? `Responsible: ${pkg.compliance.priorNoticeResponsible}${pkg.compliance?.priorNoticeConfirmation ? ` · Confirmation ${pkg.compliance.priorNoticeConfirmation}` : ""}` : "—"],
              ]
            : []),
        ],
      });

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 16,
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 4.5, textColor: [30, 41, 59], lineColor: [226, 232, 240] },
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold" },
        head: [["Document", "Status", "File", "Folder"]],
        body: (pkg.documents || []).map((d: any) => [
          d.label,
          d.state.replace(/_/g, " "),
          d.fileName || "—",
          d.folderName || (d.fileId ? "Root" : "—"),
        ]),
        columnStyles: { 0: { cellWidth: 150 }, 1: { cellWidth: 80 } },
        didParseCell: (data: any) => {
          if (data.section === "body" && data.column.index === 1) {
            const v = String(data.cell.raw);
            if (v === "RECEIVED") data.cell.styles.textColor = [5, 150, 105];
            else if (v.includes("MISSING") || v.includes("OVERDUE")) data.cell.styles.textColor = [220, 38, 38];
            else data.cell.styles.textColor = [100, 116, 139];
          }
        },
      });

      const deadlines = (pkg.deadlines || []).slice(0, 12);
      if (deadlines.length) {
        autoTable(doc, {
          startY: (doc as any).lastAutoTable.finalY + 16,
          theme: "grid",
          styles: { fontSize: 8, cellPadding: 4.5, textColor: [30, 41, 59], lineColor: [226, 232, 240] },
          headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold" },
          head: [["Deadline", "Due", "Basis"]],
          body: deadlines.map((d: any) => [
            d.label + (d.estimated ? " (estimated)" : ""),
            d.dueAt ? new Date(d.dueAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—",
            d.basis,
          ]),
        });
      }

      // Footer on every page
      const pages = doc.getNumberOfPages();
      for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        const H = doc.internal.pageSize.getHeight();
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Prepared with Vida Buddies ERP · Ruleset ${pkg.rulesetVersion || ""} · No signature applied — requires authorized signer · Page ${i} of ${pages}`,
          40,
          H - 24
        );
      }

      // Upload into "Generated Customs Packages" under the shipment folder
      const blob = doc.output("blob");
      const fd = new FormData();
      fd.append("file", new File([blob], fileName, { type: "application/pdf" }));
      fd.append("folderId", folderId);
      fd.append("subFolder", GENERATED_FOLDER);
      if (poNumber) fd.append("poNumber", poNumber);
      const up = await fetch("/api/admin/drive", { method: "POST", body: fd });
      const upd = await up.json();
      if (upd.error) throw new Error(upd.error);

      await patch({
        generatedEntry: {
          packageType: primaryType,
          fileName,
          driveFileId: upd.uploaded?.id,
          webViewLink: upd.uploaded?.webViewLink,
          version: pkg.version,
        },
        status: "READY_FOR_REVIEW",
      });
      onDocsChanged?.();
      toast.success(`${fileName} generated & saved to "${GENERATED_FOLDER}"`);
    } catch (e: any) {
      toast.error("Generate failed: " + e.message);
    } finally {
      setGenerating(false);
    }
  };

  /* ── send to broker ── */
  const sendToBroker = async () => {
    if (!pkg) return;
    if (recipients.length === 0) {
      toast.error("Add at least one broker recipient");
      return;
    }
    setSending(true);
    try {
      const r = await fetch("/api/admin/customs-packages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId: pkg._id, to: recipients, note: sendNote }),
      });
      const d = await r.json();
      if (r.status === 422) {
        (d.blockers || []).forEach((b: string) => toast.error(b));
        return;
      }
      if (d.error) throw new Error(d.error);
      toast.success("Package sent to broker — acknowledgement timer started");
      const fresh = await fetch(`/api/admin/customs-packages?shipmentId=${shipmentId}`).then((x) => x.json());
      if (fresh.package) setPkg(fresh.package);
    } catch (e: any) {
      toast.error("Send failed: " + e.message);
    } finally {
      setSending(false);
    }
  };

  /* ── field editing (step 3) ── */
  const updateField = (key: string, value: string) => {
    if (!pkg) return;
    const fields = (pkg.fields || []).map((f: any) =>
      f.key === key
        ? { ...f, value, source: "MANUAL", sourceDetail: "Edited in review", status: value.trim() ? "verified" : "missing" }
        : f
    );
    setPkg({ ...pkg, fields });
  };
  const saveFields = () => patch({ fields: pkg.fields });

  const compliance = pkg?.compliance || {};
  const setCompliance = (k: string, v: any) => setPkg({ ...pkg, compliance: { ...compliance, [k]: v } });
  const saveCompliance = () => patch({ compliance: pkg.compliance });

  const addRecipient = () => {
    const e = recipientInput.trim().toLowerCase();
    if (!/.+@.+\..+/.test(e)) return;
    if (!recipients.includes(e)) {
      const next = [...recipients, e];
      setRecipients(next);
      patch({ brokerEmails: next });
    }
    setRecipientInput("");
  };

  const grouped = useMemo(() => {
    const g: Record<string, any[]> = {};
    for (const f of pkg?.fields || []) (g[f.group] ||= []).push(f);
    return g;
  }, [pkg?.fields]);

  const missingFieldCount = (pkg?.fields || []).filter((f: any) => f.status === "missing").length;
  const receivedCount = (pkg?.documents || []).filter((d: any) => d.state === "RECEIVED").length;

  /* ────────────────────────────── render ────────────────────────────── */

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[96vw] h-[88vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-5 pt-4 pb-3 border-b border-border/60 shrink-0">
          <div className="flex items-center justify-between gap-3 pr-8">
            <DialogTitle className="flex items-center gap-2 text-base">
              <span className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-amber-500/15 border border-amber-500/30">
                <Landmark className="h-4 w-4 text-amber-500" />
              </span>
              Customs Package — {pkg?.shipNumber || shipNumber}
              {pkg && (
                <span className="text-[10px] font-bold text-muted-foreground bg-muted/60 border border-border/60 px-1.5 py-0.5 rounded-full">
                  v{pkg.version} · {String(pkg.status).replace(/_/g, " ")}
                </span>
              )}
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </DialogTitle>
            {route && (
              <span className="hidden md:inline text-[11px] text-muted-foreground truncate max-w-[300px]">
                {routeSummary(route)}
              </span>
            )}
          </div>
          {/* Step progress */}
          <div className="flex items-center gap-1 mt-3">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const active = i === step;
              const done = i < step;
              return (
                <button
                  key={s.label}
                  onClick={() => setStep(i)}
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold border transition-all ${
                    active
                      ? "border-amber-500/60 bg-amber-500/10 text-amber-500"
                      : done
                      ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-500"
                      : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  {done ? <CheckCircle2 className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                  <span className="hidden sm:inline">{i + 1}. {s.label}</span>
                  <span className="sm:hidden">{i + 1}</span>
                </button>
              );
            })}
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading || !pkg ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-xs">Preparing compliance plan…</p>
            </div>
          ) : (
            <>
              {/* ─────────── STEP 1 · Route & Stage ─────────── */}
              {step === 0 && route && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">1 · Country of import</p>
                      <div className="grid grid-cols-2 gap-2">
                        <ModeCard active={route.countryOfImport === "CA"} onClick={() => patch({ route: { countryOfImport: "CA" } })} icon={Landmark} label="Canada" sub="Broker: DSV" />
                        <ModeCard active={route.countryOfImport === "US"} onClick={() => patch({ route: { countryOfImport: "US" } })} icon={Landmark} label="United States" sub="Broker: PCB" />
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">2 · First border-entry mode</p>
                      <div className="grid grid-cols-4 gap-2">
                        {([
                          ["OCEAN", Ship, "Ocean"],
                          ["TRUCK", Truck, "Truck"],
                          ["RAIL", TrainFront, "Rail"],
                          ["AIR", Plane, "Air"],
                        ] as [BorderMode, any, string][]).map(([m, I, l]) => (
                          <ModeCard key={m} active={route.borderMode === m} onClick={() => patch({ route: { borderMode: m } })} icon={I} label={l} />
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">3 · Inland continuation</p>
                      <div className="grid grid-cols-3 gap-2">
                        {([
                          ["NONE", MapPin, "Direct delivery"],
                          ["TRUCK", Truck, "Final truck"],
                          ["RAIL", TrainFront, "Inland rail"],
                        ] as [InlandMode, any, string][]).map(([m, I, l]) => (
                          <ModeCard key={m} active={route.inlandMode === m} onClick={() => patch({ route: { inlandMode: m } })} icon={I} label={l} />
                        ))}
                      </div>
                      {route.borderMode === "OCEAN" && route.inlandMode === "RAIL" && (
                        <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
                          <ShieldCheck className="h-3 w-3 text-emerald-500" /> Border mode stays OCEAN — rail adds later manifest/terminal tasks.
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">4 · Shipment stage</p>
                      <div className="flex flex-wrap gap-1.5">
                        {STAGES.map((s) => (
                          <button
                            key={s.value}
                            onClick={() => patch({ route: { stage: s.value } })}
                            className={`text-[10px] font-semibold px-2.5 py-1.5 rounded-full border transition-all ${
                              route.stage === s.value
                                ? "border-amber-500/60 bg-amber-500/10 text-amber-500"
                                : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40"
                            }`}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Importer / broker / dates */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="col-span-2">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Importer of record</label>
                      <input
                        className={inputCls + " mt-1"}
                        defaultValue={pkg.importerName || "Vida Buddies Inc."}
                        onBlur={(e) => patch({ importerName: e.target.value })}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Broker (auto by country)</label>
                      <div className="mt-1 h-8 flex items-center px-2.5 rounded-lg border border-border/60 bg-muted/20 text-xs text-foreground/90">
                        {BROKERS[route.countryOfImport].name}
                      </div>
                    </div>
                    {([
                      ["etd", "ETD (departure)"],
                      ["ladingDate", "Date of lading"],
                      ["eta", "ETA (arrival)"],
                      ["borderEta", "Border ETA (truck)"],
                      ["lastFreeDay", "Last free day (LFD)"],
                    ] as [string, string][]).map(([k, l]) => (
                      <div key={k}>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{l}</label>
                        <input
                          type="date"
                          className={inputCls + " mt-1"}
                          defaultValue={dstr(pkg[k])}
                          onBlur={(e) => patch({ [k]: e.target.value || null })}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Plain-language summary + packages */}
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5">
                    <p className="text-xs text-foreground/90 flex items-start gap-2">
                      <MapPin className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                      {routeSummary(route)}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {(pkg.packageTypes || []).map((t: string) => (
                        <span key={t} className="text-[10px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full">
                          {PACKAGE_TYPE_LABELS[t as PackageType] || t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ─────────── STEP 2 · Documents ─────────── */}
              {step === 1 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      Files are scanned from this shipment's folders only — sibling shipments are never mixed. EXPENSES is excluded by default.
                    </p>
                    <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1.5 shrink-0" onClick={runScan} disabled={scanning}>
                      {scanning ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                      Re-scan documents
                    </Button>
                  </div>

                  <div className="rounded-xl border border-border/60 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                          <th className="text-left font-semibold px-3 py-2">Requirement</th>
                          <th className="text-left font-semibold px-3 py-2">Status</th>
                          <th className="text-left font-semibold px-3 py-2">Matched file</th>
                          <th className="text-center font-semibold px-3 py-2 w-20">Include</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(pkg.documents || []).map((d: any) => (
                          <tr key={d.docType} className="border-t border-border/40">
                            <td className="px-3 py-2.5">
                              <div className="font-medium text-foreground/90 flex items-center gap-1.5">
                                {d.readiness === "TRUCK_BLOCKER" ? (
                                  <ShieldAlert className="h-3.5 w-3.5 text-red-500 shrink-0" />
                                ) : d.readiness === "CRITICAL" || d.readiness === "OCEAN_CRITICAL" ? (
                                  <FileText className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                ) : (
                                  <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                )}
                                {d.label}
                              </div>
                              {d.note && <p className="text-[10px] text-muted-foreground mt-0.5 ml-5">{d.note}</p>}
                            </td>
                            <td className="px-3 py-2.5"><StateChip state={d.state} /></td>
                            <td className="px-3 py-2.5">
                              {d.fileName ? (
                                <a href={d.webViewLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                                  <span className="truncate max-w-[200px]">{d.fileName}</span>
                                  <ExternalLink className="h-3 w-3 shrink-0" />
                                </a>
                              ) : (
                                <span className="text-muted-foreground/60">—</span>
                              )}
                              {d.folderName && <p className="text-[10px] text-muted-foreground">{d.folderName}</p>}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <input
                                type="checkbox"
                                className="accent-amber-500 h-3.5 w-3.5 cursor-pointer"
                                checked={d.included}
                                onChange={(e) => patch({ documentsPatch: [{ docType: d.docType, included: e.target.checked }] })}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {(pkg.extraFiles || []).length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                        Other files found ({pkg.extraFiles.length}) — tick to include in the package
                      </p>
                      <div className="rounded-xl border border-border/60 divide-y divide-border/40 max-h-48 overflow-y-auto">
                        {pkg.extraFiles.map((f: any, idx: number) => (
                          <div key={f.fileId} className="flex items-center gap-2.5 px-3 py-2 text-xs">
                            <input
                              type="checkbox"
                              className="accent-amber-500 h-3.5 w-3.5 cursor-pointer shrink-0"
                              checked={f.included}
                              onChange={(e) => {
                                const extraFiles = pkg.extraFiles.map((x: any, i: number) => (i === idx ? { ...x, included: e.target.checked } : x));
                                setPkg({ ...pkg, extraFiles });
                                patch({ extraFiles });
                              }}
                            />
                            <a href={f.webViewLink} target="_blank" rel="noreferrer" className="truncate hover:underline text-foreground/90">{f.fileName}</a>
                            <span className="text-[9px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-full shrink-0">
                              {String(f.docType).replace(/_/g, " ")}
                            </span>
                            {f.folderName && <span className="text-[10px] text-muted-foreground/70 shrink-0">{f.folderName}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ─────────── STEP 3 · Review Fields ─────────── */}
              {step === 2 && (
                <div className="space-y-4">
                  <p className="text-xs text-muted-foreground">
                    Every value shows its source. Unknown values stay blank — the system never guesses. Edits are marked as manual entries.
                  </p>
                  {Object.entries(grouped).map(([group, fields]) => (
                    <div key={group}>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">{group}</p>
                      <div className="rounded-xl border border-border/60 divide-y divide-border/40">
                        {(fields as any[]).map((f) => (
                          <div key={f.key} className="grid grid-cols-12 items-center gap-2 px-3 py-2">
                            <div className="col-span-4 text-xs font-medium text-foreground/90">{f.label}</div>
                            <div className="col-span-4">
                              <input
                                className={inputCls}
                                value={f.value || ""}
                                placeholder="—"
                                onChange={(e) => updateField(f.key, e.target.value)}
                                onBlur={saveFields}
                              />
                            </div>
                            <div className="col-span-3 text-[10px] text-muted-foreground truncate" title={f.sourceDetail}>
                              {f.source}{f.sourceDetail ? ` · ${f.sourceDetail}` : ""}
                            </div>
                            <div className="col-span-1 flex justify-end"><FieldStatusDot status={f.status} /></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ─────────── STEP 4 · Compliance & Timing ─────────── */}
              {step === 3 && route && (
                <div className="space-y-5">
                  {/* Carrier references — blockers */}
                  {isTruck && (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3.5 space-y-3">
                      <p className="text-xs font-semibold text-foreground/90 flex items-center gap-1.5">
                        <ShieldAlert className="h-4 w-4 text-red-500" />
                        Carrier border references — required before Ready to Send
                      </p>
                      <p className="text-[10px] text-muted-foreground -mt-2">
                        {route.countryOfImport === "CA" ? "PARS/CCN" : "PAPS/SCN"} is carrier-provided. The ERP validates and stores it — it never creates it.
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            {route.countryOfImport === "CA" ? "PARS / CCN number" : "PAPS / SCN number"}
                          </label>
                          <input
                            className={inputCls + " mt-1"}
                            value={(route.countryOfImport === "CA" ? compliance.parsNumber : compliance.papsNumber) || ""}
                            onChange={(e) => setCompliance(route.countryOfImport === "CA" ? "parsNumber" : "papsNumber", e.target.value)}
                            onBlur={saveCompliance}
                            placeholder="From carrier email / document"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            {route.countryOfImport === "CA" ? "Canadian port of entry" : "U.S. port of entry"}
                          </label>
                          <input
                            className={inputCls + " mt-1"}
                            value={compliance.portOfEntry || ""}
                            onChange={(e) => setCompliance("portOfEntry", e.target.value)}
                            onBlur={saveCompliance}
                            placeholder="e.g. Pacific Highway, BC / Blaine, WA"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  {!isTruck && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Customs port of entry / release</label>
                        <input
                          className={inputCls + " mt-1"}
                          value={compliance.portOfEntry || ""}
                          onChange={(e) => setCompliance("portOfEntry", e.target.value)}
                          onBlur={saveCompliance}
                        />
                      </div>
                    </div>
                  )}

                  {/* US food compliance — FSVP + Prior Notice independent panels */}
                  {isUS && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      <div className="rounded-xl border border-border/60 p-3.5 space-y-2.5">
                        <p className="text-xs font-semibold text-foreground/90 flex items-center gap-1.5">
                          <Stamp className="h-3.5 w-3.5 text-amber-500" /> FSVP determination (line-level)
                        </p>
                        <label className="flex items-center gap-2 text-xs text-foreground/80 cursor-pointer">
                          <input type="checkbox" className="accent-amber-500 h-3.5 w-3.5" checked={!!compliance.isFood} onChange={(e) => { setCompliance("isFood", e.target.checked); }} onBlur={saveCompliance} />
                          Shipment contains food / FDA-regulated lines
                        </label>
                        <select
                          className={inputCls}
                          value={compliance.fsvpStatus || "UNKNOWN"}
                          onChange={(e) => { setCompliance("fsvpStatus", e.target.value); }}
                          onBlur={saveCompliance}
                          disabled={!compliance.isFood}
                        >
                          {Object.entries(FSVP_LABELS).map(([v, l]) => (
                            <option key={v} value={v}>{l}</option>
                          ))}
                        </select>
                        {compliance.fsvpStatus === "SUBJECT" && (
                          <div className="grid grid-cols-1 gap-2">
                            <input className={inputCls} placeholder="FSVP importer legal name" value={compliance.fsvpImporterName || ""} onChange={(e) => setCompliance("fsvpImporterName", e.target.value)} onBlur={saveCompliance} />
                            <input className={inputCls} placeholder="FSVP importer email" value={compliance.fsvpImporterEmail || ""} onChange={(e) => setCompliance("fsvpImporterEmail", e.target.value)} onBlur={saveCompliance} />
                            <input className={inputCls} placeholder="9-digit DUNS / UFI (required)" value={compliance.fsvpDuns || ""} onChange={(e) => setCompliance("fsvpDuns", e.target.value)} onBlur={saveCompliance} />
                          </div>
                        )}
                        {compliance.fsvpStatus === "EXEMPT" && (
                          <input className={inputCls} placeholder="Exemption basis / broker-approved code (required)" value={compliance.fsvpExemptionBasis || ""} onChange={(e) => setCompliance("fsvpExemptionBasis", e.target.value)} onBlur={saveCompliance} />
                        )}
                      </div>
                      <div className="rounded-xl border border-border/60 p-3.5 space-y-2.5">
                        <p className="text-xs font-semibold text-foreground/90 flex items-center gap-1.5">
                          <ShieldCheck className="h-3.5 w-3.5 text-amber-500" /> FDA Prior Notice (independent from FSVP)
                        </p>
                        <select
                          className={inputCls}
                          value={compliance.priorNoticeResponsible || ""}
                          onChange={(e) => setCompliance("priorNoticeResponsible", e.target.value)}
                          onBlur={saveCompliance}
                          disabled={!compliance.isFood}
                        >
                          <option value="">Responsible party — select…</option>
                          <option value="BROKER">Broker files Prior Notice</option>
                          <option value="VIDA_BUDDIES">Vida Buddies files</option>
                          <option value="OTHER">Other party</option>
                        </select>
                        <input
                          className={inputCls}
                          placeholder="Confirmation number (when submitted)"
                          value={compliance.priorNoticeConfirmation || ""}
                          onChange={(e) => setCompliance("priorNoticeConfirmation", e.target.value)}
                          onBlur={saveCompliance}
                          disabled={!compliance.isFood}
                        />
                        <p className="text-[10px] text-muted-foreground">
                          An FSVP exemption never satisfies Prior Notice. Minimums: road 2h · rail/air 4h · water 8h before arrival.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Deadlines */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Deadline plan — recalculates automatically when dates or route change
                    </p>
                    <div className="rounded-xl border border-border/60 divide-y divide-border/40">
                      {(pkg.deadlines || []).length === 0 && (
                        <p className="text-xs text-muted-foreground px-3 py-3">Add ETD / ETA / border ETA dates in step 1 to activate the deadline plan.</p>
                      )}
                      {(pkg.deadlines || []).map((d: any) => {
                        const st = deadlineStatus(new Date(d.dueAt).toISOString(), d.severity);
                        const cls =
                          st === "overdue" || st === "red"
                            ? "text-red-500 bg-red-500/10 border-red-500/25"
                            : st === "amber"
                            ? "text-amber-500 bg-amber-500/10 border-amber-500/25"
                            : "text-emerald-500 bg-emerald-500/10 border-emerald-500/25";
                        const Icon = st === "overdue" ? AlertTriangle : st === "red" ? ShieldAlert : Clock;
                        return (
                          <div key={d.key} className="flex items-center gap-3 px-3 py-2.5">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border shrink-0 ${cls}`}>
                              <Icon className="h-3 w-3" />
                              {countdownLabel(new Date(d.dueAt).toISOString())}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-foreground/90 truncate">
                                {d.label} {d.estimated && <span className="text-amber-500 text-[10px]">(estimated)</span>}
                              </p>
                              <p className="text-[10px] text-muted-foreground truncate">
                                {new Date(d.dueAt).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                {" · "}{d.basis}{d.owner ? ` · Owner: ${d.owner}` : ""}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ─────────── STEP 5 · Preview & Send ─────────── */}
              {step === 4 && (
                <div className="space-y-5">
                  {/* Readiness summary — separate indicators, not one % */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                    {[
                      { label: "Documents received", value: `${receivedCount}/${(pkg.documents || []).length}`, ok: criticalMissing.length === 0, icon: FileCheck2 },
                      { label: "Fields populated", value: `${(pkg.fields || []).length - missingFieldCount}/${(pkg.fields || []).length}`, ok: missingFieldCount === 0, icon: ClipboardCheck },
                      { label: "Send blockers", value: String(blockers.length), ok: blockers.length === 0, icon: ShieldAlert },
                      { label: "Deadlines tracked", value: String((pkg.deadlines || []).length), ok: true, icon: Clock },
                    ].map((c) => {
                      const Icon = c.icon;
                      return (
                        <div key={c.label} className={`rounded-xl border p-3 ${c.ok ? "border-border/60 bg-muted/20" : "border-red-500/40 bg-red-500/5"}`}>
                          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            <Icon className={`h-3.5 w-3.5 ${c.ok ? "text-emerald-500" : "text-red-500"}`} /> {c.label}
                          </div>
                          <p className={`text-lg font-bold mt-1 ${c.ok ? "text-foreground/90" : "text-red-500"}`}>{c.value}</p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Blockers */}
                  {blockers.length > 0 && (
                    <div className="rounded-xl border border-red-500/40 bg-red-500/5 p-3.5">
                      <p className="text-xs font-semibold text-red-500 flex items-center gap-1.5 mb-1.5">
                        <ShieldAlert className="h-4 w-4" /> Not Ready to Send — {blockers.length} blocker{blockers.length > 1 ? "s" : ""}
                      </p>
                      <ul className="space-y-1">
                        {blockers.map((b) => (
                          <li key={b} className="text-[11px] text-foreground/80 flex items-start gap-1.5">
                            <X className="h-3 w-3 text-red-500 mt-0.5 shrink-0" /> {b}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Generate */}
                  <div className="rounded-xl border border-border/60 p-3.5">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground/90 flex items-center gap-1.5">
                          <FileText className="h-4 w-4 text-amber-500" />
                          {packageFileName(pkg.shipNumber, primaryType, pkg.version)}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Cover sheet + readiness summary + document index + deadline plan → saved to “{GENERATED_FOLDER}” in this shipment's folder.
                        </p>
                      </div>
                      <Button size="sm" className="h-8 text-xs gap-1.5 bg-amber-600 hover:bg-amber-700 text-white shrink-0" onClick={generatePackage} disabled={generating || !folderId}>
                        {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                        Generate Package PDF
                      </Button>
                    </div>
                    {(pkg.generated || []).length > 0 && (
                      <div className="mt-2.5 pt-2.5 border-t border-border/40 space-y-1">
                        {pkg.generated.map((g: any, i: number) => (
                          <a key={i} href={g.webViewLink} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[11px] text-primary hover:underline">
                            <FileCheck2 className="h-3 w-3" /> {g.fileName}
                            <span className="text-muted-foreground">· {new Date(g.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Send */}
                  <div className="rounded-xl border border-border/60 p-3.5 space-y-3">
                    <p className="text-xs font-semibold text-foreground/90 flex items-center gap-1.5">
                      <Send className="h-4 w-4 text-amber-500" /> Send to {pkg.brokerName || "broker"}
                    </p>
                    <div>
                      <div className="flex flex-wrap gap-1.5 mb-1.5">
                        {recipients.map((r) => (
                          <span key={r} className="inline-flex items-center gap-1 text-[10px] font-medium bg-muted/50 border border-border/60 px-2 py-0.5 rounded-full">
                            {r}
                            <button onClick={() => { const next = recipients.filter((x) => x !== r); setRecipients(next); patch({ brokerEmails: next }); }} className="hover:text-red-500">
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          className={inputCls}
                          placeholder="broker@example.com — press Enter to add"
                          value={recipientInput}
                          onChange={(e) => setRecipientInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addRecipient(); } }}
                        />
                        <Button size="sm" variant="outline" className="h-8 text-xs gap-1 shrink-0" onClick={addRecipient}>
                          <Plus className="h-3 w-3" /> Add
                        </Button>
                      </div>
                    </div>
                    <textarea
                      className="w-full rounded-lg border border-border/60 bg-muted/30 px-2.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500/50 min-h-[56px]"
                      placeholder="Optional note to the broker…"
                      value={sendNote}
                      onChange={(e) => setSendNote(e.target.value)}
                    />
                    <label className="flex items-start gap-2 text-[11px] text-foreground/80 cursor-pointer">
                      <input type="checkbox" className="accent-amber-500 h-3.5 w-3.5 mt-0.5" checked={approved} onChange={(e) => setApproved(e.target.checked)} />
                      I am authorized to approve this package and confirm the recipients, references and included documents are correct. No signature is applied automatically.
                    </label>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <p className="text-[10px] text-muted-foreground">
                        {pkg.sends?.length > 0
                          ? `Last sent ${new Date(pkg.sends[pkg.sends.length - 1].at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} · acknowledgement follow-up is tracked`
                          : "Send evidence and the acknowledgement timer are recorded automatically."}
                      </p>
                      <Button
                        size="sm"
                        className="h-8 text-xs gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
                        onClick={sendToBroker}
                        disabled={sending || blockers.length > 0 || !approved || recipients.length === 0}
                      >
                        {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                        Approve & Send to Broker
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer nav */}
        <div className="shrink-0 border-t border-border/60 px-5 py-3 flex items-center justify-between">
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || loading}>
            <ChevronLeft className="h-3.5 w-3.5" /> Back
          </Button>
          <p className="text-[10px] text-muted-foreground hidden sm:block">
            Autosaved · Exit anytime and resume where you left off
          </p>
          {step < 4 ? (
            <Button size="sm" className="h-8 text-xs gap-1 bg-amber-600 hover:bg-amber-700 text-white" onClick={() => setStep((s) => Math.min(4, s + 1))} disabled={loading || !pkg}>
              Next <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
