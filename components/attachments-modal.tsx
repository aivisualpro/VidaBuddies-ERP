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
} from "lucide-react";

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
  spoNumber?: string;  // optional — omit for PO-level view
}

interface UploadFileStatus {
  name: string;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

function getFileIcon(mimeType: string) {
  if (mimeType === "application/vnd.google-apps.folder")
    return <Folder className="h-5 w-5 text-yellow-500 fill-yellow-500/20" />;
  if (mimeType.startsWith("image/")) return <Image className="h-5 w-5 text-emerald-500" />;
  if (mimeType.startsWith("video/")) return <FileVideo className="h-5 w-5 text-purple-500" />;
  if (mimeType.startsWith("audio/")) return <FileAudio className="h-5 w-5 text-orange-500" />;
  if (mimeType.includes("pdf")) return <FileText className="h-5 w-5 text-red-500" />;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType.includes("csv"))
    return <FileSpreadsheet className="h-5 w-5 text-green-500" />;
  if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("archive"))
    return <FileArchive className="h-5 w-5 text-amber-500" />;
  if (mimeType.includes("word") || mimeType.includes("document"))
    return <FileText className="h-5 w-5 text-blue-500" />;
  return <File className="h-5 w-5 text-muted-foreground" />;
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
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(seconds: number): string {
  if (seconds < 1) return "0s";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

export function AttachmentsModal({
  open,
  onClose,
  poNumber,
  spoNumber,
}: AttachmentsModalProps) {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Current browsing path — allows navigating up/down
  // null = use the default level from props
  const [currentSpoNumber, setCurrentSpoNumber] = useState<string | undefined>(spoNumber);

  // Upload progress state
  const [uploadFiles, setUploadFiles] = useState<UploadFileStatus[]>([]);
  const [uploadCompleted, setUploadCompleted] = useState(0);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [uploadStartTime, setUploadStartTime] = useState(0);
  const [uploadElapsed, setUploadElapsed] = useState(0);
  const [uploadEstimated, setUploadEstimated] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset browsing level when modal opens or props change
  useEffect(() => {
    if (open) {
      setCurrentSpoNumber(spoNumber);
    }
  }, [open, spoNumber]);

  // Clean up timer
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const fetchFiles = useCallback(async () => {
    if (!poNumber) return;
    setLoading(true);
    try {
      let url = `/api/admin/drive?poNumber=${encodeURIComponent(poNumber)}`;
      if (currentSpoNumber) url += `&spoNumber=${encodeURIComponent(currentSpoNumber)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        setFiles(data.files || []);
      } else {
        toast.error("Failed to load files", { description: data.error });
      }
    } catch {
      toast.error("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  }, [poNumber, currentSpoNumber]);

  useEffect(() => {
    if (open) {
      fetchFiles();
      setSelectedIds(new Set());
      setUploadFiles([]);
    }
  }, [open, fetchFiles]);

  // Navigate into a folder (go one level deeper)
  const navigateIntoFolder = (folderName: string) => {
    if (!currentSpoNumber) {
      // Currently at PO level → navigate into SPO
      setCurrentSpoNumber(folderName);
    }
    // If already at SPO level, folders link to Drive directly
  };

  // Navigate up one level
  const navigateUp = () => {
    if (currentSpoNumber) {
      setCurrentSpoNumber(undefined);
    }
  };

  const handleUpload = async (fileList: FileList | File[]) => {
    const filesToUpload = Array.from(fileList);
    if (!filesToUpload.length) return;

    setUploading(true);
    const total = filesToUpload.length;
    let completed = 0;
    let folderId: string | null = null;
    const startTime = Date.now();

    setUploadTotal(total);
    setUploadCompleted(0);
    setUploadStartTime(startTime);
    setUploadElapsed(0);
    setUploadEstimated(0);
    setUploadFiles(
      filesToUpload.map((f) => ({ name: f.name, status: "pending" as const }))
    );

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      setUploadElapsed(elapsed);
    }, 500);

    let failedCount = 0;

    for (let i = 0; i < filesToUpload.length; i++) {
      const file = filesToUpload[i];

      setUploadFiles((prev) =>
        prev.map((f, idx) => (idx === i ? { ...f, status: "uploading" } : f))
      );

      try {
        const formData = new FormData();
        formData.append("poNumber", poNumber);
        if (currentSpoNumber) formData.append("spoNumber", currentSpoNumber);
        formData.append("file", file);
        if (folderId) formData.append("folderId", folderId);

        const res = await fetch("/api/admin/drive", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (res.ok) {
          if (data.folderId) folderId = data.folderId;
          completed++;
          setUploadCompleted(completed);
          setUploadFiles((prev) =>
            prev.map((f, idx) => (idx === i ? { ...f, status: "done" } : f))
          );

          const elapsed = (Date.now() - startTime) / 1000;
          const avgTime = elapsed / completed;
          setUploadEstimated((total - completed) * avgTime);
        } else {
          failedCount++;
          setUploadFiles((prev) =>
            prev.map((f, idx) =>
              idx === i ? { ...f, status: "error", error: data.error } : f
            )
          );
          if (i === 0) {
            if (timerRef.current) clearInterval(timerRef.current);
            toast.error("Upload failed", { description: data.error });
            setUploading(false);
            return;
          }
        }
      } catch (err: any) {
        failedCount++;
        setUploadFiles((prev) =>
          prev.map((f, idx) =>
            idx === i ? { ...f, status: "error", error: "Network error" } : f
          )
        );
      }
    }

    if (timerRef.current) clearInterval(timerRef.current);
    const totalElapsed = (Date.now() - startTime) / 1000;
    setUploadElapsed(totalElapsed);
    setUploadEstimated(0);

    if (failedCount === 0) {
      toast.success(`${completed} file(s) uploaded successfully`, {
        description: `Completed in ${formatTime(totalElapsed)}`,
      });
    } else if (completed > 0) {
      toast.warning(`${completed} uploaded, ${failedCount} failed`, {
        description: `Completed in ${formatTime(totalElapsed)}`,
      });
    } else {
      toast.error("All uploads failed");
    }

    setUploading(false);
    fetchFiles();

    setTimeout(() => {
      setUploadFiles([]);
      setUploadCompleted(0);
      setUploadTotal(0);
    }, 3000);
  };

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
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === files.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(files.map((f) => f.id)));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (e.dataTransfer.files.length) {
      handleUpload(e.dataTransfer.files);
    }
  };

  const allSelected = files.length > 0 && selectedIds.size === files.length;
  const uploadPercentage = uploadTotal > 0 ? (uploadCompleted / uploadTotal) * 100 : 0;
  const isShowingUpload = uploadFiles.length > 0;

  // Build breadcrumb segments
  const breadcrumbs: { label: string; canClick: boolean; onClick?: () => void }[] = [
    { label: "VBPO", canClick: false },
  ];

  if (currentSpoNumber) {
    // At SPO level — PO name is clickable to go up
    breadcrumbs.push({
      label: poNumber,
      canClick: true,
      onClick: navigateUp,
    });
    breadcrumbs.push({ label: currentSpoNumber, canClick: false });
  } else {
    // At PO level — PO name is not clickable (already here)
    breadcrumbs.push({ label: poNumber, canClick: false });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !uploading) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 shrink-0">
          <DialogHeader className="p-0 space-y-0.5">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Paperclip className="h-4 w-4 text-primary" />
              </div>
              Attachments
            </DialogTitle>
            {/* Clickable Breadcrumb */}
            <div className="flex items-center gap-0.5 mt-0.5">
              {breadcrumbs.map((bc, i) => (
                <div key={i} className="flex items-center gap-0.5">
                  {i > 0 && (
                    <ChevronRight className="h-3 w-3 text-muted-foreground/40 mx-0.5" />
                  )}
                  {bc.canClick ? (
                    <button
                      type="button"
                      onClick={bc.onClick}
                      className="text-xs font-semibold text-primary hover:text-primary/80 hover:underline underline-offset-2 transition-colors cursor-pointer"
                    >
                      {bc.label}
                    </button>
                  ) : (
                    <span className="text-xs font-medium text-muted-foreground">
                      {bc.label}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </DialogHeader>

          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <Button
                size="sm"
                variant="destructive"
                className="h-8 text-xs gap-1.5"
                onClick={handleDelete}
                disabled={deleting || uploading}
              >
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Delete ({selectedIds.size})
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5"
              onClick={() => folderInputRef.current?.click()}
              disabled={uploading}
            >
              <FolderOpen className="h-3.5 w-3.5" />
              Folder
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Upload
            </Button>
          </div>
        </div>

        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleUpload(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={folderInputRef}
          type="file"
          multiple
          // @ts-ignore — webkitdirectory is a non-standard attribute
          webkitdirectory=""
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleUpload(e.target.files);
            e.target.value = "";
          }}
        />

        {/* ═══════ IN-MODAL UPLOAD PROGRESS ═══════ */}
        {isShowingUpload && (
          <div className="border-b border-border/50 bg-gradient-to-b from-primary/[0.03] to-transparent shrink-0">
            <div className="px-6 pt-4 pb-2 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {uploading ? (
                    <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                      <CloudUpload className="h-4 w-4 text-primary animate-pulse" />
                    </div>
                  ) : uploadFiles.some((f) => f.status === "error") ? (
                    <div className="h-7 w-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                    </div>
                  ) : (
                    <div className="h-7 w-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-bold leading-none">
                      {uploading
                        ? "Uploading Files..."
                        : uploadFiles.some((f) => f.status === "error")
                        ? "Upload Complete (with errors)"
                        : "Upload Complete!"}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">
                      {uploadCompleted} / {uploadTotal} files
                      {uploadElapsed > 0 && ` • ${formatTime(uploadElapsed)}`}
                      {uploading && uploadEstimated > 0 && ` • ~${formatTime(uploadEstimated)} remaining`}
                    </p>
                  </div>
                </div>
                <span className="text-lg font-black text-primary tabular-nums">
                  {Math.round(uploadPercentage)}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className="h-2.5 w-full bg-muted/60 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-700 ease-out",
                    uploading
                      ? "bg-gradient-to-r from-primary via-primary/90 to-primary/70"
                      : uploadFiles.some((f) => f.status === "error")
                      ? "bg-gradient-to-r from-amber-500 to-amber-400"
                      : "bg-gradient-to-r from-emerald-500 to-emerald-400"
                  )}
                  style={{ width: `${uploadPercentage}%` }}
                />
              </div>
            </div>

            {/* File upload status list */}
            <div className="max-h-[140px] overflow-y-auto px-6 pb-3">
              <div className="space-y-1">
                {uploadFiles.map((f, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "flex items-center gap-2.5 py-1 px-2 rounded-lg text-xs transition-colors",
                      f.status === "uploading" && "bg-primary/5",
                      f.status === "done" && "opacity-60",
                      f.status === "error" && "bg-destructive/5"
                    )}
                  >
                    {f.status === "pending" && (
                      <div className="h-3.5 w-3.5 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                    )}
                    {f.status === "uploading" && (
                      <Loader2 className="h-3.5 w-3.5 text-primary animate-spin shrink-0" />
                    )}
                    {f.status === "done" && (
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    )}
                    {f.status === "error" && (
                      <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                    )}
                    <span
                      className={cn(
                        "truncate flex-1 font-medium",
                        f.status === "uploading" && "text-foreground",
                        f.status === "done" && "text-muted-foreground",
                        f.status === "error" && "text-destructive",
                        f.status === "pending" && "text-muted-foreground/60"
                      )}
                    >
                      {f.name}
                    </span>
                    {f.error && (
                      <span className="text-[10px] text-destructive/70 truncate max-w-[120px]">
                        {f.error}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══════ MAIN CONTENT ═══════ */}
        <div
          className={cn(
            "flex-1 overflow-y-auto transition-colors duration-200 min-h-0",
            dragOver && "bg-primary/5"
          )}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <p className="text-xs text-muted-foreground font-medium">Loading files...</p>
            </div>
          ) : files.length === 0 && !isShowingUpload ? (
            <div className="flex flex-col items-center justify-center py-16 px-8 gap-4">
              <div className="relative">
                <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-dashed border-primary/30 flex items-center justify-center">
                  <CloudUpload className="h-9 w-9 text-primary/50" />
                </div>
                <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center">
                  <Upload className="h-3 w-3 text-primary" />
                </div>
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  Drop files here or click to upload
                </p>
                <p className="text-xs text-muted-foreground">
                  Supports images, documents, spreadsheets, folders & any file type
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  <Upload className="h-3.5 w-3.5" /> Browse Files
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => folderInputRef.current?.click()} disabled={uploading}>
                  <FolderOpen className="h-3.5 w-3.5" /> Browse Folder
                </Button>
              </div>
            </div>
          ) : files.length > 0 ? (
            <div className="divide-y divide-border/30">
              {/* Select All */}
              <div className="flex items-center gap-3 px-6 py-2.5 bg-muted/30 sticky top-0 z-10 backdrop-blur-sm">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} className="h-4 w-4" />
                <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">
                  {selectedIds.size > 0 ? `${selectedIds.size} of ${files.length} selected` : `${files.length} file(s)`}
                </span>
              </div>

              {files.map((file) => {
                const isFolder = file.mimeType === "application/vnd.google-apps.folder";
                // Folders at PO level can be navigated into (they represent SPOs)
                const canNavigate = isFolder && !currentSpoNumber;

                return (
                  <div
                    key={file.id}
                    className={cn(
                      "flex items-center gap-3 px-6 py-3 transition-colors duration-150 hover:bg-muted/30 group",
                      selectedIds.has(file.id) && "bg-primary/5 hover:bg-primary/10",
                      canNavigate ? "cursor-pointer" : "cursor-pointer"
                    )}
                    onClick={() => {
                      if (canNavigate) {
                        navigateIntoFolder(file.name);
                      } else {
                        toggleSelect(file.id);
                      }
                    }}
                  >
                    {!canNavigate && (
                      <Checkbox
                        checked={selectedIds.has(file.id)}
                        onCheckedChange={() => toggleSelect(file.id)}
                        className="h-4 w-4 shrink-0"
                      />
                    )}
                    {canNavigate && (
                      <div className="h-4 w-4 shrink-0 flex items-center justify-center">
                        <ChevronRight className="h-3.5 w-3.5 text-yellow-500" />
                      </div>
                    )}

                    {/* Icon */}
                    <div className={cn(
                      "h-10 w-10 rounded-xl border border-border/50 flex items-center justify-center shrink-0 overflow-hidden",
                      isFolder ? "bg-yellow-500/10 border-yellow-500/20" : "bg-muted/50"
                    )}>
                      {!isFolder && file.thumbnailLink && file.mimeType.startsWith("image/") ? (
                        <img
                          src={file.thumbnailLink}
                          alt={file.name}
                          className="h-full w-full object-cover rounded-xl"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : (
                        getFileIcon(file.mimeType)
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-sm font-semibold truncate leading-tight",
                        isFolder ? "text-yellow-600 dark:text-yellow-400" : "text-foreground"
                      )}>
                        {file.name}
                        {canNavigate && (
                          <span className="text-[10px] text-muted-foreground ml-1.5 font-normal">→ open</span>
                        )}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground font-medium">
                          {isFolder ? "Folder" : formatFileSize(file.size)}
                        </span>
                        <span className="text-muted-foreground/30">•</span>
                        <span className="text-[10px] text-muted-foreground font-medium">
                          {formatDate(file.createdTime)}
                        </span>
                      </div>
                    </div>

                    {/* Open in Drive */}
                    {file.webViewLink && (
                      <a
                        href={file.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                        onClick={(e) => e.stopPropagation()}
                        title={isFolder ? "Open folder in Drive" : "Open in Drive"}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        {/* Drag overlay */}
        {dragOver && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm border-2 border-dashed border-primary rounded-xl pointer-events-none">
            <div className="flex flex-col items-center gap-3 animate-in zoom-in-95 duration-200">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <CloudUpload className="h-8 w-8 text-primary" />
              </div>
              <p className="text-sm font-bold text-primary">Drop files to upload</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
