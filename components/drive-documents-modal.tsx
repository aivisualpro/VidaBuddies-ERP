"use client";

import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { EmailComposeDialog, EmailInitialData } from "@/components/email-compose-dialog";
import {
  Paperclip, Upload, FolderOpen, Loader2, FileText, Image, File,
  Eye, EyeOff, Package, Ship, ShoppingCart, Mail, Send,
  FileVideo, FileAudio, FileSpreadsheet, FileArchive,
  Trash2, X, Check,
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

interface GroupedDocs {
  label: string;
  kind: "VBNumber" | "VBSerialNumber" | "VBShipmentNumber";
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
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
}

/* ─── Component ─── */
export function DriveDocumentsModal({ open, onClose, poNumber, onOpenLegacy }: DriveDocumentsModalProps) {
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<GroupedDocs[]>([]);
  const [activeGroup, setActiveGroup] = useState("all");
  const [activeTab, setActiveTab] = useState<"all" | "Internal" | "External" | "emails">("all");
  const [previewFile, setPreviewFile] = useState<DocRecord | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Emails
  const [emailRecords, setEmailRecords] = useState<any[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [emailComposeOpen, setEmailComposeOpen] = useState(false);
  const [emailComposeMode, setEmailComposeMode] = useState<"compose" | "view">("compose");
  const [emailInitialData, setEmailInitialData] = useState<EmailInitialData | undefined>();

  const fetchDocs = useCallback(async () => {
    if (!poNumber) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/drive-documents?vbNumber=${encodeURIComponent(poNumber)}`);
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      const result: GroupedDocs[] = [];
      if (data.po?.driveDocuments?.length) result.push({ label: data.po.VBNumber, kind: "VBNumber", docs: data.po.driveDocuments });
      for (const c of (data.cpos || [])) if (c.driveDocuments?.length) result.push({ label: c.VBSerialNumber, kind: "VBSerialNumber", docs: c.driveDocuments });
      for (const s of (data.ships || [])) if (s.driveDocuments?.length) result.push({ label: s.VBShipmentNumber, kind: "VBShipmentNumber", docs: s.driveDocuments });
      setGroups(result);
    } catch { toast.error("Failed to load documents"); }
    finally { setLoading(false); }
  }, [poNumber]);

  const fetchEmails = useCallback(async () => {
    if (!poNumber) return;
    setLoadingEmails(true);
    try {
      const res = await fetch(`/api/admin/emails?vbpoNo=${encodeURIComponent(poNumber)}`);
      const data = await res.json();
      if (res.ok) setEmailRecords(data.emails || []);
    } catch { /* */ }
    finally { setLoadingEmails(false); }
  }, [poNumber]);

  useEffect(() => {
    if (open) {
      fetchDocs(); fetchEmails();
      setActiveGroup("all"); setActiveTab("all");
      setSelectedIds(new Set()); setPreviewFile(null);
    }
  }, [open, fetchDocs, fetchEmails]);

  // Intercept Escape: close preview first, then modal
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (previewFile) {
          e.preventDefault();
          e.stopPropagation();
          setPreviewFile(null);
        }
      }
    };
    window.addEventListener("keydown", handleKey, true);
    return () => window.removeEventListener("keydown", handleKey, true);
  }, [open, previewFile]);

  // Filtered docs
  const filteredDocs: { doc: DocRecord; source: string; kind: string }[] = [];
  if (activeTab !== "emails") {
    for (const g of groups) {
      if (activeGroup !== "all" && g.label !== activeGroup) continue;
      for (const d of g.docs) {
        if (activeTab !== "all" && d.documentType !== activeTab) continue;
        filteredDocs.push({ doc: d, source: g.label, kind: g.kind });
      }
    }
  }

  const allDocs = groups.flatMap(g => g.docs);
  const allCount = allDocs.length;
  const internalCount = allDocs.filter(d => d.documentType === "Internal").length;
  const externalCount = allDocs.filter(d => d.documentType === "External").length;

  const sidebarKinds = [
    { kind: "VBNumber" as const, label: "Purchase Orders", items: groups.filter(g => g.kind === "VBNumber") },
    { kind: "VBSerialNumber" as const, label: "Customer POs", items: groups.filter(g => g.kind === "VBSerialNumber") },
    { kind: "VBShipmentNumber" as const, label: "Shipments", items: groups.filter(g => g.kind === "VBShipmentNumber") },
  ];

  const toggleSelect = (id: string) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selCount = selectedIds.size;
  const hasExternalSelected = selCount > 0 && Array.from(selectedIds).some(id => filteredDocs.find(d => d.doc.driveFileId === id)?.doc.documentType === "External");

  const openEmailView = (email: any) => {
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
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => {
        if (!v) {
          // If preview is open, close preview only
          if (previewFile) { setPreviewFile(null); return; }
          onClose();
        }
      }}>
        <DialogContent
          className="max-w-6xl h-[88vh] flex flex-col p-0 gap-0 overflow-hidden"
          onInteractOutside={(e) => { if (previewFile) e.preventDefault(); }}
          onPointerDownOutside={(e) => { if (previewFile) e.preventDefault(); }}
          onFocusOutside={(e) => { if (previewFile) e.preventDefault(); }}
        >
          {/* HEADER */}
          <div className="flex items-center justify-between px-6 py-3.5 border-b border-border/40 bg-gradient-to-r from-background to-muted/20 shrink-0">
            <DialogHeader className="p-0 space-y-0">
              <DialogTitle className="text-lg font-bold flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10 flex items-center justify-center shadow-sm">
                  <Paperclip className="h-4 w-4 text-primary" />
                </div>
                Attachments
                <span className="text-xs font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-md">{poNumber}</span>
              </DialogTitle>
              <DialogDescription className="sr-only">Manage attachments for {poNumber}</DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2">
              {selCount > 0 && activeTab !== "emails" && (
                <>
                  {hasExternalSelected && (
                    <Button size="sm" className="h-8 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 shadow-sm">
                      <Mail className="h-3.5 w-3.5" /> Email ({selCount})
                    </Button>
                  )}
                  {selCount > 1 && (
                    <Button size="sm" className="h-8 text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 shadow-sm text-white">
                      <FileText className="h-3.5 w-3.5" /> Merge ({selCount})
                    </Button>
                  )}
                  <Button size="sm" variant="destructive" className="h-8 text-xs gap-1.5 shadow-sm">
                    <Trash2 className="h-3.5 w-3.5" /> Delete ({selCount})
                  </Button>
                  <div className="w-px h-6 bg-border/40 mx-1" />
                </>
              )}
              {onOpenLegacy && (
                <>
                  <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={onOpenLegacy}>
                    <FolderOpen className="h-3.5 w-3.5" /> Folder
                  </Button>
                  <Button size="sm" className="h-8 text-xs gap-1.5 shadow-sm" onClick={onOpenLegacy}>
                    <Upload className="h-3.5 w-3.5" /> Upload
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* BODY */}
          <div className="flex flex-1 min-h-0 overflow-hidden">

            {/* Sidebar */}
            <div className="w-[190px] border-r bg-muted/10 flex flex-col shrink-0 overflow-y-auto">
              <button onClick={() => { setActiveGroup("all"); setSelectedIds(new Set()); }}
                className={cn("w-full text-left px-4 py-3 text-xs font-semibold transition-all border-l-2 flex items-center justify-between",
                  activeGroup === "all" ? "bg-primary/10 text-primary border-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border-transparent")}>
                <span className="flex items-center gap-2"><Paperclip className="h-3.5 w-3.5" /> All</span>
                <span className="text-[10px] font-bold bg-muted/60 px-1.5 py-0.5 rounded-full">{allCount}</span>
              </button>
              {sidebarKinds.map((sk) => sk.items.length > 0 && (
                <div key={sk.kind}>
                  <div className="px-4 pt-3 pb-1"><p className="text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground/50">{sk.label}</p></div>
                  {sk.items.map((item) => (
                    <button key={item.label} onClick={() => { setActiveGroup(item.label); setSelectedIds(new Set()); }}
                      className={cn("w-full text-left px-4 py-2.5 text-xs font-medium transition-all border-l-2 flex items-center justify-between gap-2",
                        activeGroup === item.label ? "bg-primary/10 text-primary border-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border-transparent")}>
                      <span className="flex items-center gap-2 truncate"><span className={kindColor(item.kind)}>{kindIcon(item.kind)}</span><span className="truncate">{item.label}</span></span>
                      <span className="text-[10px] font-bold bg-muted/60 px-1.5 py-0.5 rounded-full shrink-0">{item.docs.length}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* Tabs */}
              <div className="flex items-center gap-1 px-4 py-2 border-b border-border/30 bg-muted/20 shrink-0">
                {([
                  { key: "all" as const, label: "All", count: allCount, icon: <Paperclip className="h-3 w-3" /> },
                  { key: "Internal" as const, label: "Internal", count: internalCount, icon: <Eye className="h-3 w-3" /> },
                  { key: "External" as const, label: "External", count: externalCount, icon: <EyeOff className="h-3 w-3" /> },
                  { key: "emails" as const, label: "Emails", count: emailRecords.length, icon: <Mail className="h-3 w-3" /> },
                ]).map((tab) => (
                  <button key={tab.key} onClick={() => { setActiveTab(tab.key); setSelectedIds(new Set()); setPreviewFile(null); }}
                    className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                      activeTab === tab.key ? (tab.key === "emails" ? "bg-blue-500/10 text-blue-500 shadow-sm" : "bg-primary/10 text-primary shadow-sm") : "text-muted-foreground hover:text-foreground hover:bg-muted/50")}>
                    {tab.icon} {tab.label}
                    <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center",
                      activeTab === tab.key ? (tab.key === "emails" ? "bg-blue-500/20 text-blue-500" : "bg-primary/20 text-primary") : "bg-muted text-muted-foreground")}>{tab.count}</span>
                  </button>
                ))}
              </div>

              {/* Grid / Emails */}
              <div className="flex-1 overflow-y-auto min-h-0 p-3">
                {activeTab === "emails" ? (
                  loadingEmails ? (
                    <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary/30" /></div>
                  ) : emailRecords.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                      <div className="h-16 w-16 rounded-2xl bg-blue-500/5 border border-blue-500/10 flex items-center justify-center"><Mail className="h-7 w-7 text-blue-500/40" /></div>
                      <p className="text-sm font-semibold text-muted-foreground">No emails sent yet</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {emailRecords.map((email: any, idx: number) => (
                        <div key={email._id || idx} onClick={() => openEmailView(email)}
                          className="flex items-start gap-3 p-3 rounded-xl border border-border/30 hover:bg-muted/30 hover:border-border/60 transition-all cursor-pointer group">
                          <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5", email.status === "sent" ? "bg-emerald-500/10" : "bg-destructive/10")}>
                            <Send className={cn("h-3.5 w-3.5", email.status === "sent" ? "text-emerald-600" : "text-destructive")} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold truncate">{email.subject || "(No subject)"}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">To: {(email.to || []).join(", ")}</p>
                            {email.body && <p className="text-[10px] text-muted-foreground/50 mt-1 line-clamp-1">{email.body.substring(0, 80)}</p>}
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className="text-[10px] text-muted-foreground">{fmtDate(email.sentAt)}</span>
                            {email.attachments?.length > 0 && (
                              <span className="text-[9px] font-bold bg-muted px-1.5 py-0.5 rounded-full">{email.attachments.length} files</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : loading ? (
                  <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary/30" /></div>
                ) : filteredDocs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <div className="h-20 w-20 rounded-2xl border-2 border-dashed border-primary/20 bg-primary/5 flex items-center justify-center"><Paperclip className="h-8 w-8 text-primary/30" /></div>
                    <p className="text-sm font-semibold text-muted-foreground">No documents found</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                    {filteredDocs.map((item, idx) => {
                      const d = item.doc;
                      const isSelected = selectedIds.has(d.driveFileId);
                      const isPreviewing = previewFile?.driveFileId === d.driveFileId;
                      return (
                        <div key={`${d.driveFileId}-${idx}`}
                          className={cn(
                            "group relative rounded-xl border overflow-hidden transition-all duration-200 cursor-pointer",
                            isPreviewing ? "border-primary ring-2 ring-primary/20 shadow-lg" :
                            isSelected ? "border-primary/60 ring-1 ring-primary/20 bg-primary/[0.02]" :
                            "border-border/40 hover:border-border/80 hover:shadow-md"
                          )}
                          onClick={() => setPreviewFile(d)}>

                          {/* Checkbox */}
                          <div className="absolute top-2.5 left-2.5 z-10" onClick={(e) => { e.stopPropagation(); toggleSelect(d.driveFileId); }}>
                            <div className={cn("h-6 w-6 rounded-lg border-2 flex items-center justify-center transition-all shadow-sm",
                              isSelected ? "bg-primary border-primary text-white" : "bg-background/80 backdrop-blur-sm border-border/60 opacity-0 group-hover:opacity-100")}>
                              {isSelected && <Check className="h-3.5 w-3.5" />}
                            </div>
                          </div>

                          {/* Thumbnail */}
                          <div className="relative h-[140px] bg-muted/30 overflow-hidden">
                            <img src={thumbUrl(d.driveFileId)} alt={d.documentName}
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                              onError={(e) => {
                                const img = e.target as HTMLImageElement;
                                img.style.display = 'none';
                                const fb = img.parentElement?.querySelector('.thumb-fb') as HTMLElement;
                                if (fb) fb.style.display = 'flex';
                              }} />
                            <div className="thumb-fb absolute inset-0 items-center justify-center bg-gradient-to-br from-muted/40 to-muted/20" style={{ display: 'none' }}>
                              <div className="flex flex-col items-center gap-2">
                                <div className="h-14 w-14 rounded-2xl bg-background/80 border border-border/40 flex items-center justify-center shadow-sm">{getIcon(d.mimeType)}</div>
                                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">{d.documentName?.split('.').pop()?.toUpperCase() || 'FILE'}</span>
                              </div>
                            </div>
                            <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/40 to-transparent" />
                          </div>

                          {/* Info */}
                          <div className="p-3 space-y-2">
                            <p className="text-xs font-semibold truncate leading-tight" title={d.documentName}>{d.documentName}</p>
                            <div className="flex flex-wrap gap-1.5">
                              <span className={cn("inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full",
                                d.documentType === "Internal" ? "bg-primary/10 text-primary" : "bg-amber-500/10 text-amber-600 dark:text-amber-400")}>
                                {d.documentType === "Internal" ? <Eye className="h-2.5 w-2.5" /> : <EyeOff className="h-2.5 w-2.5" />}
                                {d.documentType}
                              </span>
                              <span className="text-[9px] font-semibold text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-full">{fmtSize(d.size)}</span>
                              <span className="text-[9px] font-semibold text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-full">{fmtDate(d.createdAt)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-2 border-t border-border/30 bg-muted/20 shrink-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {activeTab === "emails" ? `${emailRecords.length} email${emailRecords.length !== 1 ? "s" : ""}` :
                  `${filteredDocs.length} file${filteredDocs.length !== 1 ? "s" : ""}`}
                  {selCount > 0 && ` · ${selCount} selected`}
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ RIGHT-SIDE PREVIEW PANEL (50vw, fixed on screen) ═══ */}
      {previewFile && (
        <div className="fixed inset-y-0 right-0 w-[50vw] z-[60] flex flex-col bg-background border-l border-border/40 shadow-2xl animate-in slide-in-from-right duration-200">
          {/* Preview header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-border/40 bg-gradient-to-r from-background to-muted/10 shrink-0">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {getIcon(previewFile.mimeType)}
              <div className="min-w-0">
                <p className="text-sm font-bold truncate">{previewFile.documentName}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full",
                    previewFile.documentType === "Internal" ? "bg-primary/10 text-primary" : "bg-amber-500/10 text-amber-600")}>
                    {previewFile.documentType}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{fmtSize(previewFile.size)}</span>
                  <span className="text-[10px] text-muted-foreground">{fmtDate(previewFile.createdAt)}</span>
                </div>
              </div>
            </div>
            <Button size="icon" variant="ghost" className="h-9 w-9 rounded-lg shrink-0 text-muted-foreground hover:text-foreground" onClick={() => setPreviewFile(null)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          {/* Iframe */}
          <div className="flex-1 min-h-0 relative bg-muted/5">
            <iframe
              key={previewFile.driveFileId}
              src={`https://drive.google.com/file/d/${previewFile.driveFileId}/preview`}
              className="absolute inset-0 w-full h-full border-0"
              title={`Preview: ${previewFile.documentName}`}
              allow="autoplay"
            />
            {/* Hide Google Drive's pop-out icon */}
            <div className="absolute top-0 right-0 w-14 h-14 bg-background z-10" />
          </div>
        </div>
      )}

      {/* Email Compose/View Dialog */}
      <EmailComposeDialog
        open={emailComposeOpen}
        onClose={() => { setEmailComposeOpen(false); setEmailComposeMode("compose"); setEmailInitialData(undefined); }}
        attachments={[]}
        vbpoNo={poNumber}
        onSent={() => { fetchEmails(); setEmailComposeMode("compose"); setEmailInitialData(undefined); }}
        mode={emailComposeMode}
        initialData={emailInitialData}
        onForward={(data) => {
          setEmailComposeOpen(false);
          setTimeout(() => { setEmailComposeMode("compose"); setEmailInitialData(data); setEmailComposeOpen(true); }, 200);
        }}
      />
    </>
  );
}
