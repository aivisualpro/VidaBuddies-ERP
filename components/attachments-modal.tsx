"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Upload,
  Trash2,
  FileText,
  Image,
  FileSpreadsheet,
  FileArchive,
  File,
  ExternalLink,
  FolderOpen,
  Loader2,
  CloudUpload,
  FileVideo,
  FileAudio,
  Paperclip,
  Folder,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronRight,
  FileCode,
  FileType,
  Lock,
} from "lucide-react";

/* ─── Types ──────────────────────────────────────────── */

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  createdTime: string;
  webViewLink: string;
  iconLink: string;
  thumbnailLink: string;
}

interface AttachmentsModalProps {
  open: boolean;
  onClose: () => void;
  poNumber: string;
  spoNumber?: string;
  shipNumber?: string;
  childFolders?: string[];
}

interface UploadFileStatus {
  name: string;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

/** A breadcrumb segment in the navigation stack */
interface NavSegment {
  label: string;
  folderId: string;
}

/* ─── Helpers ────────────────────────────────────────── */

function getFileIcon(mimeType: string, size?: "sm" | "md") {
  const cls = size === "sm" ? "h-4 w-4" : "h-[18px] w-[18px]";
  if (mimeType === "application/vnd.google-apps.folder")
    return <Folder className={cn(cls, "text-yellow-600 fill-yellow-600/20")} />;
  if (mimeType.startsWith("image/")) return <Image className={cn(cls, "text-emerald-500")} />;
  if (mimeType.startsWith("video/")) return <FileVideo className={cn(cls, "text-purple-500")} />;
  if (mimeType.startsWith("audio/")) return <FileAudio className={cn(cls, "text-orange-500")} />;
  if (mimeType.includes("pdf")) return <FileText className={cn(cls, "text-red-500")} />;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType.includes("csv"))
    return <FileSpreadsheet className={cn(cls, "text-green-600")} />;
  if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("archive") || mimeType.includes("compressed"))
    return <FileArchive className={cn(cls, "text-amber-600")} />;
  if (mimeType.includes("word") || mimeType.includes("document"))
    return <FileText className={cn(cls, "text-blue-600")} />;
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint"))
    return <FileType className={cn(cls, "text-orange-600")} />;
  if (mimeType.includes("json") || mimeType.includes("xml") || mimeType.includes("html") || mimeType.includes("javascript") || mimeType.includes("css"))
    return <FileCode className={cn(cls, "text-sky-500")} />;
  return <File className={cn(cls, "text-muted-foreground")} />;
}

function getFileExtension(name: string): string {
  const parts = name.split(".");
  return parts.length > 1 ? parts.pop()!.toUpperCase() : "FILE";
}

function formatFileSize(bytes: string | number): string {
  const size = typeof bytes === "string" ? parseInt(bytes, 10) : bytes;
  if (!size || size === 0) return "—";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(seconds: number): string {
  if (seconds < 1) return "0s";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

/**
 * Extract the subfolder path from a file's webkitRelativePath.
 * e.g. "myFolder/sub/file.txt" → "myFolder/sub"
 * Returns empty string if the file is at root level.
 */
function getSubFolderPath(file: File): string {
  const rp = (file as any).webkitRelativePath as string;
  if (!rp) return "";
  const parts = rp.split("/");
  if (parts.length <= 1) return "";
  // Remove the last part (filename) to get folder path
  return parts.slice(0, -1).join("/");
}

function isSystemFolder(name: string, poNumber: string): boolean {
  // System folders follow the auto-created naming pattern:
  // Level 1: VB412        (PO)
  // Level 2: VB412-1      (Customer PO)
  // Level 3: VB412-1-2    (Shipping)
  // Pattern: poNumber followed by zero or more -digit suffixes
  if (name === poNumber) return true;
  const escaped = poNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`^${escaped}(-\\d+)+$`);
  return regex.test(name);
}

/* ─── Component ──────────────────────────────────────── */

export function AttachmentsModal({
  open,
  onClose,
  poNumber,
  spoNumber,
  shipNumber,
  childFolders,
}: AttachmentsModalProps) {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Navigation stack for deep folder browsing
  // When empty, we're at the "home" level (determined by poNumber + spoNumber)
  // Each entry represents a folder we've navigated into
  const [navStack, setNavStack] = useState<NavSegment[]>([]);

  // The root folder ID (resolved from PO/SPO path)
  const [rootFolderId, setRootFolderId] = useState<string | null>(null);

  // Upload progress
  const [uploadFiles, setUploadFiles] = useState<UploadFileStatus[]>([]);
  const [uploadCompleted, setUploadCompleted] = useState(0);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [uploadElapsed, setUploadElapsed] = useState(0);
  const [uploadEstimated, setUploadEstimated] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ─── Navigation State ─── */
  // Determines which "level" we're showing when navStack is empty:
  // viewSPO=false, viewShip=false → PO root (CPO folders + uploads)
  // viewSPO=true, viewShip=false → CPO level (Ship folders + uploads)
  // viewSPO=true, viewShip=true → Ship level (uploads only)
  const [viewSPO, setViewSPO] = useState(!!spoNumber);
  const [viewShip, setViewShip] = useState(!!shipNumber);

  useEffect(() => {
    if (open) {
      setNavStack([]);
      setRootFolderId(null);
      setViewSPO(!!spoNumber || !!shipNumber);
      setViewShip(!!shipNumber);
    }
  }, [open, spoNumber, shipNumber]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  /* ─── Current folder ID to list ─── */
  const currentFolderId = navStack.length > 0
    ? navStack[navStack.length - 1].folderId
    : rootFolderId;

  // Abort controller to cancel previous fetch when a new one starts (prevents duplicate folder creation)
  const abortRef = useRef<AbortController | null>(null);

  /* ─── Fetch files ─── */
  const fetchFiles = useCallback(async () => {
    if (!poNumber) return;

    // Cancel any in-flight request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setFiles([]);
    try {
      let url: string;

      if (navStack.length > 0) {
        // Deep navigation — use folder ID directly
        url = `/api/admin/drive?folderId=${encodeURIComponent(navStack[navStack.length - 1].folderId)}`;
      } else if (viewShip && spoNumber && shipNumber) {
        // Ship View — inside shipping folder
        url = `/api/admin/drive?poNumber=${encodeURIComponent(poNumber)}&spoNumber=${encodeURIComponent(spoNumber)}&shipNumber=${encodeURIComponent(shipNumber)}`;
      } else if (viewSPO && spoNumber) {
        // SPO/CPO View — inside CPO folder, ensure child (shipping) folders exist
        url = `/api/admin/drive?poNumber=${encodeURIComponent(poNumber)}&spoNumber=${encodeURIComponent(spoNumber)}`;
        if (childFolders && childFolders.length > 0) {
          url += `&ensureChildren=${encodeURIComponent(childFolders.join(','))}`;
        }
      } else {
        // Root PO View
        url = `/api/admin/drive?poNumber=${encodeURIComponent(poNumber)}`;
      }

      const res = await fetch(url, { signal: controller.signal });
      const data = await res.json();
      if (res.ok) {
        setFiles(data.files || []);
        if (navStack.length === 0 && data.folderId) {
          setRootFolderId(data.folderId);
        }
      } else {
        toast.error("Failed to load files", { description: data.error });
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        toast.error("Failed to connect to server");
      }
    } finally {
      setLoading(false);
    }
  }, [poNumber, spoNumber, shipNumber, childFolders, navStack, viewSPO, viewShip]);

  useEffect(() => {
    if (open) {
      fetchFiles();
      setSelectedIds(new Set());
      setUploadFiles([]);
    }
  }, [open, fetchFiles]);

  /* ─── Navigation ─── */
  const navigateIntoFolder = (folderName: string, folderId: string) => {
    setNavStack((prev) => [...prev, { label: folderName, folderId }]);
    setSelectedIds(new Set());
  };

  const navigateToIndex = (index: number) => {
    // -1 = root, 0 = first nav, etc.
    if (index < 0) {
      setNavStack([]);
    } else {
      setNavStack((prev) => prev.slice(0, index + 1));
    }
    setSelectedIds(new Set());
  };

  /* ─── Upload ─── */
  const handleUpload = async (fileList: FileList | File[]) => {
    const filesToUpload = Array.from(fileList);
    if (!filesToUpload.length) return;

    setUploading(true);
    const total = filesToUpload.length;
    let completed = 0;
    let baseFolderId: string | null = currentFolderId;
    const startTime = Date.now();

    // Cache for subfolder IDs to avoid repeated creation
    const subFolderCache: Record<string, string> = {};

    setUploadTotal(total);
    setUploadCompleted(0);
    setUploadElapsed(0);
    setUploadEstimated(0);
    setUploadFiles(filesToUpload.map((f) => {
      const sub = getSubFolderPath(f);
      return { name: sub ? `${sub}/${f.name}` : f.name, status: "pending" as const };
    }));

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setUploadElapsed((Date.now() - startTime) / 1000), 500);

    let failedCount = 0;

    for (let i = 0; i < filesToUpload.length; i++) {
      const file = filesToUpload[i];
      const subFolder = getSubFolderPath(file);

      setUploadFiles((prev) => prev.map((f, idx) => (idx === i ? { ...f, status: "uploading" } : f)));

      try {
        const formData = new FormData();
        formData.append("poNumber", poNumber);
        if (spoNumber) formData.append("spoNumber", spoNumber);
        if (shipNumber) formData.append("shipNumber", shipNumber);
        formData.append("file", file);
        if (baseFolderId) formData.append("folderId", baseFolderId);
        if (subFolder) formData.append("subFolder", subFolder);

        const res = await fetch("/api/admin/drive", { method: "POST", body: formData });
        const data = await res.json();

        if (res.ok) {
          if (!baseFolderId && data.folderId) baseFolderId = data.folderId;
          completed++;
          setUploadCompleted(completed);
          setUploadFiles((prev) => prev.map((f, idx) => (idx === i ? { ...f, status: "done" } : f)));
          const elapsed = (Date.now() - startTime) / 1000;
          setUploadEstimated(((total - completed) * elapsed) / completed);
        } else {
          failedCount++;
          setUploadFiles((prev) => prev.map((f, idx) => (idx === i ? { ...f, status: "error", error: data.error } : f)));
          if (i === 0) {
            if (timerRef.current) clearInterval(timerRef.current);
            toast.error("Upload failed", { description: data.error });
            setUploading(false);
            return;
          }
        }
      } catch {
        failedCount++;
        setUploadFiles((prev) => prev.map((f, idx) => (idx === i ? { ...f, status: "error", error: "Network error" } : f)));
      }
    }

    if (timerRef.current) clearInterval(timerRef.current);
    const totalElapsed = (Date.now() - startTime) / 1000;
    setUploadElapsed(totalElapsed);
    setUploadEstimated(0);

    if (failedCount === 0) toast.success(`${completed} file(s) uploaded`, { description: `Completed in ${formatTime(totalElapsed)}` });
    else if (completed > 0) toast.warning(`${completed} uploaded, ${failedCount} failed`);
    else toast.error("All uploads failed");

    setUploading(false);
    fetchFiles();
    setTimeout(() => { setUploadFiles([]); setUploadCompleted(0); setUploadTotal(0); }, 3000);
  };

  /* ─── Delete ─── */
  const handleDelete = async () => {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/admin/drive", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileIds: Array.from(selectedIds) }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`${data.deleted} file(s) deleted`);
        setSelectedIds(new Set());
        fetchFiles();
      } else {
        toast.error("Delete failed", { description: data.error });
      }
    } catch {
      toast.error("Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Determine if a file/folder is a protected system item
  const isItemProtected = (file: DriveFile) => {
    const isFolder = file.mimeType === "application/vnd.google-apps.folder";
    if (!isFolder) return false; // Files are never protected
    // At any level: folders matching the system naming pattern are protected
    return isSystemFolder(file.name, poNumber);
  };

  const selectableFiles = files.filter(f => !isItemProtected(f));
  const allSelected = selectableFiles.length > 0 && selectableFiles.every(f => selectedIds.has(f.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableFiles.map(f => f.id)));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragOver(false);
    if (e.dataTransfer.files.length) handleUpload(e.dataTransfer.files);
  };

  const uploadPercentage = uploadTotal > 0 ? (uploadCompleted / uploadTotal) * 100 : 0;
  const isShowingUpload = uploadFiles.length > 0;

  /* ─── Breadcrumbs ─── */
  type BreadcrumbItem = { label: string; clickable: boolean; onClick?: () => void };
  const breadcrumbs: BreadcrumbItem[] = [];

  // 1. PO Number (always shown, top-level)
  const isAtPORoot = navStack.length === 0 && !viewSPO;
  breadcrumbs.push({
    label: poNumber,
    clickable: !isAtPORoot,
    onClick: () => {
      setNavStack([]);
      setViewSPO(false);
      setViewShip(false);
    },
  });

  // 2. SPO Number (Customer PO level) — show if spoNumber is known
  if (spoNumber && (viewSPO || viewShip || navStack.length > 0)) {
    const isAtSPORoot = navStack.length === 0 && viewSPO && !viewShip;
    breadcrumbs.push({
      label: spoNumber,
      clickable: !isAtSPORoot,
      onClick: () => {
        setNavStack([]);
        setViewSPO(true);
        setViewShip(false);
      }
    });
  }

  // 3. Ship Number (Shipping level) — show if shipNumber is known
  if (shipNumber && (viewShip || navStack.length > 0)) {
    const isAtShipRoot = navStack.length === 0 && viewShip;
    breadcrumbs.push({
      label: shipNumber,
      clickable: !isAtShipRoot,
      onClick: () => {
        setNavStack([]);
        setViewSPO(true);
        setViewShip(true);
      }
    });
  }

  // Deep navigation segments (user-browsed folders)
  navStack.forEach((seg, idx) => {
    breadcrumbs.push({
      label: seg.label,
      clickable: idx < navStack.length - 1,
      onClick: () => navigateToIndex(idx),
    });
  });

  // Sort: folders first, then files by name
  const sortedFiles = [...files].sort((a, b) => {
    const aIsFolder = a.mimeType === "application/vnd.google-apps.folder" ? 0 : 1;
    const bIsFolder = b.mimeType === "application/vnd.google-apps.folder" ? 0 : 1;
    if (aIsFolder !== bIsFolder) return aIsFolder - bIsFolder;
    return a.name.localeCompare(b.name);
  });

  const folderCount = sortedFiles.filter((f) => f.mimeType === "application/vnd.google-apps.folder").length;
  const fileCount = sortedFiles.length - folderCount;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !uploading) onClose(); }}>
      <DialogContent className="max-w-5xl max-h-[88vh] flex flex-col p-0 gap-0 overflow-hidden">

        {/* ═══════ HEADER ═══════ */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/40 bg-gradient-to-r from-background to-muted/20 shrink-0">
          <DialogHeader className="p-0 space-y-1.5">
            <DialogTitle className="text-lg font-bold flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10 flex items-center justify-center shadow-sm">
                <Paperclip className="h-4.5 w-4.5 text-primary" />
              </div>
              Attachments
            </DialogTitle>

            {/* Breadcrumbs */}
            <nav className="flex items-center gap-0 ml-0.5 flex-wrap">
              {breadcrumbs.map((bc, i) => (
                <div key={i} className="flex items-center">
                  {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 mx-0.5" />}
                  {bc.clickable ? (
                    <button
                      type="button"
                      onClick={bc.onClick}
                      className="text-xs font-semibold text-primary hover:text-primary/80 px-1.5 py-0.5 rounded-md hover:bg-primary/5 transition-all cursor-pointer"
                    >
                      {bc.label}
                    </button>
                  ) : (
                    <span className={cn(
                      "text-xs font-medium px-1.5 py-0.5 rounded-md",
                      i === breadcrumbs.length - 1
                        ? "text-foreground bg-muted/60"
                        : "text-muted-foreground"
                    )}>
                      {bc.label}
                    </span>
                  )}
                </div>
              ))}
            </nav>
          </DialogHeader>

          <div className="flex items-center gap-2 shrink-0">
            {selectedIds.size > 0 && (
              <Button size="sm" variant="destructive" className="h-8 text-xs gap-1.5 shadow-sm" onClick={handleDelete} disabled={deleting || uploading}>
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Delete ({selectedIds.size})
              </Button>
            )}
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => {
              toast.info("Please allow the browser prompt to upload folder structure");
              folderInputRef.current?.click();
            }} disabled={uploading}>
              <FolderOpen className="h-3.5 w-3.5" /> Folder
            </Button>
            <Button size="sm" className="h-8 text-xs gap-1.5 shadow-sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Upload
            </Button>
          </div>
        </div>

        {/* Hidden inputs */}
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => { if (e.target.files) handleUpload(e.target.files); e.target.value = ""; }} />
        <input ref={folderInputRef} type="file" multiple
          // @ts-ignore
          webkitdirectory="" className="hidden" onChange={(e) => { if (e.target.files) handleUpload(e.target.files); e.target.value = ""; }} />

        {/* ═══════ UPLOAD PROGRESS ═══════ */}
        {isShowingUpload && (
          <div className="border-b border-border/40 bg-gradient-to-b from-primary/[0.02] to-transparent shrink-0">
            <div className="px-6 pt-4 pb-2 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {uploading ? (
                    <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
                      <CloudUpload className="h-4 w-4 text-primary animate-pulse" />
                    </div>
                  ) : uploadFiles.some((f) => f.status === "error") ? (
                    <div className="h-8 w-8 rounded-xl bg-amber-500/10 flex items-center justify-center">
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                    </div>
                  ) : (
                    <div className="h-8 w-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-bold leading-none">
                      {uploading ? "Uploading..." : uploadFiles.some((f) => f.status === "error") ? "Completed with errors" : "Upload Complete!"}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">
                      {uploadCompleted}/{uploadTotal} files
                      {uploadElapsed > 0 && ` • ${formatTime(uploadElapsed)}`}
                      {uploading && uploadEstimated > 0 && ` • ~${formatTime(uploadEstimated)} left`}
                    </p>
                  </div>
                </div>
                <span className="text-xl font-black text-primary tabular-nums tracking-tight">{Math.round(uploadPercentage)}%</span>
              </div>

              <div className="h-2 w-full bg-muted/50 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-700 ease-out",
                    uploading ? "bg-gradient-to-r from-primary to-primary/70" : uploadFiles.some((f) => f.status === "error") ? "bg-gradient-to-r from-amber-500 to-amber-400" : "bg-gradient-to-r from-emerald-500 to-emerald-400"
                  )}
                  style={{ width: `${uploadPercentage}%` }}
                />
              </div>
            </div>

            <div className="max-h-[120px] overflow-y-auto px-6 pb-3">
              <div className="space-y-0.5">
                {uploadFiles.map((f, idx) => (
                  <div key={idx} className={cn("flex items-center gap-2 py-0.5 px-2 rounded text-[11px]", f.status === "uploading" && "bg-primary/5", f.status === "error" && "bg-destructive/5")}>
                    {f.status === "pending" && <div className="h-3 w-3 rounded-full border-[1.5px] border-muted-foreground/25 shrink-0" />}
                    {f.status === "uploading" && <Loader2 className="h-3 w-3 text-primary animate-spin shrink-0" />}
                    {f.status === "done" && <CheckCircle className="h-3 w-3 text-emerald-500 shrink-0" />}
                    {f.status === "error" && <XCircle className="h-3 w-3 text-destructive shrink-0" />}
                    <span className={cn("truncate flex-1 font-medium", f.status === "done" && "text-muted-foreground/60", f.status === "error" && "text-destructive", f.status === "pending" && "text-muted-foreground/40")}>
                      {f.name}
                    </span>
                    {f.error && <span className="text-[9px] text-destructive/60 truncate max-w-[100px]">{f.error}</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══════ TABLE CONTENT ═══════ */}
        <div
          className={cn("flex-1 overflow-y-auto min-h-0 transition-colors", dragOver && "bg-primary/5")}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <p className="text-xs text-muted-foreground font-medium">Loading files...</p>
            </div>
          ) : sortedFiles.length === 0 && !isShowingUpload ? (
            <div className="flex flex-col items-center justify-center py-20 px-8 gap-5">
              <div className="relative">
                <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/[0.03] border-2 border-dashed border-primary/25 flex items-center justify-center">
                  <CloudUpload className="h-10 w-10 text-primary/40" />
                </div>
                <div className="absolute -bottom-1.5 -right-1.5 h-7 w-7 rounded-full bg-primary/15 border-2 border-background flex items-center justify-center shadow-sm">
                  <Upload className="h-3.5 w-3.5 text-primary" />
                </div>
              </div>
              <div className="text-center space-y-1.5">
                <p className="text-sm font-semibold">Drop files or folders here</p>
                <p className="text-xs text-muted-foreground max-w-[300px]">
                  Folder uploads preserve their structure. Click "Folder" to upload an entire directory.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  <Upload className="h-3.5 w-3.5" /> Browse Files
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => {
                   toast.info("Please allow the browser prompt to upload folder structure");
                   folderInputRef.current?.click();
                }} disabled={uploading}>
                  <FolderOpen className="h-3.5 w-3.5" /> Browse Folder
                </Button>
              </div>
            </div>
          ) : sortedFiles.length > 0 ? (
            <table className="w-full text-left">
              <thead className="sticky top-0 z-10 bg-muted/50 backdrop-blur-sm border-b border-border/30">
                <tr>
                  <th className="w-10 px-3 py-2.5">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} className="h-3.5 w-3.5" />
                  </th>
                  <th className="px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.08em] text-muted-foreground/70 w-[52px]">Type</th>
                  <th className="px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.08em] text-muted-foreground/70">Name</th>
                  <th className="px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.08em] text-muted-foreground/70 w-[80px] text-right">Size</th>
                  <th className="px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.08em] text-muted-foreground/70 w-[120px]">Date</th>
                  <th className="px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.08em] text-muted-foreground/70 w-[48px] text-center">Link</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border/20">
                {sortedFiles.map((file) => {
                  const isFolder = file.mimeType === "application/vnd.google-apps.folder";
                  const isSelected = selectedIds.has(file.id);
                  const isProtected = isItemProtected(file);

                  return (
                    <tr
                      key={file.id}
                      className={cn(
                        "group transition-colors duration-100",
                        isSelected ? "bg-primary/[0.04] hover:bg-primary/[0.07]" : "hover:bg-muted/30",
                        isFolder ? "cursor-pointer hover:bg-yellow-500/[0.04]" : "cursor-pointer",
                        isProtected && "opacity-80"
                      )}
                      onClick={() => {
                        if (isFolder) {
                           // Standard deep navigation using folder ID
                           navigateIntoFolder(file.name, file.id);
                        }
                        else if (!isProtected) toggleSelect(file.id);
                      }}
                    >
                      {/* Checkbox */}
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(file.id)}
                            className={cn("h-3.5 w-3.5", isProtected && "opacity-50 data-[state=checked]:bg-muted data-[state=checked]:text-muted-foreground cursor-not-allowed")}
                            disabled={isProtected}
                          />
                        </div>
                      </td>

                      {/* Type icon */}
                      <td className="px-3 py-2">
                        <div className={cn(
                          "h-8 w-8 rounded-lg border flex items-center justify-center transition-transform group-hover:scale-105",
                          isFolder ? "bg-yellow-600/10 border-yellow-600/20" : "bg-muted/40 border-border/40"
                        )}>
                          {getFileIcon(file.mimeType, "sm")}
                        </div>
                      </td>

                      {/* Name */}
                      <td className="px-3 py-2">
                        <div className="min-w-0">
                          <p className={cn(
                            "text-[13px] font-semibold truncate leading-tight",
                            isFolder ? "text-yellow-700 dark:text-yellow-500" : "text-foreground"
                          )}>
                            {file.name}
                          </p>
                          {isFolder ? (
                            <span className="text-[9px] font-semibold text-yellow-600/60 mt-0.5 flex items-center gap-1">
                              {isProtected && <Lock className="h-2.5 w-2.5" />}
                              {isProtected ? "System Folder" : "Click to open"}
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/40 mt-0.5 inline-block">
                              {getFileExtension(file.name)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Size */}
                      <td className="px-3 py-2 text-right">
                        <span className="text-xs text-muted-foreground font-medium tabular-nums">
                          {isFolder ? "—" : formatFileSize(file.size)}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="px-3 py-2">
                        <span className="text-xs text-muted-foreground font-medium">
                          {formatDate(file.createdTime)}
                        </span>
                      </td>

                      {/* Open */}
                      <td className="px-3 py-2 text-center">
                        {file.webViewLink ? (
                          <a
                            href={file.webViewLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/40 hover:text-primary hover:bg-primary/10 transition-all opacity-0 group-hover:opacity-100"
                            onClick={(e) => e.stopPropagation()}
                            title="Open in Google Drive"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : null}
        </div>

        {/* ═══════ FOOTER ═══════ */}
        {sortedFiles.length > 0 && (
          <div className="flex items-center justify-between px-6 py-2.5 border-t border-border/30 bg-muted/20 shrink-0">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              {folderCount > 0 && <>{folderCount} folder(s){fileCount > 0 && ", "}</>}
              {fileCount > 0 && <>{fileCount} file(s)</>}
            </span>
            <span className="text-[10px] text-muted-foreground/50 font-medium">
              {breadcrumbs.map((b) => b.label).join(" / ")}
            </span>
          </div>
        )}

        {/* Drag overlay */}
        {dragOver && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm border-2 border-dashed border-primary/60 rounded-xl pointer-events-none">
            <div className="flex flex-col items-center gap-3 animate-in zoom-in-95 duration-200">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <CloudUpload className="h-8 w-8 text-primary" />
              </div>
              <p className="text-sm font-bold text-primary">Drop files or folders to upload</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
