"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { EmailComposeDialog, EmailInitialData } from "@/components/email-compose-dialog";
import {
  Paperclip, Upload, FolderOpen, Loader2, FileText, Image, File,
  Eye, EyeOff, Package, Ship, ShoppingCart,
  FileVideo, FileAudio, FileSpreadsheet, FileArchive, FileType,
  X, Check, ExternalLink, CloudUpload, CheckCircle, AlertCircle, XCircle, Search, Mail, Trash2, Combine, Send, Download,
  FolderPlus, ArrowRightLeft,
} from "lucide-react";

/* ─── Types ─── */
interface DocRecord {
  documentName: string;
  documentLink: string;
  documentType: "Internal" | "External";
  driveFileId: string;
  mimeType: string;
  size: string;
  createdBy: string;
  createdAt: string;
}

interface SidebarItem {
  id: string;          // _id of the record
  label: string;       // VBNumber / VBSerialNumber / VBShipmentNumber
  kind: "VBNumber" | "VBSerialNumber" | "VBShipmentNumber";
  collection: "vidapos" | "vbcustomerpos" | "vbshippings";
  docs: DocRecord[];
}

interface DriveDocumentsModalProps {
  open: boolean;
  onClose: () => void;
  poNumber: string;
  onOpenLegacy?: () => void;
}

/* ─── Helpers ─── */
function getIcon(mime: string) {
  const cls = "h-5 w-5";
  if (mime?.startsWith("image/")) return <Image className={cn(cls, "text-emerald-500")} />;
  if (mime?.startsWith("video/")) return <FileVideo className={cn(cls, "text-purple-500")} />;
  if (mime?.startsWith("audio/")) return <FileAudio className={cn(cls, "text-orange-500")} />;
  if (mime?.includes("pdf")) return <FileText className={cn(cls, "text-red-500")} />;
  if (mime?.includes("spreadsheet") || mime?.includes("excel")) return <FileSpreadsheet className={cn(cls, "text-green-600")} />;
  if (mime?.includes("zip") || mime?.includes("archive")) return <FileArchive className={cn(cls, "text-amber-600")} />;
  if (mime?.includes("word") || mime?.includes("document")) return <FileText className={cn(cls, "text-blue-600")} />;
  return <File className={cn(cls, "text-muted-foreground")} />;
}

function fmtSize(bytes: string | number): string {
  const s = typeof bytes === "string" ? parseInt(bytes, 10) : bytes;
  if (!s) return "—";
  if (s < 1024) return `${s} B`;
  if (s < 1048576) return `${(s / 1024).toFixed(1)} KB`;
  return `${(s / 1048576).toFixed(1)} MB`;
}

function fmtDate(d: string): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function kindIcon(kind: string) {
  if (kind === "VBNumber") return <Package className="h-3.5 w-3.5" />;
  if (kind === "VBSerialNumber") return <ShoppingCart className="h-3.5 w-3.5" />;
  return <Ship className="h-3.5 w-3.5" />;
}

function kindColor(kind: string) {
  if (kind === "VBNumber") return "text-blue-500";
  if (kind === "VBSerialNumber") return "text-amber-500";
  return "text-emerald-500";
}

function thumbUrl(fileId: string) {
  return `/api/admin/drive/thumbnail?fileId=${fileId}`;
}

/* ─── Preview Panel (extracted for its own state) ─── */

function PreviewPanel({ previewFile, onClose }: { previewFile: DocRecord; onClose: () => void }) {
  const [previewLoading, setPreviewLoading] = useState(true);

  // Reset loading when file changes; instantly dismiss for audio/fallback
  useEffect(() => {
    const m = previewFile.mimeType || "";
    const needsLoading = m.startsWith("image/") || m.startsWith("video/") ||
      m.includes("pdf") || m.includes("spreadsheet") || m.includes("excel") || m.includes("csv") ||
      m.includes("ms-excel") || m.includes("word") || m.includes("document") || m.includes("msword") ||
      m.includes("presentation") || m.includes("powerpoint") || m.includes("google-apps") ||
      m.startsWith("text/") || m.includes("openxmlformats");
    setPreviewLoading(needsLoading);
  }, [previewFile.driveFileId, previewFile.mimeType]);

  const mime = previewFile.mimeType || "";
  const drivePreviewUrl = `https://drive.google.com/file/d/${previewFile.driveFileId}/preview`;
  const imgDirectUrl = `https://lh3.googleusercontent.com/d/${previewFile.driveFileId}=w1600`;
  const downloadUrl = `https://drive.google.com/uc?export=download&id=${previewFile.driveFileId}`;

  /** True if this mime type can be rendered inline via Google Drive preview */
  const canDrivePreview =
    mime.includes("pdf") ||
    mime.includes("spreadsheet") || mime.includes("excel") || mime.includes("csv") ||
    mime.includes("ms-excel") || mime.includes("openxmlformats-officedocument.spreadsheetml") ||
    mime.includes("word") || mime.includes("document") || mime.includes("msword") ||
    mime.includes("openxmlformats-officedocument.wordprocessingml") ||
    mime.includes("presentation") || mime.includes("powerpoint") ||
    mime.includes("openxmlformats-officedocument.presentationml") ||
    mime.includes("google-apps") ||
    mime.startsWith("text/");

  const isImage = mime.startsWith("image/");
  const isVideo = mime.startsWith("video/");
  const isAudio = mime.startsWith("audio/");

  const renderPreviewContent = () => {
    // Images — use thumbnail API (much faster than proxy, Google serves it from CDN)
    if (isImage) {
      return (
        <div className="w-full h-full flex items-center justify-center overflow-auto p-4" style={{ pointerEvents: "auto" }}>
          <img
            src={imgDirectUrl}
            alt={previewFile.documentName}
            className={cn("max-w-full max-h-full object-contain transition-opacity duration-300", previewLoading ? "opacity-0" : "opacity-100")}
            onLoad={() => setPreviewLoading(false)}
            onError={() => setPreviewLoading(false)}
          />
        </div>
      );
    }

    // PDFs, Office files, Google Apps, Text — Google Drive preview iframe (loads directly from Google, no proxy)
    if (canDrivePreview) {
      return (
        <iframe
          key={previewFile.driveFileId}
          src={drivePreviewUrl}
          className="w-full h-full border-0"
          title={`Preview: ${previewFile.documentName}`}
          allow="autoplay"
          onLoad={() => setPreviewLoading(false)}
          style={{ pointerEvents: "auto" }}
        />
      );
    }

    // Video — native <video> (uses proxy for serving the actual file bytes)
    if (isVideo) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-black p-4" style={{ pointerEvents: "auto" }}>
          <video
            src={`/api/admin/drive/preview/${previewFile.driveFileId}`}
            controls
            className="max-w-full max-h-full rounded-lg"
            onLoadedData={() => setPreviewLoading(false)}
            style={{ pointerEvents: "auto" }}
          />
        </div>
      );
    }

    // Audio — native <audio>
    if (isAudio) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center gap-6 p-8" style={{ pointerEvents: "auto" }}>
          <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-orange-500/20 to-orange-600/5 border border-orange-500/20 flex items-center justify-center shadow-xl">
            <FileAudio className="h-10 w-10 text-orange-500" />
          </div>
          <p className="text-sm font-semibold text-foreground">{previewFile.documentName}</p>
          <audio src={`/api/admin/drive/preview/${previewFile.driveFileId}`} controls className="w-full max-w-md" style={{ pointerEvents: "auto" }} />
        </div>
      );
    }

    // Fallback — no inline preview
    const ext = previewFile.documentName?.split(".").pop()?.toUpperCase() || "FILE";
    const typeIcon = (mime.includes("zip") || mime.includes("rar") || mime.includes("archive"))
      ? <FileArchive className="h-8 w-8 text-amber-600" />
      : <File className="h-8 w-8 text-muted-foreground" />;
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-5 p-8" style={{ pointerEvents: "auto" }}>
        <div className="h-28 w-28 rounded-3xl bg-gradient-to-br from-muted/40 to-muted/20 border-2 border-border/40 flex items-center justify-center shadow-xl">
          <div className="scale-150">{typeIcon}</div>
        </div>
        <div className="text-center space-y-1.5">
          <p className="text-base font-bold text-foreground">{previewFile.documentName}</p>
          <p className="text-xs text-muted-foreground">{ext} • {fmtSize(previewFile.size)}</p>
          <p className="text-xs text-muted-foreground/50 mt-2">Preview is not available for this file type</p>
        </div>
        <div className="flex items-center gap-2 mt-2">
          {previewFile.documentLink && (
            <Button size="sm" className="gap-1.5" asChild>
              <a href={previewFile.documentLink} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                Open in Google Drive
              </a>
            </Button>
          )}
          <Button size="sm" variant="outline" className="gap-1.5" asChild>
            <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
              <Download className="h-3.5 w-3.5" />
              Download
            </a>
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-y-0 right-0 w-[50vw] flex flex-col bg-background border-l border-border/40 shadow-2xl animate-in slide-in-from-right duration-200"
      style={{ zIndex: 9999, pointerEvents: "auto" }}
      onWheel={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/40 bg-gradient-to-r from-background to-muted/10 shrink-0">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {getIcon(previewFile.mimeType)}
          <div className="min-w-0">
            <p className="text-sm font-bold truncate">{previewFile.documentName}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full",
                previewFile.documentType === "Internal" ? "bg-primary/10 text-primary" : "bg-amber-500/10 text-amber-600")}>{previewFile.documentType}</span>
              <span className="text-[10px] text-muted-foreground">{fmtSize(previewFile.size)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="icon" variant="ghost" className="h-9 w-9 rounded-lg shrink-0" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative" style={{ pointerEvents: "auto" }}>
        {/* Loading overlay */}
        {previewLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm gap-3">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10 flex items-center justify-center shadow-lg">
              {getIcon(previewFile.mimeType)}
            </div>
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Loading preview…</span>
            </div>
          </div>
        )}
        {renderPreviewContent()}
      </div>
    </div>
  );
}

/* ─── Component ─── */
export function DriveDocumentsModal({ open, onClose, poNumber, onOpenLegacy }: DriveDocumentsModalProps) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<SidebarItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState<DocRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [mergeFileName, setMergeFileName] = useState("");
  const [merging, setMerging] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Email
  const [emailComposeOpen, setEmailComposeOpen] = useState(false);
  const [emailComposeMode, setEmailComposeMode] = useState<"compose" | "view">("compose");
  const [emailInitialData, setEmailInitialData] = useState<EmailInitialData | undefined>(undefined);
  const [emailRecords, setEmailRecords] = useState<any[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [showEmailHistory, setShowEmailHistory] = useState(false);
  const [docTypeFilter, setDocTypeFilter] = useState<"all" | "Internal" | "External">("all");

  // New folder
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);

  // Move files
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [moving, setMoving] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Upload progress
  const [uploadFiles, setUploadFiles] = useState<{ name: string; status: "pending" | "uploading" | "done" | "error" }[]>([]);
  const [uploadCompleted, setUploadCompleted] = useState(0);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [uploadStartTime, setUploadStartTime] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const fetchDocs = useCallback(async () => {
    if (!poNumber) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/drive-documents?vbNumber=${encodeURIComponent(poNumber)}`);
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); setLoading(false); return; }

      const result: SidebarItem[] = [];
      if (data.po) {
        result.push({ id: data.po._id, label: data.po.VBNumber, kind: "VBNumber", collection: "vidapos", docs: data.po.driveDocuments || [] });
      }
      for (const c of (data.cpos || [])) {
        result.push({ id: c._id, label: c.VBSerialNumber, kind: "VBSerialNumber", collection: "vbcustomerpos", docs: c.driveDocuments || [] });
      }
      for (const s of (data.ships || [])) {
        result.push({ id: s._id, label: s.VBShipmentNumber, kind: "VBShipmentNumber", collection: "vbshippings", docs: s.driveDocuments || [] });
      }
      setItems(result);
    } catch { toast.error("Failed to load documents"); }
    finally { setLoading(false); }
  }, [poNumber]);

  useEffect(() => {
    if (open) {
      fetchDocs();
      setSelected(null);
      setPreviewFile(null);
    }
  }, [open, fetchDocs]);

  // Intercept Escape: close preview first
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && previewFile) {
        e.preventDefault(); e.stopPropagation();
        setPreviewFile(null);
      }
    };
    window.addEventListener("keydown", handleKey, true);
    return () => window.removeEventListener("keydown", handleKey, true);
  }, [open, previewFile]);

  const selectedItem = items.find(i => i.id === selected) || null;

  // All docs or selected docs
  const visibleDocs: { doc: DocRecord; source: string; kind: string }[] = [];
  if (selectedItem) {
    for (const d of selectedItem.docs) visibleDocs.push({ doc: d, source: selectedItem.label, kind: selectedItem.kind });
  } else {
    for (const item of items) {
      for (const d of item.docs) visibleDocs.push({ doc: d, source: item.label, kind: item.kind });
    }
  }

  const totalDocs = items.reduce((sum, i) => sum + i.docs.length, 0);

  // Search + type filter
  const filteredDocs = visibleDocs.filter(v => {
    if (searchQuery.trim() && !v.doc.documentName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (docTypeFilter !== "all" && v.doc.documentType !== docTypeFilter) return false;
    return true;
  });

  // ── Email filtering by sidebar selection ──
  const getEmailsForItem = useCallback((item: SidebarItem | null): any[] => {
    if (!item) return emailRecords; // "All" — show everything
    return emailRecords.filter((e: any) => {
      const ref = (e.reference || "").trim();
      const fp = (e.folderPath || "").trim();
      if (item.kind === "VBShipmentNumber") {
        // Match by reference (exact shipment ID) or folderPath containing the label
        return ref === item.label || fp.includes(item.label);
      }
      if (item.kind === "VBSerialNumber") {
        // CPO: match by folderPath containing the CPO label, but not a shipment-level match
        return fp.includes(item.label);
      }
      // PO: match emails with no reference and folderPath matching PO or empty
      return (!ref && (!fp || fp === item.label)) || fp === item.label;
    });
  }, [emailRecords]);

  const filteredEmails = getEmailsForItem(selectedItem);
  const totalEmails = emailRecords.length;

  const selCount = selectedIds.length;
  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Helper: get selected doc records with their source item info
  const getSelectedDocs = () => {
    return filteredDocs.filter((_, idx) => {
      const d = filteredDocs[idx].doc;
      const cardId = `${d.driveFileId}-${idx}`;
      return selectedIds.includes(cardId);
    });
  };

  /* ─── Delete handler ─── */
  const handleDelete = async () => {
    if (selCount === 0) return;
    setDeleteConfirmOpen(false);
    setDeleting(true);
    try {
      // Group by source item (collection + recordId)
      const bySource = new Map<string, { collection: string; recordId: string; driveFileIds: string[] }>();
      for (const selId of [...selectedIds]) {
        const idx = filteredDocs.findIndex((_, i) => `${filteredDocs[i].doc.driveFileId}-${i}` === selId);
        if (idx < 0) continue;
        const item = items.find(it => it.docs.includes(filteredDocs[idx].doc));
        if (!item) continue;
        const key = `${item.collection}:${item.id}`;
        if (!bySource.has(key)) bySource.set(key, { collection: item.collection, recordId: item.id, driveFileIds: [] });
        bySource.get(key)!.driveFileIds.push(filteredDocs[idx].doc.driveFileId);
      }
      for (const [, src] of bySource) {
        const res = await fetch("/api/admin/drive-documents", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(src),
        });
        if (!res.ok) {
          const data = await res.json();
          console.error("[Delete] API error:", data);
        }
      }
      toast.success(`${selCount} file(s) deleted`);
      setSelectedIds([]);
      fetchDocs();
    } catch { toast.error("Delete failed"); }
    finally { setDeleting(false); }
  };

  /* ─── Merge handler ─── */
  const handleMergeClick = () => {
    const timestamp = new Date().toISOString().split("T")[0];
    setMergeFileName(`Merged_${poNumber}_${timestamp}`);
    setMergeDialogOpen(true);
  };

  const handleMerge = async () => {
    if (!mergeFileName.trim()) { toast.error("Filename is required"); return; }
    setMerging(true);
    try {
      // Build fileIds in selection order (preserves user's numbered order)
      const fileIds: string[] = [];
      let sourceItem: SidebarItem | undefined;
      for (const selId of selectedIds) {
        const idx = filteredDocs.findIndex((item, i) => `${item.doc.driveFileId}-${i}` === selId);
        if (idx < 0) continue;
        const item = filteredDocs[idx];
        if (item.doc.driveFileId) {
          fileIds.push(item.doc.driveFileId);
          if (!sourceItem) {
            sourceItem = items.find(it => it.docs.includes(item.doc));
          }
        }
      }

      if (fileIds.length < 2) {
        toast.error("Need at least 2 files with valid IDs to merge");
        setMerging(false);
        return;
      }

      // Determine where to save: selectedItem first, else source of first selected doc
      const targetItem = selectedItem || sourceItem;

      const res = await fetch("/api/admin/drive/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileIds, poNumber, fileName: mergeFileName.trim() }),
      });
      const data = await res.json();
      console.log("[Merge] Response:", data);
      if (res.ok) {
        // Save merged doc to the target collection
        if (targetItem && data.uploaded) {
          const docRecord = {
            documentName: (mergeFileName.trim().endsWith('.pdf') ? mergeFileName.trim() : `${mergeFileName.trim()}.pdf`),
            documentLink: data.uploaded.webViewLink || "",
            documentType: "Internal",
            driveFileId: data.uploaded.id || "",
            mimeType: "application/pdf",
            size: data.uploaded.size || "0",
            createdAt: new Date().toISOString(),
          };
          console.log("[Merge] Saving doc record:", { collection: targetItem.collection, recordId: targetItem.id, document: docRecord });
          const saveRes = await fetch("/api/admin/drive-documents", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ collection: targetItem.collection, recordId: targetItem.id, document: docRecord }),
          });
          const saveData = await saveRes.json();
          console.log("[Merge] Save result:", saveData);
        } else {
          console.warn("[Merge] No target item or uploaded data:", { targetItem: !!targetItem, uploaded: !!data.uploaded });
        }
        toast.success("Documents merged successfully");
        setSelectedIds([]);
        setMergeDialogOpen(false);
        fetchDocs();
      } else {
        toast.error("Merge failed", { description: data.error });
      }
    } catch (e) { console.error("[Merge] Error:", e); toast.error("Merge failed"); }
    finally { setMerging(false); }
  };

  /* ─── Email handler ─── */
  const fetchEmailRecords = useCallback(async () => {
    if (!poNumber) return;
    setLoadingEmails(true);
    try {
      const res = await fetch(`/api/admin/emails?vbpoNo=${encodeURIComponent(poNumber)}`);
      const data = await res.json();
      if (res.ok) setEmailRecords(data.emails || []);
    } catch { /* silent */ }
    finally { setLoadingEmails(false); }
  }, [poNumber]);

  const handleEmail = () => {
    const docs = getSelectedDocs().filter(d => d.doc.documentType === "External");
    if (docs.length === 0) {
      toast.error("No External documents selected", { description: "Email is only available for documents marked as External" });
      return;
    }
    const attachments = docs.map(d => ({
      id: d.doc.driveFileId,
      name: d.doc.documentName,
      mimeType: d.doc.mimeType || "application/octet-stream",
      size: d.doc.size || "0",
    }));
    setEmailInitialData(undefined);
    setEmailComposeMode("compose");
    setEmailComposeOpen(true);
    // Store attachments temporarily for the compose dialog via state
    setEmailAttachments(attachments);
  };

  const [emailAttachments, setEmailAttachments] = useState<{ id: string; name: string; mimeType: string; size: string }[]>([]);

  /* ─── Upload handler ─── */
  const handleUpload = async (fileList: FileList | null, targetItem?: SidebarItem | null) => {
    const uploadTarget = targetItem || selectedItem;
    if (!fileList || fileList.length === 0 || !uploadTarget) return;
    const files = Array.from(fileList);
    const total = files.length;
    setUploading(true);
    setUploadTotal(total);
    setUploadCompleted(0);
    setUploadStartTime(Date.now());
    setUploadFiles(files.map(f => ({ name: f.name, status: "pending" as const })));
    let successCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: "uploading" } : f));
      try {
        const formData = new FormData();
        formData.append("poNumber", poNumber);
        formData.append("file", file);
        const res = await fetch("/api/admin/drive", { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok) {
          setUploadFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: "error" } : f));
          continue;
        }
        const docRecord = {
          documentName: file.name,
          documentLink: data.uploaded?.webViewLink || "",
          documentType: "Internal",
          driveFileId: data.uploaded?.id || "",
          mimeType: data.uploaded?.mimeType || file.type || "application/octet-stream",
          size: data.uploaded?.size || String(file.size),
          createdAt: new Date().toISOString(),
        };
        await fetch("/api/admin/drive-documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ collection: uploadTarget.collection, recordId: uploadTarget.id, document: docRecord }),
        });
        successCount++;
        setUploadCompleted(prev => prev + 1);
        setUploadFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: "done" } : f));
      } catch {
        setUploadFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: "error" } : f));
      }
    }

    setUploading(false);
    if (successCount > 0) toast.success(`${successCount} file(s) uploaded`);
    fetchDocs();
    setTimeout(() => { setUploadFiles([]); setUploadCompleted(0); setUploadTotal(0); }, 4000);
  };

  /* ─── Drag & Drop handler ─── */
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (e.dataTransfer.files.length) {
      // If no item is selected, auto-select the first PO item
      const dropTarget = selectedItem || items.find(i => i.kind === "VBNumber") || items[0];
      if (!dropTarget) {
        toast.error("No target available for upload");
        return;
      }
      if (!selectedItem) {
        setSelected(dropTarget.id);
      }
      handleUpload(e.dataTransfer.files, dropTarget);
    }
  };

  // Sidebar grouping
  const poItems = items.filter(i => i.kind === "VBNumber");
  const cpoItems = items.filter(i => i.kind === "VBSerialNumber");
  const shipItems = items.filter(i => i.kind === "VBShipmentNumber");

  /* ─── Create Folder handler ─── */
  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !selectedItem) return;
    setCreatingFolder(true);
    try {
      // Use the drive API to create a folder — we need the parent folder ID from Drive
      // First resolve the parent folder path for this item
      const poLabel = poItems[0]?.label || poNumber;
      let driveUrl = `/api/admin/drive?poNumber=${encodeURIComponent(poLabel)}`;
      if (selectedItem.kind === "VBSerialNumber") {
        driveUrl += `&spoNumber=${encodeURIComponent(selectedItem.label)}`;
      } else if (selectedItem.kind === "VBShipmentNumber") {
        // Find the parent CPO for this shipment
        const parentCpoId = (items.find(i => i.kind === "VBShipmentNumber" && i.id === selectedItem.id) as any);
        driveUrl += `&spoNumber=${encodeURIComponent(selectedItem.label)}`;
      }
      // Resolve the parent folder
      const resolveRes = await fetch(driveUrl);
      const resolveData = await resolveRes.json();
      const parentFolderId = resolveData.folderId;

      if (!parentFolderId) {
        toast.error("Could not resolve parent folder");
        return;
      }

      // Create the subfolder
      const createRes = await fetch(driveUrl + `&ensureChildren=${encodeURIComponent(newFolderName.trim())}`);
      const createData = await createRes.json();
      if (createRes.ok) {
        toast.success(`Folder "${newFolderName.trim()}" created`);
        setNewFolderOpen(false);
        setNewFolderName("");
        fetchDocs();
      } else {
        toast.error("Failed to create folder", { description: createData.error });
      }
    } catch {
      toast.error("Failed to create folder");
    } finally {
      setCreatingFolder(false);
    }
  };

  /* ─── Move files handler ─── */
  const handleMoveFiles = async (targetItem: SidebarItem) => {
    if (selectedIds.length === 0 || !targetItem) return;
    setMoving(true);
    try {
      // Group selected files by source item
      const bySource = new Map<string, { collection: string; recordId: string; driveFileIds: string[] }>();
      for (const selId of [...selectedIds]) {
        const idx = filteredDocs.findIndex((_, i) => `${filteredDocs[i].doc.driveFileId}-${i}` === selId);
        if (idx < 0) continue;
        const item = items.find(it => it.docs.includes(filteredDocs[idx].doc));
        if (!item || item.id === targetItem.id) continue; // Skip if same target
        const key = `${item.collection}:${item.id}`;
        if (!bySource.has(key)) bySource.set(key, { collection: item.collection, recordId: item.id, driveFileIds: [] });
        bySource.get(key)!.driveFileIds.push(filteredDocs[idx].doc.driveFileId);
      }

      let totalMoved = 0;
      for (const [, src] of bySource) {
        const res = await fetch("/api/admin/drive-documents", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceCollection: src.collection,
            sourceRecordId: src.recordId,
            targetCollection: targetItem.collection,
            targetRecordId: targetItem.id,
            driveFileIds: src.driveFileIds,
          }),
        });
        const data = await res.json();
        if (res.ok) totalMoved += data.moved || 0;
      }

      if (totalMoved > 0) {
        toast.success(`${totalMoved} file(s) moved to ${targetItem.label}`);
        setSelectedIds([]);
        setMoveDialogOpen(false);
        fetchDocs();
      } else {
        toast.error("No files were moved");
      }
    } catch { toast.error("Move failed"); }
    finally { setMoving(false); }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => {
        if (!v) {
          if (previewFile) { setPreviewFile(null); return; }
          onClose();
        }
      }}>
        <DialogContent
          className="max-w-6xl h-[88vh] flex flex-col p-0 gap-0 overflow-hidden [&>button[data-slot=dialog-close]]:hidden"
          onInteractOutside={(e) => { if (previewFile) e.preventDefault(); }}
          onPointerDownOutside={(e) => { if (previewFile) e.preventDefault(); }}
        >
          {/* HEADER */}
          <div className="flex items-center justify-between px-6 py-3.5 border-b border-border/40 bg-gradient-to-r from-background to-muted/20 shrink-0">
            <DialogHeader className="p-0 space-y-0">
              <DialogTitle className="text-lg font-bold flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10 flex items-center justify-center shadow-sm">
                  <Paperclip className="h-4 w-4 text-primary" />
                </div>
                Attachments
              </DialogTitle>
              <DialogDescription className="sr-only">Manage attachments</DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2">
              {/* Documents / Emails toggle */}
              <div className="flex items-center bg-muted/40 rounded-lg p-0.5 border border-border/40">
                <button
                  onClick={() => { setShowEmailHistory(false); }}
                  className={cn("h-7 px-3 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5",
                    !showEmailHistory ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                >
                  <Paperclip className="h-3 w-3" /> Documents
                </button>
                <button
                  onClick={() => { setShowEmailHistory(true); fetchEmailRecords(); }}
                  className={cn("h-7 px-3 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5",
                    showEmailHistory ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                >
                  <Mail className="h-3 w-3" /> Emails
                  {emailRecords.length > 0 && (
                    <span className="text-[9px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{emailRecords.length}</span>
                  )}
                </button>
              </div>
              {/* Search — always visible */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder={showEmailHistory ? "Search emails..." : "Search files..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 w-48 rounded-lg border border-border/60 bg-muted/30 pl-8 pr-3 text-xs placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all"
                />
              </div>
              {!showEmailHistory && selectedItem && (
                <>
                  <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => {
                    toast.info("Please allow the browser prompt to upload folder structure");
                    folderInputRef.current?.click();
                  }} disabled={uploading}>
                    <FolderOpen className="h-3.5 w-3.5" /> Folder
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => { setNewFolderName(""); setNewFolderOpen(true); }}>
                    <FolderPlus className="h-3.5 w-3.5" /> New Folder
                  </Button>
                  <Button size="sm" className="h-8 text-xs gap-1.5 shadow-sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    Upload to {selectedItem.label}
                  </Button>
                </>
              )}
              <button onClick={onClose} className="h-8 w-8 rounded-lg bg-muted hover:bg-muted/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors ml-1">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Hidden inputs */}
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => { handleUpload(e.target.files); e.target.value = ""; }} />
          <input ref={folderInputRef} type="file" multiple
            // @ts-ignore
            webkitdirectory="" className="hidden" onChange={(e) => { handleUpload(e.target.files); e.target.value = ""; }} />

          {/* BODY */}
          <div
            className={cn("flex flex-1 min-h-0 overflow-hidden relative", dragOver && "bg-primary/5")}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >

            {/* Sidebar */}
            <div className="w-[200px] border-r bg-muted/10 flex flex-col shrink-0 overflow-y-auto">
              {/* All */}
              <button onClick={() => { setSelected(null); setPreviewFile(null); }}
                className={cn("w-full text-left px-4 py-3 text-xs font-semibold transition-all border-l-2 flex items-center justify-between",
                  !selected ? "bg-primary/10 text-primary border-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border-transparent")}>
                <span className="flex items-center gap-2"><Paperclip className="h-3.5 w-3.5" /> All</span>
                <span className="text-[10px] font-bold bg-muted/60 px-1.5 py-0.5 rounded-full">{showEmailHistory ? totalEmails : totalDocs}</span>
              </button>

              {/* PO */}
              {poItems.length > 0 && (
                <div>
                  <div className="px-4 pt-3 pb-1"><p className="text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground/50">Purchase Order</p></div>
                  {poItems.map(item => (
                    <button key={item.id} onClick={() => { setSelected(item.id); setPreviewFile(null); }}
                      className={cn("w-full text-left px-4 py-2.5 text-xs font-medium transition-all border-l-2 flex items-center justify-between gap-2",
                        selected === item.id ? "bg-primary/10 text-primary border-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border-transparent")}>
                      <span className="flex items-center gap-2 truncate"><span className={kindColor(item.kind)}>{kindIcon(item.kind)}</span><span className="truncate">{item.label}</span></span>
                      <span className="text-[10px] font-bold bg-muted/60 px-1.5 py-0.5 rounded-full shrink-0">{showEmailHistory ? getEmailsForItem(item).length : item.docs.length}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* CPOs */}
              {cpoItems.length > 0 && (
                <div>
                  <div className="px-4 pt-3 pb-1"><p className="text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground/50">Customer POs</p></div>
                  {cpoItems.map(item => (
                    <button key={item.id} onClick={() => { setSelected(item.id); setPreviewFile(null); }}
                      className={cn("w-full text-left px-4 py-2.5 text-xs font-medium transition-all border-l-2 flex items-center justify-between gap-2",
                        selected === item.id ? "bg-primary/10 text-primary border-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border-transparent")}>
                      <span className="flex items-center gap-2 truncate"><span className={kindColor(item.kind)}>{kindIcon(item.kind)}</span><span className="truncate">{item.label}</span></span>
                      <span className="text-[10px] font-bold bg-muted/60 px-1.5 py-0.5 rounded-full shrink-0">{showEmailHistory ? getEmailsForItem(item).length : item.docs.length}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Shipments */}
              {shipItems.length > 0 && (
                <div>
                  <div className="px-4 pt-3 pb-1"><p className="text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground/50">Shipments</p></div>
                  {shipItems.map(item => (
                    <button key={item.id} onClick={() => { setSelected(item.id); setPreviewFile(null); }}
                      className={cn("w-full text-left px-4 py-2.5 text-xs font-medium transition-all border-l-2 flex items-center justify-between gap-2",
                        selected === item.id ? "bg-primary/10 text-primary border-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border-transparent")}>
                      <span className="flex items-center gap-2 truncate"><span className={kindColor(item.kind)}>{kindIcon(item.kind)}</span><span className="truncate">{item.label}</span></span>
                      <span className="text-[10px] font-bold bg-muted/60 px-1.5 py-0.5 rounded-full shrink-0">{showEmailHistory ? getEmailsForItem(item).length : item.docs.length}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* Selected header */}
              {selectedItem && (
                <div className="px-4 py-2.5 border-b border-border/30 bg-muted/20 shrink-0 flex items-center gap-2">
                  <span className={cn("h-6 w-6 rounded-lg flex items-center justify-center", kindColor(selectedItem.kind), "bg-current/10")}>
                    {kindIcon(selectedItem.kind)}
                  </span>
                  <span className="text-sm font-bold">{selectedItem.label}</span>
                  <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-semibold">{selectedItem.docs.length} files</span>
                </div>
              )}

              {/* All / Internal / External tabs */}
              {!showEmailHistory && (
                <div className="px-4 py-2 border-b border-border/30 bg-muted/10 shrink-0 flex items-center gap-1.5">
                  {([
                    { key: "all" as const, label: "All", count: visibleDocs.length },
                    { key: "Internal" as const, label: "Internal", count: visibleDocs.filter(v => v.doc.documentType === "Internal").length },
                    { key: "External" as const, label: "External", count: visibleDocs.filter(v => v.doc.documentType === "External").length },
                  ]).map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setDocTypeFilter(tab.key)}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all",
                        docTypeFilter === tab.key
                          ? tab.key === "External"
                            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 shadow-sm"
                            : "bg-primary/10 text-primary shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      {tab.label}
                      <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full",
                        docTypeFilter === tab.key
                          ? tab.key === "External" ? "bg-amber-500/10 text-amber-600" : "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      )}>{tab.count}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Email History */}
              {showEmailHistory ? (
                <div className="flex-1 overflow-y-auto min-h-0">
                  {loadingEmails ? (
                    <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary/30" /></div>
                  ) : filteredEmails.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                      <div className="h-16 w-16 rounded-2xl bg-blue-500/5 border border-blue-500/10 flex items-center justify-center">
                        <Mail className="h-7 w-7 text-blue-500/40" />
                      </div>
                      <p className="text-sm font-semibold text-muted-foreground">
                        {selectedItem ? `No emails for ${selectedItem.label}` : "No emails sent yet"}
                      </p>
                      <p className="text-xs text-muted-foreground/60">Select files and click Email to send</p>
                    </div>
                  ) : (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border/40 bg-muted/20 sticky top-0 z-10">
                          <th className="px-3 py-2.5 text-left font-black uppercase tracking-widest text-[9px] text-muted-foreground/60 w-[40px]"></th>
                          <th className="px-3 py-2.5 text-left font-black uppercase tracking-widest text-[9px] text-muted-foreground/60">To</th>
                          <th className="px-3 py-2.5 text-left font-black uppercase tracking-widest text-[9px] text-muted-foreground/60">Subject</th>
                          <th className="px-3 py-2.5 text-center font-black uppercase tracking-widest text-[9px] text-muted-foreground/60 w-[40px]"><Paperclip className="h-3 w-3 mx-auto" /></th>
                          <th className="px-3 py-2.5 text-left font-black uppercase tracking-widest text-[9px] text-muted-foreground/60 w-[120px]">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredEmails
                          .filter(e => !searchQuery.trim() || 
                            (e.subject || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (e.to || []).join(", ").toLowerCase().includes(searchQuery.toLowerCase()))
                          .map((email: any, idx: number) => (
                          <tr key={email._id || idx}
                            onClick={() => {
                              setEmailComposeMode("view");
                              setEmailInitialData({
                                id: email._id,
                                type: email.type || "Invoice",
                                reference: email.reference || "",
                                to: (email.to || []).join(", "),
                                cc: (email.cc || []).join(", "),
                                subject: email.subject || "",
                                body: email.body || "",
                                from: email.from || "info@app.vidabuddies.com",
                                sentAt: email.sentAt,
                                attachments: (email.attachments || []).map((a: any) => ({
                                  id: a.fileId || a.id || "",
                                  name: a.name || "",
                                  mimeType: a.mimeType || "",
                                  size: String(a.size || "0"),
                                })),
                              });
                              setEmailComposeOpen(true);
                            }}
                            className="border-b border-border/20 hover:bg-muted/30 cursor-pointer transition-colors">
                            <td className="px-3 py-2.5">
                              <div className={cn("h-6 w-6 rounded-lg flex items-center justify-center",
                                email.status === "sent" ? "bg-emerald-500/10" : "bg-destructive/10")}>
                                <Send className={cn("h-3 w-3", email.status === "sent" ? "text-emerald-600" : "text-destructive")} />
                              </div>
                            </td>
                            <td className="px-3 py-2.5 truncate max-w-[150px]"><span className="font-medium">{(email.to || []).join(", ")}</span></td>
                            <td className="px-3 py-2.5 font-semibold truncate max-w-[200px]">{email.subject || "(No subject)"}</td>
                            <td className="px-3 py-2.5 text-center">
                              {email.attachments?.length > 0 ? (
                                <span className="bg-muted/60 text-foreground/70 px-1.5 py-0.5 rounded font-bold text-[10px]">{email.attachments.length}</span>
                              ) : <span className="text-muted-foreground/30">—</span>}
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground/60 whitespace-nowrap">
                              {email.sentAt ? new Date(email.sentAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ) : (

              /* Grid */
              <div className="flex-1 overflow-y-auto min-h-0 p-3">
                {loading ? (
                  <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary/30" /></div>
                ) : visibleDocs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-5">
                    <div className="relative">
                      <div className="h-24 w-24 rounded-2xl border-2 border-dashed border-primary/25 bg-gradient-to-br from-primary/10 to-primary/[0.03] flex items-center justify-center transition-all">
                        <CloudUpload className="h-10 w-10 text-primary/40" />
                      </div>
                      <div className="absolute -bottom-1.5 -right-1.5 h-7 w-7 rounded-full bg-primary/15 border-2 border-background flex items-center justify-center shadow-sm">
                        <Upload className="h-3.5 w-3.5 text-primary" />
                      </div>
                    </div>
                    <div className="text-center space-y-1.5">
                      <p className="text-sm font-semibold">
                        {selectedItem ? `No documents in ${selectedItem.label}` : "No documents found"}
                      </p>
                      <p className="text-xs text-muted-foreground max-w-[300px]">
                        {selectedItem
                          ? "Drag & drop files here, or click below to browse."
                          : "Select a record from the sidebar, then drag & drop files to upload."}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedItem && (
                        <Button size="sm" className="gap-1.5" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                          <Upload className="h-3.5 w-3.5" /> Upload Files
                        </Button>
                      )}
                      {selectedItem && (
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => {
                          toast.info("Please allow the browser prompt to upload folder structure");
                          folderInputRef.current?.click();
                        }} disabled={uploading}>
                          <FolderOpen className="h-3.5 w-3.5" /> Browse Folder
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                    {filteredDocs.map((item, idx) => {
                      const d = item.doc;
                      const cardId = `${d.driveFileId}-${idx}`;
                      const isPreviewing = previewFile?.driveFileId === d.driveFileId;
                      const selIndex = selectedIds.indexOf(cardId);
                      const isSelected = selIndex >= 0;
                      return (
                        <div key={cardId}
                          className={cn(
                            "group relative rounded-xl border overflow-hidden transition-all duration-200 cursor-pointer",
                            isSelected ? "border-primary ring-2 ring-primary/20 shadow-lg" :
                            isPreviewing ? "border-primary/60 ring-1 ring-primary/10 shadow-md" : "border-border/40 hover:border-border/80 hover:shadow-md"
                          )}
                          onClick={() => setPreviewFile(d)}>
                          {/* Name header - dark bg on top */}
                          <div className="bg-zinc-900 dark:bg-zinc-800 px-3 py-2 flex items-center gap-2">
                            <button
                              onClick={(e) => toggleSelect(cardId, e)}
                              className={cn("h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 text-[10px] font-black",
                                isSelected ? "bg-primary border-primary text-primary-foreground" : "border-white/40 text-transparent hover:border-white hover:text-white/60")}
                            >
                              {isSelected ? selIndex + 1 : ""}                            
                            </button>
                            <p className="text-xs font-semibold text-white truncate flex-1" title={d.documentName}>{d.documentName}</p>
                          </div>
                          {/* Thumbnail */}
                          <div className="relative h-[120px] bg-muted/30 overflow-hidden">
                            <img src={thumbUrl(d.driveFileId)} alt={d.documentName}
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; const fb = (e.target as HTMLImageElement).parentElement?.querySelector('.thumb-fb') as HTMLElement; if (fb) fb.style.display = 'flex'; }} />
                            <div className="thumb-fb absolute inset-0 items-center justify-center bg-gradient-to-br from-muted/40 to-muted/20" style={{ display: 'none' }}>
                              <div className="flex flex-col items-center gap-2">
                                <div className="h-14 w-14 rounded-2xl bg-background/80 border border-border/40 flex items-center justify-center shadow-sm">{getIcon(d.mimeType)}</div>
                                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">{d.documentName?.split('.').pop()?.toUpperCase() || 'FILE'}</span>
                              </div>
                            </div>
                          </div>
                          {/* Footer */}
                          <div className="px-3 py-2 flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              {!selectedItem && (
                                <span className={cn("inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-muted/60 shrink-0", kindColor(item.kind))}>
                                  {item.source}
                                </span>
                              )}
                              <span className="text-[9px] font-semibold text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-full shrink-0">{fmtSize(d.size)}</span>
                              <span className="text-[9px] font-semibold text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-full shrink-0">{fmtDate(d.createdAt)}</span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const newType = d.documentType === 'Internal' ? 'External' : 'Internal';
                                // Find the source item for this doc
                                const srcItem = selectedItem || items.find(it => it.docs.includes(d));
                                if (!srcItem) { toast.error("Cannot find source"); return; }
                                // Optimistic update
                                d.documentType = newType;
                                setItems([...items]);
                                // API call
                                fetch("/api/admin/drive-documents", {
                                  method: "PUT",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ collection: srcItem.collection, recordId: srcItem.id, driveFileId: d.driveFileId, updates: { documentType: newType } }),
                                }).then(res => {
                                  if (res.ok) toast.success(`Set to ${newType}`);
                                  else toast.error("Failed to update");
                                }).catch(() => toast.error("Failed to update"));
                              }}
                              className={cn(
                                "inline-flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-full transition-all shrink-0 relative",
                                d.documentType === "Internal"
                                  ? "bg-primary/10 text-primary hover:bg-amber-500/15 hover:text-amber-600"
                                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-primary/15 hover:text-primary"
                              )}
                              title={`Click to switch to ${d.documentType === 'Internal' ? 'External' : 'Internal'}`}
                            >
                              {d.documentType === "Internal" ? <Eye className="h-2.5 w-2.5" /> : <EyeOff className="h-2.5 w-2.5" />}
                              {d.documentType}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              )}

              {/* Footer */}
              <div className="px-4 py-2 border-t border-border/30 bg-muted/20 shrink-0 flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {filteredDocs.length} file{filteredDocs.length !== 1 ? "s" : ""}
                  {selectedItem && ` in ${selectedItem.label}`}
                  {selCount > 0 && ` · ${selCount} selected`}
                </p>
                <div className="flex items-center gap-1.5">
                  {selCount > 0 && (
                    <>
                      {(() => {
                        const extCount = getSelectedDocs().filter(d => d.doc.documentType === "External").length;
                        return (
                          <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 px-2.5" onClick={handleEmail}
                            disabled={extCount === 0}
                            title={extCount === 0 ? "Select External documents to email" : `Email ${extCount} external file(s)`}>
                            <Mail className="h-3 w-3" /> Email ({extCount})
                          </Button>
                        );
                      })()}
                      {selCount > 1 && (
                        <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 px-2.5" onClick={handleMergeClick} disabled={merging}>
                          {merging ? <Loader2 className="h-3 w-3 animate-spin" /> : <Combine className="h-3 w-3" />} Merge ({selCount})
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 px-2.5" onClick={() => setMoveDialogOpen(true)} disabled={moving}>
                        {moving ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowRightLeft className="h-3 w-3" />} Move ({selCount})
                      </Button>
                      <Button size="sm" variant="destructive" className="h-7 text-[10px] gap-1 px-2.5" onClick={() => setDeleteConfirmOpen(true)} disabled={deleting}>
                        {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />} Delete ({selCount})
                      </Button>
                      <button onClick={() => setSelectedIds([])} className="text-[10px] font-bold text-muted-foreground hover:text-foreground ml-1">Clear</button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* ═══ Upload Progress Floating Popup ═══ */}
            {uploadFiles.length > 0 && (
              <div className="absolute bottom-4 right-4 z-40 w-[320px] rounded-xl border border-border/60 bg-background/95 backdrop-blur-xl shadow-2xl animate-in slide-in-from-bottom-5 duration-300">
                {/* Header */}
                <div className="flex items-center justify-between px-4 pt-3 pb-2">
                  <div className="flex items-center gap-2.5">
                    {uploading ? (
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <CloudUpload className="h-4 w-4 text-primary animate-pulse" />
                      </div>
                    ) : uploadFiles.some(f => f.status === "error") ? (
                      <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                        <AlertCircle className="h-4 w-4 text-amber-500" />
                      </div>
                    ) : (
                      <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-bold leading-none">
                        {uploading ? "Uploading..." : uploadFiles.some(f => f.status === "error") ? "Completed with errors" : "Upload Complete!"}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">
                        {uploadCompleted}/{uploadTotal} files
                        {uploadStartTime > 0 && ` • ${Math.round((Date.now() - uploadStartTime) / 1000)}s`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-primary tabular-nums">
                      {uploadTotal > 0 ? Math.round((uploadCompleted / uploadTotal) * 100) : 0}%
                    </span>
                    {!uploading && (
                      <button
                        onClick={() => { setUploadFiles([]); setUploadCompleted(0); setUploadTotal(0); }}
                        className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                {/* Progress bar */}
                <div className="px-4 pb-2">
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-700 ease-out",
                        uploading ? "bg-gradient-to-r from-primary to-primary/60" :
                        uploadFiles.some(f => f.status === "error") ? "bg-gradient-to-r from-amber-500 to-amber-400" :
                        "bg-gradient-to-r from-emerald-500 to-emerald-400"
                      )}
                      style={{ width: `${uploadTotal > 0 ? (uploadCompleted / uploadTotal) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                {/* File list */}
                <div className="max-h-[140px] overflow-y-auto px-4 pb-3 space-y-0.5">
                  {uploadFiles.map((f, i) => (
                    <div key={i} className={cn(
                      "flex items-center gap-2 text-[11px] py-0.5 px-1.5 rounded",
                      f.status === "uploading" && "bg-primary/5"
                    )}>
                      {f.status === "done" ? <CheckCircle className="h-3 w-3 text-emerald-500 shrink-0" /> :
                       f.status === "uploading" ? <Loader2 className="h-3 w-3 text-primary animate-spin shrink-0" /> :
                       f.status === "error" ? <XCircle className="h-3 w-3 text-destructive shrink-0" /> :
                       <div className="h-3 w-3 rounded-full border-[1.5px] border-muted-foreground/25 shrink-0" />}
                      <span className={cn(
                        "truncate flex-1 font-medium",
                        f.status === "done" && "text-muted-foreground/60",
                        f.status === "error" && "text-destructive",
                        f.status === "pending" && "text-muted-foreground/40"
                      )}>{f.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ═══ Drag & Drop Overlay ═══ */}
            {dragOver && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm border-2 border-dashed border-primary/60 rounded-xl pointer-events-none">
                <div className="flex flex-col items-center gap-4 animate-in zoom-in-95 duration-200">
                  <div className="relative">
                    <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center shadow-lg">
                      <CloudUpload className="h-10 w-10 text-primary animate-bounce" />
                    </div>
                    <div className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-primary/20 border-2 border-background flex items-center justify-center shadow-md">
                      <Upload className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-base font-bold text-primary">Drop files to upload</p>
                    <p className="text-xs text-muted-foreground font-medium">
                      {selectedItem ? `Uploading to ${selectedItem.label}` : `Uploading to ${items.find(i => i.kind === "VBNumber")?.label || poNumber}`}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

        </DialogContent>
      </Dialog>

      {/* Merge Filename Dialog */}
      <Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Combine className="h-5 w-5 text-indigo-500" /> Merge Documents
            </DialogTitle>
            <DialogDescription>Enter a filename for the merged PDF</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              value={mergeFileName}
              onChange={(e) => setMergeFileName(e.target.value)}
              placeholder="Merged_Documents"
              className="h-10"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setMergeDialogOpen(false)}>Cancel</Button>
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5" onClick={handleMerge} disabled={merging || !mergeFileName.trim()}>
                {merging ? <Loader2 className="h-4 w-4 animate-spin" /> : <Combine className="h-4 w-4" />}
                Merge {selCount} Files
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete{" "}
              <span className="font-semibold text-foreground">{selCount} file{selCount !== 1 ? "s" : ""}</span>{" "}
              from Google Drive and remove them from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Delete {selCount} File{selCount !== 1 ? "s" : ""}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* New Folder Dialog */}
      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderPlus className="h-5 w-5 text-amber-500" /> Create New Folder
            </DialogTitle>
            <DialogDescription>
              Create a folder inside {selectedItem?.label || "the selected item"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              className="h-10"
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateFolder(); }}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setNewFolderOpen(false)}>Cancel</Button>
              <Button className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5" onClick={handleCreateFolder} disabled={creatingFolder || !newFolderName.trim()}>
                {creatingFolder ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Move Files Dialog */}
      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-blue-500" /> Move {selCount} File{selCount !== 1 ? "s" : ""}
            </DialogTitle>
            <DialogDescription>Select the target folder to move the selected files to</DialogDescription>
          </DialogHeader>
          <div className="space-y-1 pt-2 max-h-[320px] overflow-y-auto">
            {items.map(item => (
              <button
                key={item.id}
                onClick={() => handleMoveFiles(item)}
                disabled={moving}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-lg text-xs font-medium transition-all flex items-center justify-between gap-2",
                  "hover:bg-muted/60 border border-transparent hover:border-border/40",
                  selectedItem?.id === item.id && "opacity-40 cursor-not-allowed"
                )}
              >
                <span className="flex items-center gap-2 truncate">
                  <span className={kindColor(item.kind)}>{kindIcon(item.kind)}</span>
                  <span className="truncate">{item.label}</span>
                </span>
                <span className="text-[10px] font-bold bg-muted/60 px-1.5 py-0.5 rounded-full shrink-0">{item.docs.length}</span>
              </button>
            ))}
          </div>
          {moving && (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Moving files...
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Email Compose Dialog */}
      <EmailComposeDialog
        open={emailComposeOpen}
        onClose={() => {
          setEmailComposeOpen(false);
          setEmailComposeMode("compose");
          setEmailInitialData(undefined);
          setSelectedIds([]);
          setEmailAttachments([]);
        }}
        attachments={emailComposeMode === "compose" && !emailInitialData ? emailAttachments : []}
        vbpoNo={poNumber}
        onSent={() => {
          fetchEmailRecords();
          setEmailComposeMode("compose");
          setEmailInitialData(undefined);
          setEmailAttachments([]);
        }}
        mode={emailComposeMode}
        initialData={emailInitialData}
        onForward={(data) => {
          setEmailComposeOpen(false);
          setTimeout(() => {
            setEmailComposeMode("compose");
            setEmailInitialData(data);
            setEmailComposeOpen(true);
          }, 200);
        }}
      />

      {/* RIGHT-SIDE PREVIEW PANEL — rendered via portal to escape Dialog event capture */}
      {previewFile && mounted && createPortal(
        <PreviewPanel previewFile={previewFile} onClose={() => setPreviewFile(null)} />,
        document.body
      )}
    </>
  );
}
