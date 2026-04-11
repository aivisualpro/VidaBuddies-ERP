"use client";

import React, { useEffect, useState, useLayoutEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
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
  ArrowDownToLine,
  ArrowUpFromLine,
  Package,
  Boxes,
} from "lucide-react";
import { format } from "date-fns";
import { useUserDataStore } from "@/store/useUserDataStore";

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

  const [addContactOpen, setAddContactOpen] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [newContact, setNewContact] = useState<WarehouseContact>({
    name: "",
    email: "",
    phone: "",
    isActive: true,
    isPrimary: false,
  });

  const { purchaseOrders, releaseRequests, products: storeProducts } = useUserDataStore();

  const inventoryTransactions = React.useMemo(() => {
    if (!data) return [];
    
    // fast O(1) map for product ID to Name
    const productMap = new Map();
    if (storeProducts && Array.isArray(storeProducts)) {
      storeProducts.forEach(p => {
        if (p._id && p.name) productMap.set(p._id, p.name);
      });
    }

    const transactions: any[] = [];
    
    if (purchaseOrders && Array.isArray(purchaseOrders)) {
      purchaseOrders.forEach(po => {
        if (po.isArchived || (po.orderType !== "Inventory" && po.orderType !== "INVENTORY")) return;
        (po.customerPO || []).forEach((cpo: any) => {
          if (cpo.warehouse === id || cpo.warehouse === data._id || cpo.warehouse === data.name) {
             const pname = productMap.get(cpo.product) || cpo.product || "Unknown Product";
             transactions.push({
               id: `in-${po._id}-${cpo._id || Math.random()}`,
               type: "IN",
               date: po.date || po.createdAt,
               reference: po.vbpoNo || "Unknown PO",
               productName: pname,
               qty: cpo.qtyOrdered || 0,
             });
          }
        });
      });
    }

    if (releaseRequests && Array.isArray(releaseRequests)) {
      releaseRequests.forEach(rr => {
        if (rr.warehouse && (rr.warehouse === id || rr.warehouse._id === id || rr.warehouse === data.name)) {
           (rr.releaseOrderProducts || []).forEach((rop: any) => {
             const pname = rop.productName || productMap.get(rop.product) || productMap.get(rop.product?._id) || "Unknown Product";
             transactions.push({
               id: `out-${rr._id}-${rop._id || Math.random()}`,
               type: "OUT",
               date: rr.date || rr.createdAt,
               reference: rr.poNo || "Unknown RR",
               productName: pname,
               qty: rop.qty || 0,
             });
           });
        }
      });
    }

    return transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data, purchaseOrders, releaseRequests, storeProducts, id]);

  const productBalances = React.useMemo(() => {
    const balances: Record<string, { productName: string; totalIn: number; totalOut: number; netBalance: number }> = {};
    
    inventoryTransactions.forEach(tx => {
       const name = tx.productName;
       if (!balances[name]) {
         balances[name] = { productName: name, totalIn: 0, totalOut: 0, netBalance: 0 };
       }
       if (tx.type === "IN") {
         balances[name].totalIn += Number(tx.qty) || 0;
         balances[name].netBalance += Number(tx.qty) || 0;
       } else {
         balances[name].totalOut += Number(tx.qty) || 0;
         balances[name].netBalance -= Number(tx.qty) || 0;
       }
    });

    return Object.values(balances).sort((a, b) => b.netBalance - a.netBalance);
  }, [inventoryTransactions]);

  useEffect(() => {
    fetchData();
  }, [id]);

  useEffect(() => {
    if (activeTab === "emails" && data?.name) {
      fetchEmails();
    }
  }, [activeTab, data?.name]);

  const { setLeftContent, setActions } = useHeaderActions();

  useLayoutEffect(() => {
    if (!data) return;

    const leftContent = (
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
        </div>
      </div>
    );

    const rightContent = (
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setNewContact({ name: "", email: "", phone: "", isActive: true, isPrimary: false });
            setAddContactOpen(true);
          }}
          className="gap-2"
        >
          <User className="h-4 w-4" />
          Add Contacts
        </Button>
        <Button
          size="sm"
          onClick={handleSendEmailDialog}
          className="gap-2 bg-primary"
        >
          <Mail className="h-4 w-4" />
          Send Email
        </Button>
      </div>
    );

    setLeftContent(leftContent);
    setActions(rightContent);

    const timer = setTimeout(() => {
      setLeftContent(leftContent);
      setActions(rightContent);
    }, 50);

    return () => {
      clearTimeout(timer);
      setLeftContent(null);
      setActions(null);
    };
  }, [data, router, setLeftContent, setActions]);

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

  const handleSaveContact = async () => {
    if (!newContact.name.trim()) {
      toast.error("Contact name is required");
      return;
    }
    if (!data) return;
    
    setSavingContact(true);
    try {
       const updatedContacts = [...(data.contacts || [])];
       if (newContact.isPrimary) {
          updatedContacts.forEach(c => c.isPrimary = false);
       }
       updatedContacts.push(newContact);

       const response = await fetch(`/api/admin/warehouse/${id}`, {
         method: "PUT",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ ...data, contacts: updatedContacts }),
       });
       if (!response.ok) throw new Error("Failed to save contact");
       
       toast.success("Contact added successfully");
       setAddContactOpen(false);
       setNewContact({ name: "", email: "", phone: "", isActive: true, isPrimary: false });
       fetchData(); // Reload the data
    } catch (err) {
       toast.error("Failed to save contact");
    } finally {
       setSavingContact(false);
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


      {/* Tabs */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <div className="px-6 pt-6">
            <TabsList className="grid w-full max-w-2xl grid-cols-4">
              <TabsTrigger value="details" className="gap-2">
                <FileText className="h-4 w-4" />
                Details
              </TabsTrigger>
              <TabsTrigger value="stock" className="gap-2">
                <Boxes className="h-4 w-4" />
                Inventory
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                  {productBalances.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="transactions" className="gap-2">
                <Package className="h-4 w-4" />
                Transactions
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                  {inventoryTransactions.length}
                </Badge>
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

          {/* Transactions Tab */}
          <TabsContent value="transactions" className="flex-1 overflow-auto px-6 py-4">
            <div className="max-w-5xl space-y-6">
              <div className="border rounded-xl bg-card shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-muted/40 border-b flex items-center justify-between">
                  <h3 className="font-semibold text-sm flex items-center gap-2 text-foreground">
                    <Package className="w-4 h-4 text-primary" />
                    Transactions
                  </h3>
                </div>
                {inventoryTransactions.length === 0 ? (
                  <div className="p-10 text-center text-muted-foreground">
                    <Package className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-medium">No transactions found</p>
                    <p className="text-xs mt-1">Incoming inventory and release requests will appear here</p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead className="bg-muted/20 text-xs uppercase text-muted-foreground font-semibold">
                      <tr>
                         <th className="px-5 py-3">Type</th>
                         <th className="px-5 py-3">Date</th>
                         <th className="px-5 py-3">Reference #</th>
                         <th className="px-5 py-3">Product</th>
                         <th className="px-5 py-3 text-right">Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-sm">
                      {inventoryTransactions.map(tx => (
                        <tr key={tx.id} className="hover:bg-muted/10 transition-colors">
                          <td className="px-5 py-3">
                            {tx.type === "IN" ? (
                               <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0 flex w-fit items-center gap-1 text-[10px]">
                                 <ArrowDownToLine className="h-3 w-3" /> IN
                               </Badge>
                            ) : (
                               <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-0 flex w-fit items-center gap-1 text-[10px]">
                                 <ArrowUpFromLine className="h-3 w-3" /> OUT
                               </Badge>
                            )}
                          </td>
                          <td className="px-5 py-3 font-medium">
                            {tx.date ? format(new Date(tx.date), "MMM dd, yyyy") : "-"}
                          </td>
                          <td className="px-5 py-3 text-muted-foreground font-mono">
                            {tx.reference}
                          </td>
                          <td className="px-5 py-3 text-muted-foreground truncate max-w-[200px]" title={tx.productName}>
                            {tx.productName}
                          </td>
                          <td className="px-5 py-3 text-right font-bold text-foreground">
                            {tx.type === "IN" ? "+" : "-"}{tx.qty}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Stock Balance Tab */}
          <TabsContent value="stock" className="flex-1 overflow-auto px-6 py-4">
            <div className="max-w-5xl space-y-6">
              <div className="border rounded-xl bg-card shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-muted/40 border-b flex items-center justify-between">
                  <h3 className="font-semibold text-sm flex items-center gap-2 text-foreground">
                    <Boxes className="w-4 h-4 text-primary" />
                    Inventory
                  </h3>
                </div>
                {productBalances.length === 0 ? (
                  <div className="p-10 text-center text-muted-foreground">
                    <Boxes className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-medium">No stock available</p>
                    <p className="text-xs mt-1">Stock balances will appear here when transactions exist</p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead className="bg-muted/20 text-xs uppercase text-muted-foreground font-semibold">
                      <tr>
                         <th className="px-5 py-3">Product Name</th>
                         <th className="px-5 py-3 text-right">Total In</th>
                         <th className="px-5 py-3 text-right">Total Out</th>
                         <th className="px-5 py-3 text-right text-primary">Net Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-sm">
                      {productBalances.map((item, i) => (
                        <tr key={i} className="hover:bg-muted/10 transition-colors">
                          <td className="px-5 py-3 font-medium truncate max-w-[300px]" title={item.productName}>
                            {item.productName}
                          </td>
                          <td className="px-5 py-3 text-right text-emerald-600 font-mono">
                            {item.totalIn > 0 ? `+${item.totalIn}` : 0}
                          </td>
                          <td className="px-5 py-3 text-right text-amber-600 font-mono">
                            {item.totalOut > 0 ? `-${item.totalOut}` : 0}
                          </td>
                          <td className="px-5 py-3 text-right font-bold text-base">
                            <span className={item.netBalance > 0 ? "text-emerald-600" : item.netBalance < 0 ? "text-red-500" : "text-muted-foreground"}>
                              {item.netBalance}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
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

      {/* Add Contact Dialog */}
      <Dialog open={addContactOpen} onOpenChange={setAddContactOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Contact</DialogTitle>
            <DialogDescription>
              Add a new contact to {data.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Name <span className="text-red-500">*</span></Label>
              <Input
                value={newContact.name}
                onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                placeholder="Jane Doe"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={newContact.email}
                  onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                  placeholder="jane@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={newContact.phone}
                  onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                  placeholder="(555) 555-5555"
                />
              </div>
            </div>
            <div className="flex items-center gap-6 pt-2">
              <div className="flex items-center gap-2">
                <Switch
                  id="new-contact-active"
                  checked={newContact.isActive}
                  onCheckedChange={(val) => setNewContact({ ...newContact, isActive: val })}
                />
                <Label htmlFor="new-contact-active">Active</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="new-contact-primary"
                  checked={newContact.isPrimary}
                  onCheckedChange={(val) => setNewContact({ ...newContact, isPrimary: val })}
                />
                <Label htmlFor="new-contact-primary">Primary</Label>
              </div>
            </div>
            <DialogFooter className="pt-2 border-t mt-4">
              <Button variant="outline" onClick={() => setAddContactOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveContact} disabled={savingContact}>
                {savingContact ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Contact
              </Button>
            </DialogFooter>
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
