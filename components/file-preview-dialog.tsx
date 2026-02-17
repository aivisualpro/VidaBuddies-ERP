"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  X,
  ExternalLink,
  Download,
  ChevronLeft,
  ChevronRight,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  FileVideo,
  FileAudio,
  FileArchive,
  FileCode,
  File,
  FileType,
  Folder,
  Loader2,
  Maximize2,
  Eye,
} from "lucide-react";

/* ─── Types ─── */

interface PreviewFile {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  createdTime: string;
  webViewLink: string;
  thumbnailLink?: string;
}

interface FilePreviewDialogProps {
  open: boolean;
  onClose: () => void;
  file: PreviewFile | null;
  files?: PreviewFile[];
  onNavigate?: (file: PreviewFile) => void;
}

/* ─── Helpers ─── */

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

function getFileTypeLabel(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "Image";
  if (mimeType.startsWith("video/")) return "Video";
  if (mimeType.startsWith("audio/")) return "Audio";
  if (mimeType.includes("pdf")) return "PDF Document";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType.includes("csv")) return "Spreadsheet";
  if (mimeType.includes("word") || mimeType.includes("document")) return "Document";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "Presentation";
  if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("archive")) return "Archive";
  if (mimeType.includes("json") || mimeType.includes("xml") || mimeType.includes("html")) return "Code";
  return "File";
}

function getTypeColor(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "from-emerald-500/20 to-emerald-600/5 border-emerald-500/20 text-emerald-600";
  if (mimeType.startsWith("video/")) return "from-purple-500/20 to-purple-600/5 border-purple-500/20 text-purple-600";
  if (mimeType.startsWith("audio/")) return "from-orange-500/20 to-orange-600/5 border-orange-500/20 text-orange-600";
  if (mimeType.includes("pdf")) return "from-red-500/20 to-red-600/5 border-red-500/20 text-red-600";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "from-green-500/20 to-green-600/5 border-green-500/20 text-green-600";
  if (mimeType.includes("word") || mimeType.includes("document")) return "from-blue-500/20 to-blue-600/5 border-blue-500/20 text-blue-600";
  if (mimeType.includes("presentation")) return "from-orange-500/20 to-orange-600/5 border-orange-500/20 text-orange-600";
  return "from-muted/40 to-muted/20 border-border/40 text-muted-foreground";
}

function getFileIcon(mimeType: string) {
  const cls = "h-5 w-5";
  if (mimeType.startsWith("image/")) return <ImageIcon className={cls} />;
  if (mimeType.startsWith("video/")) return <FileVideo className={cls} />;
  if (mimeType.startsWith("audio/")) return <FileAudio className={cls} />;
  if (mimeType.includes("pdf")) return <FileText className={cls} />;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return <FileSpreadsheet className={cls} />;
  if (mimeType.includes("word") || mimeType.includes("document")) return <FileText className={cls} />;
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return <FileType className={cls} />;
  if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("archive")) return <FileArchive className={cls} />;
  if (mimeType.includes("json") || mimeType.includes("xml") || mimeType.includes("html")) return <FileCode className={cls} />;
  return <File className={cls} />;
}

function canPreviewInIframe(mimeType: string): boolean {
  return (
    mimeType.includes("pdf") ||
    mimeType.startsWith("image/") ||
    mimeType.startsWith("video/") ||
    mimeType.includes("word") ||
    mimeType.includes("document") ||
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel") ||
    mimeType.includes("presentation") ||
    mimeType.includes("powerpoint") ||
    mimeType.includes("text/") ||
    mimeType.includes("google-apps")
  );
}

/* ─── Component ─── */

export function FilePreviewDialog({
  open,
  onClose,
  file,
  files = [],
  onNavigate,
}: FilePreviewDialogProps) {
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const currentIndex = file && files.length > 0
    ? files.findIndex((f) => f.id === file.id)
    : -1;

  const canGoNext = currentIndex >= 0 && currentIndex < files.length - 1;
  const canGoPrev = currentIndex > 0;

  const goNext = useCallback(() => {
    if (canGoNext && onNavigate) {
      setLoading(true);
      onNavigate(files[currentIndex + 1]);
    }
  }, [canGoNext, currentIndex, files, onNavigate]);

  const goPrev = useCallback(() => {
    if (canGoPrev && onNavigate) {
      setLoading(true);
      onNavigate(files[currentIndex - 1]);
    }
  }, [canGoPrev, currentIndex, files, onNavigate]);

  // Reset loading state when file changes
  useEffect(() => {
    if (open && file) setLoading(true);
  }, [open, file?.id]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, goNext, goPrev, onClose]);

  if (!file) return null;

  const previewUrl = `https://drive.google.com/file/d/${file.id}/preview`;
  const downloadUrl = `https://drive.google.com/uc?export=download&id=${file.id}`;
  const canPreview = canPreviewInIframe(file.mimeType);
  const isImage = file.mimeType.startsWith("image/");
  const ext = getFileExtension(file.name);
  const typeColor = getTypeColor(file.mimeType);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "flex flex-col p-0 gap-0 overflow-hidden transition-all duration-200",
          isFullscreen
            ? "max-w-[98vw] h-[98vh]"
            : "max-w-5xl h-[88vh]"
        )}
      >

        {/* ═══ HEADER ═══ */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/40 bg-gradient-to-r from-background to-muted/10 shrink-0">
          {/* File info */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className={cn(
              "h-10 w-10 rounded-xl bg-gradient-to-br border flex items-center justify-center shadow-sm shrink-0",
              typeColor
            )}>
              {getFileIcon(file.mimeType)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold truncate max-w-[400px]">{file.name}</p>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60 font-medium mt-0.5">
                <span className={cn(
                  "px-1.5 py-0.5 rounded font-bold uppercase tracking-widest text-[8px]",
                  typeColor.includes("red") ? "bg-red-500/10 text-red-500" :
                  typeColor.includes("emerald") ? "bg-emerald-500/10 text-emerald-500" :
                  typeColor.includes("blue") ? "bg-blue-500/10 text-blue-500" :
                  typeColor.includes("green") ? "bg-green-500/10 text-green-500" :
                  typeColor.includes("purple") ? "bg-purple-500/10 text-purple-500" :
                  "bg-muted text-muted-foreground"
                )}>
                  {ext}
                </span>
                <span>{formatFileSize(file.size)}</span>
                <span className="text-muted-foreground/30">•</span>
                <span>{formatDate(file.createdTime)}</span>
                {files.length > 1 && currentIndex >= 0 && (
                  <>
                    <span className="text-muted-foreground/30">•</span>
                    <span>{currentIndex + 1} of {files.length}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Previous / Next */}
            {files.length > 1 && (
              <div className="flex items-center gap-0.5 mr-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground"
                  onClick={goPrev}
                  disabled={!canGoPrev}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground"
                  onClick={goNext}
                  disabled={!canGoNext}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Open in Drive */}
            {file.webViewLink && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1.5"
                asChild
              >
                <a href={file.webViewLink} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open
                </a>
              </Button>
            )}

            {/* Download */}
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5"
              asChild
            >
              <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
                <Download className="h-3.5 w-3.5" />
                Download
              </a>
            </Button>

            {/* Fullscreen toggle */}
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground"
              onClick={() => setIsFullscreen(!isFullscreen)}
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>

            <div className="w-px h-6 bg-border/40 mx-0.5" />

            {/* Close */}
            <Button
              size="sm"
              variant="ghost"
              className="h-9 w-9 p-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* ═══ PREVIEW AREA ═══ */}
        <div className="flex-1 min-h-0 relative bg-muted/10">
          {/* Loading overlay */}
          {loading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm gap-3">
              <div className={cn(
                "h-16 w-16 rounded-2xl bg-gradient-to-br border flex items-center justify-center shadow-lg animate-pulse",
                typeColor
              )}>
                {getFileIcon(file.mimeType)}
              </div>
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Loading preview...</span>
              </div>
            </div>
          )}

          {canPreview ? (
            isImage && file.thumbnailLink ? (
              /* Image: render natively for best quality */
              <div className="w-full h-full flex items-center justify-center p-6 bg-[repeating-conic-gradient(#80808010_0%_25%,transparent_0%_50%)] bg-[length:20px_20px]">
                <img
                  src={file.thumbnailLink.replace(/=s\d+/, "=s1600")}
                  alt={file.name}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                  onLoad={() => setLoading(false)}
                  onError={() => setLoading(false)}
                />
              </div>
            ) : (
              /* Everything else: Google Drive preview iframe */
              <iframe
                src={previewUrl}
                className="w-full h-full border-0"
                title={`Preview: ${file.name}`}
                allow="autoplay"
                sandbox="allow-scripts allow-same-origin allow-popups"
                onLoad={() => setLoading(false)}
              />
            )
          ) : (
            /* No preview available */
            <div className="w-full h-full flex flex-col items-center justify-center gap-4">
              <div className={cn(
                "h-24 w-24 rounded-3xl bg-gradient-to-br border-2 flex items-center justify-center shadow-xl",
                typeColor
              )}>
                <div className="scale-150">
                  {getFileIcon(file.mimeType)}
                </div>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold">{file.name}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {getFileTypeLabel(file.mimeType)} • {formatFileSize(file.size)}
                </p>
                <p className="text-xs text-muted-foreground/50 mt-2">
                  Preview is not available for this file type
                </p>
              </div>
              <div className="flex items-center gap-2 mt-2">
                {file.webViewLink && (
                  <Button size="sm" className="gap-1.5" asChild>
                    <a href={file.webViewLink} target="_blank" rel="noopener noreferrer">
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
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
