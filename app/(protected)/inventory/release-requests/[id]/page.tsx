"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ArrowLeft,
  Download,
  Mail,
  Send,
  FileText,
  Package,
  Truck,
  MapPin,
  Calendar,
  User,
  Building,
  Clock,
  Hash,
  CheckCircle,
  XCircle,
  Loader2,
  Paperclip,
} from "lucide-react";
import { format } from "date-fns";

interface ReleaseRequestDetail {
  _id: string;
  poNo: string;
  date: string;
  warehouse: { _id: string; name: string } | null;
  requestedBy: { _id: string; name: string; email: string } | null;
  customer: { _id: string; name: string; location?: any[] } | null;
  contact: string;
  releaseOrderProducts: {
    product: { _id: string; name: string; vbId?: string } | null;
    qty: number;
    lotSerial: string;
  }[];
  hasPickupInfo?: boolean;
  carrier: string;
  requestedPickupTime?: string;
  scheduledPickupDate?: string;
  scheduledPickupTime?: string;
  instructions?: string;
  createdBy: string;
  createdAt: string;
}

interface EmailRecord {
  _id: string;
  vbpoNo: string;
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  body: string;
  attachments: { fileId: string; name: string; mimeType: string; size: string }[];
  status: "sent" | "failed";
  error?: string;
  sentAt: string;
}

export default function ReleaseRequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [data, setData] = useState<ReleaseRequestDetail | null>(null);
  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [emailsLoading, setEmailsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("details");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailForm, setEmailForm] = useState({ to: "", cc: "", subject: "", body: "" });

  useEffect(() => {
    fetchData();
  }, [id]);

  useEffect(() => {
    if (activeTab === "emails" && data?.poNo) {
      fetchEmails();
    }
  }, [activeTab, data?.poNo]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/release-requests/${id}`);
      if (!res.ok) throw new Error("Not found");
      const json = await res.json();
      setData(json);
    } catch (err) {
      toast.error("Failed to load release request");
      router.push("/inventory/release-requests");
    } finally {
      setLoading(false);
    }
  };

  const fetchEmails = async () => {
    if (!data?.poNo) return;
    try {
      setEmailsLoading(true);
      const res = await fetch(`/api/admin/emails?vbpoNo=${encodeURIComponent(data.poNo)}`);
      if (res.ok) {
        const json = await res.json();
        setEmails(json.emails || []);
      }
    } catch (err) {
      console.error("Failed to fetch emails:", err);
    } finally {
      setEmailsLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!data) return;
    setPdfLoading(true);
    try {
      // Generate PDF client-side using the DOM
      const printContent = generatePDFHTML(data);
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 500);
      }
    } catch (err) {
      toast.error("Failed to generate PDF");
    } finally {
      setPdfLoading(false);
    }
  };

  const handleSendEmailDialog = () => {
    if (!data) return;
    setEmailForm({
      to: "",
      cc: "",
      subject: `Release Request - PO# ${data.poNo} - ${data.customer?.name || ""}`,
      body: generateEmailBody(data),
    });
    setEmailDialogOpen(true);
  };

  const handleSendEmail = async () => {
    if (!emailForm.to.trim()) {
      toast.error("Please enter a recipient email");
      return;
    }
    setSendingEmail(true);
    try {
      const res = await fetch("/api/admin/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: emailForm.to,
          cc: emailForm.cc,
          subject: emailForm.subject,
          body: emailForm.body,
          vbpoNo: data?.poNo,
          fileIds: [],
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Email sent successfully!");
      setEmailDialogOpen(false);
      // Refresh emails if on that tab
      if (activeTab === "emails") fetchEmails();
    } catch (err) {
      toast.error("Failed to send email");
    } finally {
      setSendingEmail(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading release request...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="h-full flex flex-col gap-0 -m-[16px]">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-background/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/inventory/release-requests")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="h-6 w-px bg-border" />
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Release Request
              <Badge variant="outline" className="text-xs font-mono ml-1">
                PO# {data.poNo}
              </Badge>
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Created by {data.createdBy} on {data.createdAt ? format(new Date(data.createdAt), "MMM dd, yyyy 'at' hh:mm a") : "-"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadPDF}
            disabled={pdfLoading}
            className="gap-2"
          >
            {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download PDF
          </Button>
          <Button
            size="sm"
            onClick={handleSendEmailDialog}
            className="gap-2 bg-primary"
          >
            <Mail className="h-4 w-4" />
            Send as Email
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <div className="px-6 pt-4">
            <TabsList className="grid w-full max-w-sm grid-cols-2">
              <TabsTrigger value="details" className="gap-2">
                <FileText className="h-4 w-4" />
                Details
              </TabsTrigger>
              <TabsTrigger value="emails" className="gap-2">
                <Mail className="h-4 w-4" />
                Emails
                {emails.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                    {emails.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Details Tab */}
          <TabsContent value="details" className="flex-1 overflow-auto px-6 py-4">
            <div className="max-w-5xl space-y-6">
              {/* General Information Card */}
              <div className="border rounded-xl bg-card shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-muted/40 border-b">
                  <h3 className="font-semibold text-sm flex items-center gap-2 text-foreground">
                    <Hash className="w-4 h-4 text-primary" />
                    General Information
                  </h3>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-y-5 gap-x-8">
                    <DetailField icon={<Calendar className="h-4 w-4 text-blue-500" />} label="Date" value={data.date ? format(new Date(data.date), "MMM dd, yyyy") : "-"} />
                    <DetailField icon={<Building className="h-4 w-4 text-purple-500" />} label="Warehouse" value={data.warehouse?.name || "-"} />
                    <DetailField icon={<User className="h-4 w-4 text-green-500" />} label="Requested By" value={data.requestedBy?.name || "-"} />
                    <DetailField icon={<Building className="h-4 w-4 text-orange-500" />} label="Customer" value={data.customer?.name || "-"} />
                    <DetailField icon={<MapPin className="h-4 w-4 text-red-500" />} label="Contact / Location" value={data.contact || "-"} />
                    <DetailField icon={<Hash className="h-4 w-4 text-indigo-500" />} label="Customer PO #" value={data.poNo || "-"} highlight />
                  </div>
                </div>
              </div>

              {/* Order Details Card */}
              <div className="border rounded-xl bg-card shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-muted/40 border-b">
                  <h3 className="font-semibold text-sm flex items-center gap-2 text-foreground">
                    <Package className="w-4 h-4 text-primary" />
                    Order Details
                    <Badge variant="secondary" className="ml-auto text-xs">{data.releaseOrderProducts?.length || 0} items</Badge>
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/20">
                        <th className="p-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider">Product</th>
                        <th className="p-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider">Release Qty</th>
                        <th className="p-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider">Lot / Serial #</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data.releaseOrderProducts?.map((item, idx) => (
                        <tr key={idx} className="hover:bg-muted/30 transition-colors">
                          <td className="p-3 font-medium">{typeof item.product === "object" ? item.product?.name : item.product || "-"}</td>
                          <td className="p-3">
                            <Badge variant="outline" className="font-mono">{item.qty}</Badge>
                          </td>
                          <td className="p-3 text-muted-foreground font-mono text-xs">{item.lotSerial || "-"}</td>
                        </tr>
                      ))}
                      {(!data.releaseOrderProducts || data.releaseOrderProducts.length === 0) && (
                        <tr>
                          <td colSpan={3} className="p-6 text-center text-muted-foreground text-sm">No products in this release request</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pickup & Instructions Card */}
              {data.hasPickupInfo && (
                <div className="border rounded-xl bg-card shadow-sm overflow-hidden">
                  <div className="px-5 py-3 bg-muted/40 border-b">
                    <h3 className="font-semibold text-sm flex items-center gap-2 text-foreground">
                      <Truck className="w-4 h-4 text-primary" />
                      Pickup Information & Instructions
                    </h3>
                  </div>
                  <div className="p-5 space-y-5">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-y-5 gap-x-8">
                      <DetailField icon={<Truck className="h-4 w-4 text-sky-500" />} label="Carrier" value={data.carrier || "-"} />
                      <DetailField icon={<Clock className="h-4 w-4 text-amber-500" />} label="Requested Date/Time" value={data.requestedPickupTime ? format(new Date(data.requestedPickupTime), "MMM dd, yyyy, hh:mm a") : "-"} />
                      <DetailField icon={<Calendar className="h-4 w-4 text-emerald-500" />} label="Confirmed Date" value={data.scheduledPickupDate ? format(new Date(data.scheduledPickupDate), "MMM dd, yyyy") : "-"} />
                      <DetailField icon={<Clock className="h-4 w-4 text-violet-500" />} label="Confirmed Time" value={data.scheduledPickupTime || "-"} />
                    </div>

                    {data.instructions && (
                      <>
                        <div className="border-t pt-4">
                          <div className="flex items-center gap-2 mb-2">
                            <MapPin className="h-4 w-4 text-rose-500" />
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Instructions</span>
                          </div>
                          <div className="bg-muted/30 rounded-lg p-4 text-sm whitespace-pre-wrap leading-relaxed">
                            {data.instructions}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Show instructions standalone if no pickup info but has instructions */}
              {!data.hasPickupInfo && data.instructions && (
                <div className="border rounded-xl bg-card shadow-sm overflow-hidden">
                  <div className="px-5 py-3 bg-muted/40 border-b">
                    <h3 className="font-semibold text-sm flex items-center gap-2 text-foreground">
                      <MapPin className="w-4 h-4 text-primary" />
                      Instructions
                    </h3>
                  </div>
                  <div className="p-5">
                    <div className="bg-muted/30 rounded-lg p-4 text-sm whitespace-pre-wrap leading-relaxed">
                      {data.instructions}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Emails Tab */}
          <TabsContent value="emails" className="flex-1 overflow-auto px-6 py-4">
            <div className="max-w-5xl space-y-4">
              {emailsLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading emails...</span>
                </div>
              ) : emails.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Mail className="h-12 w-12 mb-3 opacity-30" />
                  <p className="text-sm font-medium">No emails found</p>
                  <p className="text-xs mt-1">Emails sent for PO# {data.poNo} will appear here</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 gap-2"
                    onClick={handleSendEmailDialog}
                  >
                    <Send className="h-4 w-4" />
                    Send First Email
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {emails.map((email) => (
                    <div
                      key={email._id}
                      className="border rounded-xl bg-card shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                    >
                      <div className="px-5 py-3 border-b bg-muted/20 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                            email.status === "sent" ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                          }`}>
                            {email.status === "sent" ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                          </div>
                          <div>
                            <p className="text-sm font-semibold">{email.subject}</p>
                            <p className="text-xs text-muted-foreground">
                              {email.sentAt ? format(new Date(email.sentAt), "MMM dd, yyyy 'at' hh:mm a") : "-"}
                            </p>
                          </div>
                        </div>
                        <Badge variant={email.status === "sent" ? "default" : "destructive"} className="text-[10px] uppercase">
                          {email.status}
                        </Badge>
                      </div>

                      <div className="p-5 space-y-3 text-sm">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">From</span>
                            <p className="text-sm mt-0.5 truncate">{email.from || "-"}</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">To</span>
                            <p className="text-sm mt-0.5 truncate">{email.to?.join(", ") || "-"}</p>
                          </div>
                          {email.cc && email.cc.length > 0 && (
                            <div className="md:col-span-2">
                              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">CC</span>
                              <p className="text-sm mt-0.5 truncate">{email.cc.join(", ")}</p>
                            </div>
                          )}
                        </div>

                        {email.body && (
                          <div className="border-t pt-3">
                            <div className="bg-muted/20 rounded-lg p-3 text-sm whitespace-pre-wrap max-h-40 overflow-auto leading-relaxed">
                              {email.body}
                            </div>
                          </div>
                        )}

                        {email.attachments && email.attachments.length > 0 && (
                          <div className="border-t pt-3">
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                              <Paperclip className="h-3 w-3" />
                              Attachments ({email.attachments.length})
                            </span>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {email.attachments.map((att, i) => (
                                <Badge key={i} variant="outline" className="text-xs gap-1 py-1">
                                  <FileText className="h-3 w-3" />
                                  {att.name}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {email.error && (
                          <div className="border-t pt-3">
                            <p className="text-xs text-red-500">Error: {email.error}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Send Email Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Send Release Request as Email
            </DialogTitle>
            <DialogDescription>
              Send the release request details for PO# {data.poNo} via email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>To <span className="text-red-500">*</span></Label>
              <Input
                value={emailForm.to}
                onChange={(e) => setEmailForm({ ...emailForm, to: e.target.value })}
                placeholder="recipient@email.com (comma-separated for multiple)"
              />
            </div>
            <div className="space-y-2">
              <Label>CC</Label>
              <Input
                value={emailForm.cc}
                onChange={(e) => setEmailForm({ ...emailForm, cc: e.target.value })}
                placeholder="cc@email.com (optional)"
              />
            </div>
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input
                value={emailForm.subject}
                onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Body</Label>
              <Textarea
                value={emailForm.body}
                onChange={(e) => setEmailForm({ ...emailForm, body: e.target.value })}
                className="min-h-[200px] font-mono text-xs"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSendEmail} disabled={sendingEmail} className="gap-2">
                {sendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {sendingEmail ? "Sending..." : "Send Email"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Sub-component for detail fields
function DetailField({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-sm font-medium ${highlight ? "text-primary font-semibold" : ""}`}>{value}</p>
    </div>
  );
}

// Generate printable HTML for PDF
function generatePDFHTML(data: ReleaseRequestDetail): string {
  const productsRows = data.releaseOrderProducts?.map((p) => `
    <tr>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${typeof p.product === "object" ? p.product?.name : p.product || "-"}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${p.qty}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${p.lotSerial || "-"}</td>
    </tr>
  `).join("") || "";

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Release Request - PO# ${data.poNo}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1f2937; padding: 40px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 2px solid #3b82f6; }
        .header h1 { font-size: 22px; color: #1f2937; }
        .header .po { font-size: 14px; background: #eff6ff; color: #3b82f6; padding: 4px 10px; border-radius: 4px; font-weight: 600; }
        .header .meta { font-size: 11px; color: #6b7280; margin-top: 4px; }
        .section { margin-bottom: 28px; }
        .section-title { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid #e5e7eb; }
        .field-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 18px; }
        .field label { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #9ca3af; margin-bottom: 2px; }
        .field p { font-size: 13px; font-weight: 500; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        thead th { background: #f9fafb; padding: 8px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; border-bottom: 2px solid #e5e7eb; }
        .instructions-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 14px; font-size: 13px; white-space: pre-wrap; line-height: 1.6; }
        @media print { body { padding: 20px; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1>Release Request</h1>
          <p class="meta">Created by ${data.createdBy} on ${data.createdAt ? format(new Date(data.createdAt), "MMM dd, yyyy") : "-"}</p>
        </div>
        <span class="po">PO# ${data.poNo}</span>
      </div>

      <div class="section">
        <div class="section-title">General Information</div>
        <div class="field-grid">
          <div class="field"><label>Date</label><p>${data.date ? format(new Date(data.date), "MMM dd, yyyy") : "-"}</p></div>
          <div class="field"><label>Warehouse</label><p>${data.warehouse?.name || "-"}</p></div>
          <div class="field"><label>Requested By</label><p>${data.requestedBy?.name || "-"}</p></div>
          <div class="field"><label>Customer</label><p>${data.customer?.name || "-"}</p></div>
          <div class="field"><label>Contact / Location</label><p>${data.contact || "-"}</p></div>
          <div class="field"><label>Customer PO #</label><p>${data.poNo || "-"}</p></div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Order Details</div>
        <table>
          <thead><tr><th>Product</th><th style="text-align:center;">Release Qty</th><th>Lot / Serial #</th></tr></thead>
          <tbody>${productsRows || '<tr><td colspan="3" style="padding: 16px; text-align: center; color: #9ca3af;">No products</td></tr>'}</tbody>
        </table>
      </div>

      ${data.hasPickupInfo ? `
      <div class="section">
        <div class="section-title">Pickup Information</div>
        <div class="field-grid" style="grid-template-columns: 1fr 1fr 1fr 1fr;">
          <div class="field"><label>Carrier</label><p>${data.carrier || "-"}</p></div>
          <div class="field"><label>Requested Date/Time</label><p>${data.requestedPickupTime ? format(new Date(data.requestedPickupTime), "MMM dd, yyyy, hh:mm a") : "-"}</p></div>
          <div class="field"><label>Confirmed Date</label><p>${data.scheduledPickupDate ? format(new Date(data.scheduledPickupDate), "MMM dd, yyyy") : "-"}</p></div>
          <div class="field"><label>Confirmed Time</label><p>${data.scheduledPickupTime || "-"}</p></div>
        </div>
      </div>
      ` : ""}

      ${data.instructions ? `
      <div class="section">
        <div class="section-title">Instructions</div>
        <div class="instructions-box">${data.instructions}</div>
      </div>
      ` : ""}
    </body>
    </html>
  `;
}

// Generate plain-text email body from release request data
function generateEmailBody(data: ReleaseRequestDetail): string {
  const products = data.releaseOrderProducts?.map((p, i) => {
    const name = typeof p.product === "object" ? p.product?.name : p.product || "-";
    return `  ${i + 1}. ${name} - Qty: ${p.qty} - Lot/Serial: ${p.lotSerial || "N/A"}`;
  }).join("\n") || "  (No products)";

  let body = `Release Request Details\n`;
  body += `========================\n\n`;
  body += `PO#: ${data.poNo}\n`;
  body += `Date: ${data.date ? format(new Date(data.date), "MMM dd, yyyy") : "-"}\n`;
  body += `Customer: ${data.customer?.name || "-"}\n`;
  body += `Warehouse: ${data.warehouse?.name || "-"}\n`;
  body += `Contact/Location: ${data.contact || "-"}\n`;
  body += `Requested By: ${data.requestedBy?.name || "-"}\n\n`;
  body += `Products:\n${products}\n`;

  if (data.hasPickupInfo) {
    body += `\nPickup Information:\n`;
    body += `  Carrier: ${data.carrier || "-"}\n`;
    body += `  Requested: ${data.requestedPickupTime ? format(new Date(data.requestedPickupTime), "MMM dd, yyyy, hh:mm a") : "-"}\n`;
    body += `  Confirmed Date: ${data.scheduledPickupDate ? format(new Date(data.scheduledPickupDate), "MMM dd, yyyy") : "-"}\n`;
    body += `  Confirmed Time: ${data.scheduledPickupTime || "-"}\n`;
  }

  if (data.instructions) {
    body += `\nInstructions:\n${data.instructions}\n`;
  }

  return body;
}
