"use client";

import React, { useEffect, useState, useMemo, Suspense } from "react";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Building2,
  ShoppingCart,
  Users,
  Package,
  Search,
  FileText,
  Image as ImageIcon,
  File,
  Download,
  Pencil,
  Check,
  X,
  Eye,
  ChevronRight,
  FolderOpen,
  CheckCircle,
  Calendar,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useUrlFilters } from "@/hooks/use-url-filters";

interface DocFile {
  _id: string;
  fileName: string;
  fileId: string;
  fileLink: string;
  isVerified?: boolean;
  expiryDate?: string;
  createdBy: string;
  createdAt: string;
}

interface DocGroup {
  docName: string;
  files: DocFile[];
}

interface EntityItem {
  _id: string;
  entityName: string;
  entityId: string;
  documents: DocGroup[];
}

const CATEGORIES = [
  { key: "suppliers", label: "Suppliers", icon: Building2, color: "text-blue-500" },
  { key: "purchase-orders", label: "Purchase Orders", icon: ShoppingCart, color: "text-emerald-500" },
  { key: "customers", label: "Customers", icon: Users, color: "text-violet-500" },
  { key: "products", label: "Products", icon: Package, color: "text-orange-500" },
];

function getFileIcon(fileName: string) {
  const ext = fileName?.split(".").pop()?.toLowerCase() || "";
  if (["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(ext)) return "image";
  if (["pdf"].includes(ext)) return "pdf";
  return "file";
}

function isImageFile(fileName: string) {
  const ext = fileName?.split(".").pop()?.toLowerCase() || "";
  return ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(ext);
}

/** Extract Google Drive file ID from a webViewLink or return the raw fileId */
function extractDriveId(file: DocFile): string {
  // Try to extract from fileLink: https://drive.google.com/file/d/{id}/view...
  const match = file.fileLink?.match(/\/file\/d\/([^/]+)/);
  if (match) return match[1];
  // Fall back to fileId field
  return file.fileId || "";
}

/** Get an embeddable preview URL for Google Drive files */
function getPreviewUrl(file: DocFile): string {
  const driveId = extractDriveId(file);
  if (!driveId) return file.fileLink;
  return `https://drive.google.com/file/d/${driveId}/preview`;
}

/** Get a thumbnail URL for Google Drive images */
function getThumbnailUrl(file: DocFile): string {
  const driveId = extractDriveId(file);
  if (!driveId) return file.fileLink;
  return `https://drive.google.com/thumbnail?id=${driveId}&sz=w400`;
}

const DOCS_FILTER_DEFAULTS = { search: "" };

export default function DocumentsBoxPage() {
  return (
    <Suspense>
      <DocumentsBoxContent />
    </Suspense>
  );
}

function DocumentsBoxContent() {
  const router = useRouter();
  const { setLeftContent } = useHeaderActions();
  const { filters, inputs, setFilter } = useUrlFilters(DOCS_FILTER_DEFAULTS, ["search"], 300);
  const [activeCategory, setActiveCategory] = useState("suppliers");
  const [entities, setEntities] = useState<EntityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntity, setSelectedEntity] = useState<EntityItem | null>(null);
  const [selectedFile, setSelectedFile] = useState<DocFile | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  useEffect(() => {
    setLeftContent(
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          Documents Box
        </h1>
      </div>
    );
    return () => setLeftContent(null);
  }, [setLeftContent, router]);

  useEffect(() => {
    setLoading(true);
    setSelectedEntity(null);
    setSelectedFile(null);
    fetch(`/api/admin/documents-box?category=${activeCategory}`)
      .then((r) => r.json())
      .then((data) => {
        setEntities(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        setEntities([]);
        setLoading(false);
      });
  }, [activeCategory]);

  const filteredEntities = useMemo(() => {
    if (!filters.search.trim()) return entities;
    const q = filters.search.toLowerCase();
    return entities.filter(
      (e) =>
        e.entityName?.toLowerCase().includes(q) ||
        e.entityId?.toLowerCase().includes(q)
    );
  }, [entities, filters.search]);

  const totalFiles = useMemo(() => {
    return entities.reduce(
      (sum, e) => sum + e.documents.reduce((s, d) => s + d.files.length, 0),
      0
    );
  }, [entities]);

  const activeCat = CATEGORIES.find((c) => c.key === activeCategory)!;

  const allFilesForEntity = useMemo(() => {
    if (!selectedEntity) return [];
    return selectedEntity.documents.flatMap((d) =>
      d.files.map((f) => ({ ...f, docName: d.docName }))
    );
  }, [selectedEntity]);

  const handleStartRename = () => {
    if (!selectedFile) return;
    setRenameValue(selectedFile.fileName);
    setRenaming(true);
  };

  const handleRename = async () => {
    if (!selectedFile || !selectedEntity || !renameValue.trim()) return;
    // Find which docName this file belongs to
    const docGroup = selectedEntity.documents.find((d) =>
      d.files.some((f) => f._id === selectedFile._id)
    );
    if (!docGroup) return;

    try {
      const res = await fetch(
        `/api/admin/suppliers/${selectedEntity._id}/documents`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            docName: docGroup.docName,
            fileId: selectedFile._id,
            fileIsVerified: selectedFile.isVerified,
            fileRename: renameValue.trim(),
          }),
        }
      );
      if (!res.ok) throw new Error();
      toast.success("File renamed!");
      setSelectedFile({ ...selectedFile, fileName: renameValue.trim() });
      // Update in entities state
      setEntities((prev) =>
        prev.map((e) =>
          e._id === selectedEntity._id
            ? {
                ...e,
                documents: e.documents.map((d) => ({
                  ...d,
                  files: d.files.map((f) =>
                    f._id === selectedFile._id
                      ? { ...f, fileName: renameValue.trim() }
                      : f
                  ),
                })),
              }
            : e
        )
      );
      // Also update selectedEntity
      setSelectedEntity((prev) =>
        prev
          ? {
              ...prev,
              documents: prev.documents.map((d) => ({
                ...d,
                files: d.files.map((f) =>
                  f._id === selectedFile._id
                    ? { ...f, fileName: renameValue.trim() }
                    : f
                ),
              })),
            }
          : null
      );
      setRenaming(false);
    } catch {
      toast.error("Failed to rename file.");
    }
  };

  return (
    <div className="flex h-[calc(100vh-64px-2rem)] gap-0 overflow-hidden rounded-2xl border border-border bg-card shadow-sm animate-in fade-in duration-500">
      {/* Sub-sidebar */}
      <div className="w-[220px] shrink-0 border-r border-border bg-muted/30 flex flex-col">
        <div className="p-3 border-b border-border">
          <h2 className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">
            Categories
          </h2>
        </div>
        <div className="flex-1 overflow-auto p-2 space-y-1">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                  isActive
                    ? "bg-primary/10 text-primary shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-primary" : cat.color}`} />
                {cat.label}
              </button>
            );
          })}
        </div>
        {/* Stats */}
        <div className="p-3 border-t border-border">
          <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
            {entities.length} entities · {totalFiles} files
          </div>
        </div>
      </div>

      {/* Entity list */}
      <div className="w-[280px] shrink-0 border-r border-border flex flex-col bg-background">
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder={`Search ${activeCat.label.toLowerCase()}...`}
              className="h-8 pl-8 text-xs bg-muted/50 border-transparent"
              value={inputs.search}
              onChange={(e) => setFilter("search", e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 animate-pulse">
                Loading...
              </div>
            </div>
          ) : filteredEntities.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 px-4">
              <FolderOpen className="h-8 w-8 text-muted-foreground/20" />
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 text-center">
                {activeCategory !== "suppliers" && activeCategory !== "purchase-orders"
                  ? "Coming soon"
                  : "No documents found"}
              </div>
            </div>
          ) : (
            <div className="p-1.5 space-y-0.5">
              {filteredEntities.map((entity) => {
                const fileCount = entity.documents.reduce(
                  (s, d) => s + d.files.length,
                  0
                );
                const isSelected = selectedEntity?._id === entity._id;
                return (
                  <button
                    key={entity._id}
                    onClick={() => {
                      setSelectedEntity(entity);
                      setSelectedFile(null);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-all group ${
                      isSelected
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted/50 text-foreground"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold truncate">{entity.entityName}</span>
                        <span className="text-[9px] font-bold text-muted-foreground/50 bg-muted px-1.5 py-0.5 rounded-full shrink-0">
                          {fileCount}
                        </span>
                      </div>
                    </div>
                    <ChevronRight
                      className={`h-3.5 w-3.5 shrink-0 transition-transform ${
                        isSelected ? "text-primary rotate-0" : "text-muted-foreground/30"
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Main content: Files grid + Preview */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selectedEntity ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center">
              <FolderOpen className="h-8 w-8 text-muted-foreground/30" />
            </div>
            <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">
              Select an entity to view documents
            </div>
          </div>
        ) : (
          <div className="flex flex-1 overflow-hidden">
            {/* Files grid */}
            <div className={`flex flex-col overflow-hidden transition-all duration-300 ${selectedFile ? "w-[45%]" : "flex-1"}`}>
              <div className="p-3 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold">{selectedEntity.entityName}</h3>
                  <p className="text-[10px] text-muted-foreground font-medium">
                    {allFilesForEntity.length} document{allFilesForEntity.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-3">
                {selectedEntity.documents.map((docGroup) => (
                  <div key={docGroup.docName} className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <FolderOpen className="h-3.5 w-3.5 text-primary" />
                      <span className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">
                        {docGroup.docName}
                      </span>
                      <span className="text-[9px] font-bold text-muted-foreground/50 bg-muted px-1.5 py-0.5 rounded-full">
                        {docGroup.files.length}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                      {docGroup.files.map((file) => {
                        const type = getFileIcon(file.fileName);
                        const isActive = selectedFile?._id === file._id;
                        return (
                          <button
                            key={file._id}
                            onClick={() => {
                              setSelectedFile(file);
                              setRenaming(false);
                            }}
                            className={`group relative flex flex-col rounded-xl border overflow-hidden transition-all hover:shadow-md ${
                              isActive
                                ? "border-primary ring-2 ring-primary/20 shadow-md"
                                : "border-border hover:border-primary/30"
                            }`}
                          >
                            {/* Thumbnail */}
                            <div className="aspect-[4/3] bg-muted/50 flex items-center justify-center overflow-hidden relative">
                              {/* Fallback icon — always visible underneath */}
                              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                                {type === "pdf" ? (
                                  <>
                                    <FileText className="h-8 w-8 text-red-500/60" />
                                    <span className="text-[9px] font-bold uppercase tracking-widest text-red-500/60">PDF</span>
                                  </>
                                ) : (
                                  <>
                                    <File className="h-8 w-8 text-muted-foreground/40" />
                                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">
                                      {file.fileName?.split(".").pop()?.toUpperCase()}
                                    </span>
                                  </>
                                )}
                              </div>
                              {/* Thumbnail image — covers fallback if it loads successfully */}
                              <img
                                src={getThumbnailUrl(file)}
                                alt={file.fileName}
                                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 z-[1]"
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                onLoad={(e) => {
                                  const img = e.target as HTMLImageElement;
                                  // Google Drive returns tiny placeholder images for private files
                                  if (img.naturalWidth < 10 || img.naturalHeight < 10) img.style.display = "none";
                                }}
                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                              />
                            </div>
                            {/* Verified badge */}
                            {file.isVerified && (
                              <div className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm">
                                <CheckCircle className="h-3 w-3 text-white fill-white" />
                              </div>
                            )}
                            {/* File name */}
                            <div className="p-2 border-t border-border">
                              <p className="text-[10px] font-semibold truncate text-foreground leading-tight">
                                {file.fileName}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Preview panel */}
            {selectedFile && (
              <div className="border-l border-border flex flex-col bg-muted/10 w-[55%] animate-in slide-in-from-right-5 duration-300">
                {/* Preview header */}
                <div className="p-3 border-b border-border flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {renaming ? (
                      <div className="flex items-center gap-1.5">
                        <Input
                          className="h-7 text-xs font-bold flex-1"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRename();
                            if (e.key === "Escape") setRenaming(false);
                          }}
                          autoFocus
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-emerald-500 hover:bg-emerald-500/10"
                          onClick={handleRename}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:bg-muted"
                          onClick={() => setRenaming(false)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <h4 className="text-xs font-bold truncate">
                          {selectedFile.fileName}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[9px] text-muted-foreground font-medium">
                            By {selectedFile.createdBy}
                          </span>
                          <span className="text-[9px] text-muted-foreground/50">
                            {new Date(selectedFile.createdAt).toLocaleDateString()}
                          </span>
                          {selectedFile.isVerified && (
                            <span className="text-[9px] font-bold text-emerald-600 flex items-center gap-0.5">
                              <CheckCircle className="h-2.5 w-2.5" /> Verified
                            </span>
                          )}
                          {selectedFile.expiryDate && (
                            <span className="text-[9px] font-bold text-amber-600 flex items-center gap-0.5">
                              <Calendar className="h-2.5 w-2.5" /> Expires{" "}
                              {new Date(selectedFile.expiryDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  {!renaming && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        title="Rename"
                        onClick={handleStartRename}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        title="Download"
                        onClick={() => window.open(selectedFile.fileLink, "_blank")}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground"
                        onClick={() => setSelectedFile(null)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Preview body */}
                <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-gradient-to-b from-muted/20 to-muted/5">
                  {isImageFile(selectedFile.fileName) ? (
                    <img
                      src={getPreviewUrl(selectedFile).replace('/preview', '/view')}
                      alt={selectedFile.fileName}
                      className="max-w-full max-h-full object-contain rounded-xl shadow-2xl border border-border"
                      onError={(e) => { (e.target as HTMLImageElement).src = getThumbnailUrl(selectedFile); }}
                    />
                  ) : (
                    <div className="relative w-full h-full overflow-hidden rounded-xl border border-border shadow-xl">
                      <iframe
                        src={getPreviewUrl(selectedFile)}
                        className="absolute top-0 left-0 w-[calc(100%+50px)] h-full border-0"
                        title={selectedFile.fileName}
                        allow="autoplay"
                        sandbox="allow-scripts allow-same-origin"
                      />
                    </div>
                  )}

                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
