"use client";

import { useEffect, useState } from "react";
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
  Mail,
  Send,
  FileText,
  MapPin,
  User,
  Building,
  Phone,
  Star,
  CheckCircle,
  XCircle,
  Loader2,
  Paperclip,
  Warehouse as WarehouseIcon,
  CircleDot,
} from "lucide-react";
import { format } from "date-fns";

interface WarehouseContact {
  name: string;
  email?: string;
  phone?: string;
  isActive: boolean;
  isPrimary: boolean;
}

interface WarehouseDetail {
  _id: string;
  name: string;
  address: string;
  contacts: WarehouseContact[];
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

export default function WarehouseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [data, setData] = useState<WarehouseDetail | null>(null);
  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [emailsLoading, setEmailsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("details");
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailForm, setEmailForm] = useState({ to: "", cc: "", subject: "", body: "" });

  useEffect(() => {
    fetchData();
  }, [id]);

  useEffect(() => {
    if (activeTab === "emails" && data?.name) {
      fetchEmails();
    }
  }, [activeTab, data?.name]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/warehouse/${id}`);
      if (!res.ok) throw new Error("Not found");
      const json = await res.json();
      setData(json);
    } catch (err) {
      toast.error("Failed to load warehouse");
      router.push("/inventory/warehouse");
    } finally {
      setLoading(false);
    }
  };

  const fetchEmails = async () => {
    if (!data?.name) return;
    try {
      setEmailsLoading(true);
      // Use warehouse name as email key (vbpoNo)
      const res = await fetch(`/api/admin/emails?vbpoNo=${encodeURIComponent(`WH-${data.name}`)}`);
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

  const handleSendEmailDialog = () => {
    if (!data) return;
    // Pre-fill TO with primary contact email if available
    const primaryContact = data.contacts?.find(c => c.isPrimary && c.isActive);
    const activeContacts = data.contacts?.filter(c => c.isActive && c.email) || [];
    const toField = primaryContact?.email || "";
    const ccField = activeContacts
      .filter(c => c.email && c.email !== toField)
      .map(c => c.email)
      .join(", ");

    setEmailForm({
      to: toField,
      cc: ccField,
      subject: `Warehouse Communication - ${data.name}`,
      body: `Hello,\n\nRegarding warehouse: ${data.name}\nAddress: ${data.address || "N/A"}\n\n`,
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
          vbpoNo: `WH-${data?.name}`,
          fileIds: [],
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Email sent successfully!");
      setEmailDialogOpen(false);
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
          <p className="text-sm text-muted-foreground">Loading warehouse...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const primaryContact = data.contacts?.find(c => c.isPrimary);
  const activeContacts = data.contacts?.filter(c => c.isActive) || [];
  const inactiveContacts = data.contacts?.filter(c => !c.isActive) || [];

  return (
    <div className="h-full flex flex-col gap-0 -m-[16px]">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-background/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/inventory/warehouse")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="h-6 w-px bg-border" />
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <WarehouseIcon className="h-5 w-5 text-primary" />
              {data.name}
            </h1>
            {data.address && (
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {data.address}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleSendEmailDialog}
            className="gap-2 bg-primary"
          >
            <Mail className="h-4 w-4" />
            Send Email
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <div className="px-6 pt-6">
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
              {/* Warehouse Information Card */}
              <div className="border rounded-xl bg-card shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-muted/40 border-b">
                  <h3 className="font-semibold text-sm flex items-center gap-2 text-foreground">
                    <Building className="w-4 h-4 text-primary" />
                    Warehouse Information
                  </h3>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-y-5 gap-x-8">
                    <DetailField
                      icon={<WarehouseIcon className="h-4 w-4 text-blue-500" />}
                      label="Name"
                      value={data.name}
                      highlight
                    />
                    <DetailField
                      icon={<MapPin className="h-4 w-4 text-red-500" />}
                      label="Address"
                      value={data.address || "No address set"}
                    />
                  </div>
                </div>
              </div>

              {/* Contacts Card */}
              <div className="border rounded-xl bg-card shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-muted/40 border-b">
                  <h3 className="font-semibold text-sm flex items-center gap-2 text-foreground">
                    <User className="w-4 h-4 text-primary" />
                    Contacts
                    <Badge variant="secondary" className="ml-auto text-xs">
                      {activeContacts.length} active{inactiveContacts.length > 0 ? ` · ${inactiveContacts.length} inactive` : ""}
                    </Badge>
                  </h3>
                </div>

                {data.contacts && data.contacts.length > 0 ? (
                  <div className="divide-y">
                    {data.contacts.map((contact, idx) => (
                      <div
                        key={idx}
                        className={`px-5 py-4 flex items-center justify-between transition-colors ${
                          !contact.isActive ? "opacity-50 bg-muted/10" : "hover:bg-muted/20"
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold ${
                            contact.isPrimary
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                              : "bg-muted text-muted-foreground"
                          }`}>
                            {contact.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold">{contact.name}</p>
                              {contact.isPrimary && (
                                <Badge className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800">
                                  <Star className="h-3 w-3 mr-0.5" /> Primary
                                </Badge>
                              )}
                              {!contact.isActive && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">Inactive</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-4 mt-1">
                              {contact.email && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Mail className="h-3 w-3" /> {contact.email}
                                </span>
                              )}
                              {contact.phone && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Phone className="h-3 w-3" /> {contact.phone}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <CircleDot className={`h-3 w-3 ${contact.isActive ? "text-emerald-500" : "text-zinc-400"}`} />
                          <span className={`text-xs ${contact.isActive ? "text-emerald-600" : "text-zinc-400"}`}>
                            {contact.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-10 text-center text-muted-foreground">
                    <User className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-medium">No contacts added</p>
                    <p className="text-xs mt-1">Add contacts by editing this warehouse</p>
                  </div>
                )}
              </div>
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
                  <p className="text-xs mt-1">Emails sent for {data.name} will appear here</p>
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
              Send Email — {data.name}
            </DialogTitle>
            <DialogDescription>
              Send an email related to this warehouse.
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
