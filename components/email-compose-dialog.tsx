"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useUserDataStore } from "@/store/useUserDataStore";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmailChipInput, EmailContact } from "@/components/email-chip-input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Send,
  Loader2,
  Paperclip,
  X,
  Save,
  FileText,
  ChevronDown,
  Trash2,
  Sparkles,
  Mail,
  Users,
  Type,
  AlignLeft,
  Image,
  FileSpreadsheet,
  File,
  FileVideo,
  FileArchive,
  FileCode,
  Folder,
  Forward,
  Clock,
} from "lucide-react";

/* ─── Types ─── */

interface AttachmentFile {
  id: string;
  name: string;
  mimeType: string;
  size: string;
}

interface EmailTemplate {
  name: string;
  subject: string;
  body: string;
}

export interface EmailInitialData {
  to?: string;
  cc?: string;
  subject?: string;
  body?: string;
  attachments?: AttachmentFile[];
  from?: string;
  sentAt?: string;
  id?: string;
  type?: string;
  reference?: string;
}

interface EmailComposeDialogProps {
  open: boolean;
  onClose: () => void;
  attachments: AttachmentFile[];
  vbpoNo?: string;
  folderPath?: string;
  onSent?: () => void;
  mode?: "compose" | "view";
  initialData?: EmailInitialData;
  onForward?: (data: EmailInitialData) => void;
}

/* ─── Helpers ─── */

function getSmallFileIcon(mimeType: string) {
  const cls = "h-3.5 w-3.5";
  if (mimeType === "application/vnd.google-apps.folder") return <Folder className={cn(cls, "text-yellow-600")} />;
  if (mimeType.startsWith("image/")) return <Image className={cn(cls, "text-emerald-500")} />;
  if (mimeType.startsWith("video/")) return <FileVideo className={cn(cls, "text-purple-500")} />;
  if (mimeType.includes("pdf")) return <FileText className={cn(cls, "text-red-500")} />;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return <FileSpreadsheet className={cn(cls, "text-green-600")} />;
  if (mimeType.includes("zip") || mimeType.includes("archive")) return <FileArchive className={cn(cls, "text-amber-600")} />;
  if (mimeType.includes("word") || mimeType.includes("document")) return <FileText className={cn(cls, "text-blue-600")} />;
  if (mimeType.includes("json") || mimeType.includes("xml")) return <FileCode className={cn(cls, "text-sky-500")} />;
  return <File className={cn(cls, "text-muted-foreground")} />;
}

function formatSize(bytes: string | number): string {
  const size = typeof bytes === "string" ? parseInt(bytes, 10) : bytes;
  if (!size || size === 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

/* ─── Component ─── */

export function EmailComposeDialog({ open, onClose, attachments, vbpoNo, folderPath, onSent, mode = "compose", initialData, onForward }: EmailComposeDialogProps) {
  const isViewMode = mode === "view";
  const [to, setTo] = useState<string[]>([]);
  const [cc, setCc] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [emailType, setEmailType] = useState("Invoice");
  const [reference, setReference] = useState("");
  const [isShipping, setIsShipping] = useState(true);
  const [localAttachments, setLocalAttachments] = useState<AttachmentFile[]>([]);
  
  const { purchaseOrders } = useUserDataStore();
  
  const availableReferences = useMemo(() => {
    if (!vbpoNo) return [];
    const po = purchaseOrders.find((p) => p.vbpoNo === vbpoNo);
    if (!po) return [];
    
    const refs: string[] = [];
    po.customerPO?.forEach((cpo: any) => {
      cpo.shipping?.forEach((ship: any) => {
        if (ship.svbid) refs.push(ship.svbid);
      });
    });
    return refs;
  }, [purchaseOrders, vbpoNo]);

  // Templates
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Email contacts for autocomplete
  const [emailContacts, setEmailContacts] = useState<EmailContact[]>([]);

  // Fetch email contacts on first open
  const fetchContacts = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/email-contacts");
      const data = await res.json();
      if (data.contacts) setEmailContacts(data.contacts);
    } catch { /* silent */ }
  }, []);

  // Initialize attachments and subject when dialog opens
  useEffect(() => {
    if (open) {
      if (initialData) {
        // Parse to/cc from string to arrays
        const parseEmails = (val?: string) =>
          val ? val.split(",").map((e) => e.trim()).filter(Boolean) : [];
        setTo(parseEmails(initialData.to));
        setCc(parseEmails(initialData.cc));
        setSubject(initialData.subject || "");
        setBody(initialData.body || "");
        setEmailType(initialData.type || "Invoice");
        setReference(initialData.reference || "");
        setLocalAttachments(initialData.attachments || []);
      } else {
        setLocalAttachments([...attachments]);
        if (folderPath && !subject) {
          setSubject(folderPath);
        }
      }
      if (!isViewMode) {
        fetchTemplates();
        fetchContacts();
      }
    }
  }, [open, attachments]);

  const fetchTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const res = await fetch("/api/admin/email-templates");
      const data = await res.json();
      if (res.ok) {
        setTemplates(data.templates || []);
      }
    } catch {
      // silent
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  const removeAttachment = (id: string) => {
    setLocalAttachments((prev) => prev.filter((f) => f.id !== id));
  };

  const handleSend = async () => {
    if (to.length === 0) {
      toast.error("Please enter at least one recipient");
      return;
    }
    if (!subject.trim()) {
      toast.error("Please enter a subject");
      return;
    }

    if (emailType === "Invoice" && isShipping && !reference) {
      toast.error("Please select a Reference shipment for the Invoice.");
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/admin/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: to.join(", "),
          cc: cc.join(", "),
          subject,
          body,
          type: emailType,
          reference: isShipping ? reference : "",
          isShipping: emailType === "Invoice" ? isShipping : undefined,
          vbpoNo,
          folderPath,
          fileIds: localAttachments.filter(
            (f) => f.mimeType !== "application/vnd.google-apps.folder"
          ),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Email sent successfully!", {
          description: `${data.attachmentCount || 0} attachment(s) included`,
        });
        onSent?.();
        handleClose();
      } else {
        toast.error("Failed to send email", { description: data.error });
      }
    } catch {
      toast.error("Failed to send email", { description: "Network error" });
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setTo([]);
    setCc([]);
    setSubject("");
    setBody("");
    setShowTemplates(false);
    setShowSaveTemplate(false);
    setTemplateName("");
    setEmailType("Invoice");
    setReference("");
    setIsShipping(true);
    setLocalAttachments([]);
    onClose();
  };

  const handleTypeChange = async (newType: string) => {
    setEmailType(newType);
    if (isViewMode && initialData?.id) {
      try {
        await fetch("/api/admin/emails", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: initialData.id, type: newType }),
        });
        toast.success("Type updated");
        window.dispatchEvent(new CustomEvent("vb-email-records-updated", { detail: { vbpoNo } }));
        onSent?.();
      } catch {
        toast.error("Failed to update type");
      }
    }
  };

  const handleReferenceChange = async (newRef: string) => {
    setReference(newRef);
    if (isViewMode && initialData?.id) {
      try {
        const res = await fetch("/api/admin/emails", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: initialData.id, reference: newRef }),
        });
        const d = await res.json();
        if (!res.ok) {
          toast.error("Save failed: " + (d.error || "unknown error"));
          return;
        }
        toast.success("Reference updated");
        // Broadcast so PO detail page can immediately refresh its emailRecords
        window.dispatchEvent(new CustomEvent("vb-email-records-updated", { detail: { vbpoNo } }));
        onSent?.();
      } catch (err: any) {
        toast.error("Failed to update reference: " + err.message);
      }
    }
  };

  const applyTemplate = (template: EmailTemplate) => {
    setSubject(template.subject || "");
    setBody(template.body || "");
    setShowTemplates(false);
    toast.success(`Template "${template.name}" applied`);
  };

  const saveTemplate = async () => {
    if (!templateName.trim()) {
      toast.error("Please enter a template name");
      return;
    }

    try {
      const res = await fetch("/api/admin/email-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: templateName.trim(),
          subject,
          body,
        }),
      });

      if (res.ok) {
        toast.success(`Template "${templateName}" saved`);
        setShowSaveTemplate(false);
        setTemplateName("");
        fetchTemplates();
      } else {
        toast.error("Failed to save template");
      }
    } catch {
      toast.error("Failed to save template");
    }
  };

  const deleteTemplate = async (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch("/api/admin/email-templates", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        toast.success(`Template "${name}" deleted`);
        fetchTemplates();
      }
    } catch {
      toast.error("Failed to delete template");
    }
  };

  const fileAttachments = localAttachments.filter(
    (f) => f.mimeType !== "application/vnd.google-apps.folder"
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !sending) handleClose(); }}>
      <DialogContent showCloseButton={false} className="max-w-3xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">

        {/* ═══ HEADER ═══ */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/40 bg-gradient-to-r from-background to-muted/20 shrink-0">
          <DialogHeader className="p-0 space-y-0">
            <DialogTitle className="text-lg font-bold flex items-center gap-2.5">
              <div className={cn(
                "h-9 w-9 rounded-xl bg-gradient-to-br border flex items-center justify-center shadow-sm",
                isViewMode
                  ? "from-emerald-500/20 to-emerald-600/5 border-emerald-500/10"
                  : "from-blue-500/20 to-blue-600/5 border-blue-500/10"
              )}>
                {isViewMode
                  ? <Send className="h-4.5 w-4.5 text-emerald-600" />
                  : <Mail className="h-4.5 w-4.5 text-blue-600" />
                }
              </div>
              {isViewMode ? "Sent Email" : "Compose Email"}
              {fileAttachments.length > 0 && (
                <span className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded-full",
                  isViewMode ? "bg-emerald-500/10 text-emerald-600" : "bg-blue-500/10 text-blue-600"
                )}>
                  {fileAttachments.length} attachment{fileAttachments.length > 1 ? "s" : ""}
                </span>
              )}
              {isViewMode && initialData?.sentAt && (
                <span className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground/60">
                  <Clock className="h-3 w-3" />
                  {new Date(initialData.sentAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  {" "}
                  {new Date(initialData.sentAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
                </span>
              )}
            </DialogTitle>
            <DialogDescription className="sr-only">{isViewMode ? "View sent email details" : "Compose and send a new email"}</DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2 shrink-0">
            {/* VIEW MODE: Forward + Close */}
            {isViewMode ? (
              <>
                <Button
                  size="sm"
                  className="h-8 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 shadow-sm"
                  onClick={() => {
                    onForward?.({
                      to: to.join(", "),
                      cc: cc.join(", "),
                      subject: `Fwd: ${subject}`,
                      body: `\n\n---------- Forwarded message ----------\nFrom: ${initialData?.from || "Vida Buddies"}\nTo: ${to.join(", ")}\nSubject: ${subject}\n\n${body}`,
                      attachments: [...localAttachments],
                    });
                    handleClose();
                  }}
                >
                  <Forward className="h-3.5 w-3.5" />
                  Forward
                </Button>
              </>
            ) : (
              <>
                {/* COMPOSE MODE: Templates + Send */}
                {/* Templates dropdown */}
                <div className="relative">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1.5"
                    onClick={() => setShowTemplates(!showTemplates)}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Templates
                    <ChevronDown className={cn("h-3 w-3 transition-transform", showTemplates && "rotate-180")} />
                  </Button>

                  {showTemplates && (
                    <div className="absolute right-0 top-10 z-50 w-72 bg-popover border rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="px-3 py-2.5 border-b bg-muted/30">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                          Saved Templates
                        </p>
                      </div>
                      <div className="max-h-[200px] overflow-y-auto">
                        {loadingTemplates ? (
                          <div className="flex items-center justify-center py-6">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          </div>
                        ) : templates.length === 0 ? (
                          <div className="text-center py-6 px-4">
                            <p className="text-xs text-muted-foreground">No templates saved yet</p>
                            <p className="text-[10px] text-muted-foreground/60 mt-1">Compose an email and save it as a template</p>
                          </div>
                        ) : (
                          templates.map((t) => (
                            <div
                              key={t.name}
                              role="button"
                              tabIndex={0}
                              onClick={() => applyTemplate(t)}
                              onKeyDown={(e) => { if (e.key === "Enter") applyTemplate(t); }}
                              className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-muted/50 transition-colors group cursor-pointer"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold truncate">{t.name}</p>
                                {t.subject && (
                                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">{t.subject}</p>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={(e) => deleteTemplate(t.name, e)}
                                className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all shrink-0 ml-2"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="px-3 py-2 border-t bg-muted/20">
                        {showSaveTemplate ? (
                          <div className="flex items-center gap-1.5">
                            <Input
                              value={templateName}
                              onChange={(e) => setTemplateName(e.target.value)}
                              placeholder="Template name..."
                              className="h-7 text-xs flex-1"
                              autoFocus
                              onKeyDown={(e) => { if (e.key === "Enter") saveTemplate(); if (e.key === "Escape") setShowSaveTemplate(false); }}
                            />
                            <Button size="sm" className="h-7 text-[10px] px-2" onClick={saveTemplate}>
                              Save
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-[10px] w-full gap-1.5 text-muted-foreground"
                            onClick={() => setShowSaveTemplate(true)}
                          >
                            <Save className="h-3 w-3" />
                            Save current as template
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <Button
                  size="sm"
                  className="h-8 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 shadow-sm"
                  onClick={handleSend}
                  disabled={sending}
                >
                  {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  {sending ? "Sending..." : "Send"}
                </Button>
              </>
            )}

            <div className="w-px h-6 bg-border/40 mx-0.5" />

            <Button
              size="sm"
              variant="ghost"
              className="h-9 w-9 p-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60"
              onClick={handleClose}
              disabled={sending}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* ═══ FORM ═══ */}
        <form autoComplete="off" onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex-1 overflow-y-auto min-h-0" onClick={() => showTemplates && setShowTemplates(false)}>
          <div className="divide-y divide-border/30">

            {/* From (view mode only) */}
            {isViewMode && initialData?.from && (
              <div className="flex items-center px-6">
                <div className="flex items-center gap-2 w-[60px] shrink-0">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground/50" />
                  <span className="text-xs font-semibold text-muted-foreground">From</span>
                </div>
                <div className="text-sm h-11 px-2 flex items-center text-muted-foreground">
                  {initialData.from}
                </div>
              </div>
            )}

            {/* To */}
            <div className="flex items-start px-6">
              <div className="flex items-center gap-2 w-[60px] shrink-0 pt-2.5">
                <Users className="h-3.5 w-3.5 text-muted-foreground/50" />
                <label htmlFor="compose-to-field" className="text-xs font-semibold text-muted-foreground">To</label>
              </div>
              <EmailChipInput
                id="compose-to-field"
                value={to}
                onChange={setTo}
                contacts={emailContacts}
                readOnly={isViewMode}
                placeholder="Add recipients..."
              />
            </div>

            {/* Type */}
            <div className="flex items-center px-6 border-b border-border/30">
              <div className="flex items-center gap-2 w-[60px] shrink-0 py-2.5">
                <File className="h-3.5 w-3.5 text-muted-foreground/50" />
                <span className="text-xs font-semibold text-muted-foreground">Type</span>
              </div>
              <div className="py-2.5">
                <Select value={emailType} onValueChange={handleTypeChange}>
                  <SelectTrigger className="h-8 text-xs border-0 shadow-none focus:ring-0 px-2 w-[150px] font-medium text-muted-foreground hover:bg-muted/30">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Invoice">Invoice</SelectItem>
                    <SelectItem value="Custom">Custom</SelectItem>
                    <SelectItem value="Documents">Documents</SelectItem>
                    <SelectItem value="PO">PO</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {emailType === "Invoice" && (
                <div className="flex items-center gap-3 ml-2">
                  {/* Shipping Toggle */}
                  <div className="flex items-center gap-1.5">
                    <Switch
                      id="is-shipping-toggle"
                      size="sm"
                      checked={isShipping}
                      onCheckedChange={setIsShipping}
                      disabled={isViewMode}
                    />
                    <Label
                      htmlFor="is-shipping-toggle"
                      className={cn(
                        "text-[10px] font-semibold cursor-pointer select-none transition-colors",
                        isShipping ? "text-emerald-600" : "text-muted-foreground/60"
                      )}
                    >
                      Shipping
                    </Label>
                  </div>

                  {/* Reference dropdown — only when shipping is ON */}
                  {isShipping && availableReferences.length > 0 && (
                    <div className="flex-1 max-w-[200px]">
                      <Select value={reference} onValueChange={handleReferenceChange}>
                        <SelectTrigger className="h-8 text-xs bg-background/50 border-input/40 shadow-sm focus:ring-1 focus:ring-primary/20 transition-all font-medium">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <FileText className="h-3 w-3" />
                            <SelectValue placeholder="Select reference" />
                          </div>
                        </SelectTrigger>
                        <SelectContent align="start" className="min-w-[140px] max-w-[200px] border-border/40 shadow-md">
                          {availableReferences.map(ref => (
                            <SelectItem key={ref} value={ref} className="text-xs font-semibold">{ref}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}
            </div>


            {/* Cc */}
            <div className="flex items-start px-6">
              <div className="flex items-center gap-2 w-[60px] shrink-0 pt-2.5">
                <Users className="h-3.5 w-3.5 text-muted-foreground/50" />
                <label htmlFor="compose-cc-field" className="text-xs font-semibold text-muted-foreground">Cc</label>
              </div>
              <EmailChipInput
                id="compose-cc-field"
                value={cc}
                onChange={setCc}
                contacts={emailContacts}
                readOnly={isViewMode}
                placeholder="Add Cc..."
              />
            </div>

            {/* Subject */}
            <div className="flex items-center px-6">
              <div className="flex items-center gap-2 w-[60px] shrink-0">
                <Type className="h-3.5 w-3.5 text-muted-foreground/50" />
                <label htmlFor="compose-subject-field" className="text-xs font-semibold text-muted-foreground">Subject</label>
              </div>
              <Input
                id="compose-subject-field"
                name="compose-subject-field"
                autoComplete="nope-subj-xz9"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                readOnly={isViewMode}
                placeholder="Email subject..."
                className={cn("border-0 shadow-none focus-visible:ring-0 text-sm font-medium h-11 px-2", isViewMode && "bg-transparent cursor-default")}
              />
            </div>

            {/* Body */}
            <div className="px-6 pt-4 pb-4">
              <div className="flex items-center gap-2 mb-2">
                <AlignLeft className="h-3.5 w-3.5 text-muted-foreground/50" />
                <span className="text-xs font-semibold text-muted-foreground">Body</span>
              </div>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                readOnly={isViewMode}
                placeholder="Write your email message here..."
                autoComplete="nope-body-xz9"
                className={cn(
                  "w-full min-h-[180px] text-sm leading-relaxed bg-transparent border border-border/40 rounded-lg px-4 py-3 focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/40",
                  isViewMode ? "resize-none cursor-default border-transparent" : "resize-y"
                )}
              />
            </div>

            {/* Attachments */}
            {fileAttachments.length > 0 && (
              <div className="px-6 py-3 bg-muted/10">
                <div className="flex items-center gap-2 mb-2.5">
                  <Paperclip className="h-3.5 w-3.5 text-muted-foreground/50" />
                  <span className="text-xs font-semibold text-muted-foreground">
                    Attachments ({fileAttachments.length})
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {fileAttachments.map((file) => (
                    <div
                      key={file.id}
                      className="group flex items-center gap-2 bg-background border border-border/50 rounded-lg px-2.5 py-1.5 text-xs hover:border-border transition-colors"
                    >
                      {getSmallFileIcon(file.mimeType)}
                      <span className="font-medium truncate max-w-[160px]">{file.name}</span>
                      {file.size && parseInt(file.size) > 0 && (
                        <span className="text-[9px] text-muted-foreground/50 tabular-nums">
                          {formatSize(file.size)}
                        </span>
                      )}
                      {!isViewMode && (
                        <button
                          type="button"
                          onClick={() => removeAttachment(file.id)}
                          className="h-4 w-4 rounded flex items-center justify-center text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 transition-all opacity-0 group-hover:opacity-100 -mr-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </form>

      </DialogContent>
    </Dialog>
  );
}
