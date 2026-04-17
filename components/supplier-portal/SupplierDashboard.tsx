"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import {
  FileText, AlertTriangle, CheckCircle, Clock, Save, Eye, EyeOff,
  RefreshCw, X, Plus, Lock, Building2, User, Mail, Phone, Globe, Package, Leaf, ArrowLeft, MapPin, Edit2
} from "lucide-react";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import { useEffect, useState, useRef } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

function generatePassword(length = 16): string {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const symbols = '!@#$%&*_+-=?';
  const all = upper + lower + digits + symbols;
  let pw = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    symbols[Math.floor(Math.random() * symbols.length)],
  ];
  for (let i = pw.length; i < length; i++) {
    pw.push(all[Math.floor(Math.random() * all.length)]);
  }
  // shuffle
  for (let i = pw.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pw[i], pw[j]] = [pw[j], pw[i]];
  }
  return pw.join('');
}

export type WebContactPhone = { number: string; ext?: string };
export type WebSupplierContact = { _id?: string; name: string; designation: string; emails: string[]; phones: WebContactPhone[]; address: string; };

interface SupplierProfile {
  name: string;
  portalEmail: string;
  portalPassword: string;
  manufacturingAddress: string;
  country: string;
  primaryContactName: string;
  communicationEmail: string;
  phone: string;
  productsSupplied: string[];
  contacts: WebSupplierContact[];
}

export function SupplierDashboard({ supplierId, isSupplierView = false }: { supplierId: string, isSupplierView?: boolean }) {
  const { setLeftContent, setRightContent } = useHeaderActions();
  const router = useRouter();
  const [supplierName, setSupplierName] = useState<string>("");
  const [isOrganic, setIsOrganic] = useState(false);
  const [metrics, setMetrics] = useState({
    total: 40,
    completed: 0,
    missing: 40,
    completionPercentage: 0,
    status: "MISSING DOCUMENTS",
  });

  const [profile, setProfile] = useState<SupplierProfile>({
    name: '', portalEmail: '', portalPassword: '', manufacturingAddress: '',
    country: '', primaryContactName: '', communicationEmail: '', phone: '', productsSupplied: [], contacts: []
  });
  const [originalProfile, setOriginalProfile] = useState<SupplierProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [systemProducts, setSystemProducts] = useState<any[]>([]);
  const [isProductPopoverOpen, setIsProductPopoverOpen] = useState(false);
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [editingContactIndex, setEditingContactIndex] = useState<number | null>(null);
  const [contactForm, setContactForm] = useState<WebSupplierContact>({
    name: '', designation: '', emails: [''], phones: [{ number: '', ext: '' }], address: ''
  });

  useEffect(() => {
    const fetchSupplier = async () => {
      try {
        const response = await fetch(`/api/admin/suppliers/${supplierId}`);
        if (response.ok) {
          const data = await response.json();
          setSupplierName(data.name || "");
          setIsOrganic(!!data.isOrganic);

          const p: SupplierProfile = {
            name: data.name || '',
            portalEmail: data.portalEmail || '',
            portalPassword: data.portalPassword || '',
            manufacturingAddress: data.manufacturingAddress || '',
            country: data.country || '',
            primaryContactName: data.primaryContactName || '',
            communicationEmail: data.communicationEmail || '',
            phone: data.phone || '',
            productsSupplied: data.productsSupplied || [],
            contacts: data.contacts || [],
          };
          setProfile(p);
          setOriginalProfile(JSON.parse(JSON.stringify(p)));

          let comp = 0;
          if (data.documents) {
            data.documents.forEach((d: any) => {
              if (d.fileId) comp++;
            });
          }
          const miss = 40 - comp;
          setMetrics({
            total: 40,
            completed: comp,
            missing: miss,
            completionPercentage: Math.round((comp / 40) * 100),
            status: miss > 0 ? "MISSING DOCUMENTS" : "COMPLIANT"
          });
        }
      } catch (error) {
        console.error("Failed to fetch supplier details:", error);
      }
    };
    const fetchProducts = async () => {
      try {
        const res = await fetch('/api/admin/products');
        if (res.ok) setSystemProducts(await res.json());
      } catch (e) { }
    };
    fetchSupplier();
    fetchProducts();
  }, [supplierId]);

  useEffect(() => {
    if (supplierName) {
      setLeftContent(
        <h1 className="text-xl font-black tracking-tight uppercase bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent flex items-center gap-2">
          <span className="hidden md:inline">{supplierName} <span className="text-primary/40">/</span></span> <span className="text-primary/40 md:text-primary/40">DASHBOARD</span>
          {isOrganic && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 ml-2">
              <Image src="/organic certified.png" alt="Organic Certified" width={18} height={18} className="rounded-full" />
              <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Organic</span>
            </div>
          )}
        </h1>
      );

      if (!isSupplierView) {
        setRightContent(null);
      }
    }
    return () => {
      setLeftContent(null);
      setRightContent(null);
    };
  }, [supplierName, setLeftContent, setRightContent, isOrganic, isSupplierView, supplierId, router]);

  const isDirty = originalProfile && JSON.stringify(profile) !== JSON.stringify(originalProfile);

  const saveProfile = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/suppliers/${supplierId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profile.name,
          manufacturingAddress: profile.manufacturingAddress,
          country: profile.country,
          primaryContactName: profile.primaryContactName,
          communicationEmail: profile.communicationEmail,
          phone: profile.phone,
          productsSupplied: profile.productsSupplied,
          contacts: profile.contacts,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSupplierName(updated.name);
        setOriginalProfile(JSON.parse(JSON.stringify(profile)));
        toast.success("Profile updated successfully!");
      } else {
        toast.error("Failed to save profile.");
      }
    } catch {
      toast.error("Error saving profile.");
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/suppliers/${supplierId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portalPassword: newPassword }),
      });
      if (res.ok) {
        setProfile(p => ({ ...p, portalPassword: newPassword }));
        setOriginalProfile(p => p ? { ...p, portalPassword: newPassword } : p);
        setIsChangingPassword(false);
        setNewPassword('');
        toast.success("Password changed successfully!");
      }
    } catch {
      toast.error("Failed to change password.");
    } finally {
      setSaving(false);
    }
  };

  const saveContactsData = async (newContacts: WebSupplierContact[]) => {
    try {
      await fetch(`/api/admin/suppliers/${supplierId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts: newContacts }),
      });
      setOriginalProfile(prev => prev ? { ...prev, contacts: newContacts } : prev);
      toast.success("Contacts updated!");
    } catch {
      toast.error("Error updating contacts.");
    }
  };

  const submitContact = () => {
    if (!contactForm.name) return toast.error("Contact name is required");
    const cleanedEmails = contactForm.emails.filter(e => e.trim());
    const cleanedPhones = contactForm.phones.filter(p => p.number.trim());
    const newContact = { ...contactForm, emails: cleanedEmails, phones: cleanedPhones };

    let newContacts = [...profile.contacts];
    if (editingContactIndex !== null && editingContactIndex >= 0) {
      newContacts[editingContactIndex] = newContact;
    } else {
      newContacts.push(newContact);
    }
    setProfile(p => ({ ...p, contacts: newContacts }));
    saveContactsData(newContacts);
    setIsContactDialogOpen(false);
  };

  const removeContact = (index: number) => {
    const newContacts = profile.contacts.filter((_, i) => i !== index);
    setProfile(p => ({ ...p, contacts: newContacts }));
    saveContactsData(newContacts);
  };

  const openAddContact = () => {
    setEditingContactIndex(null);
    setContactForm({ name: '', designation: '', emails: [''], phones: [{ number: '', ext: '' }], address: '' });
    setIsContactDialogOpen(true);
  };

  const openEditContact = (index: number) => {
    setEditingContactIndex(index);
    const c = profile.contacts[index];
    setContactForm({
      ...c,
      emails: c.emails.length > 0 ? c.emails : [''],
      phones: c.phones.length > 0 ? c.phones : [{ number: '', ext: '' }]
    });
    setIsContactDialogOpen(true);
  };

  const saveProducts = async (newProducts: string[]) => {
    try {
      await fetch(`/api/admin/suppliers/${supplierId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productsSupplied: newProducts }),
      });
      setOriginalProfile(prev => prev ? { ...prev, productsSupplied: newProducts } : prev);
      toast.success("Products updated!");
    } catch {
      toast.error("Error updating products.");
    }
  };

  const toggleProduct = (productName: string) => {
    setProfile(prev => {
      const isSelected = prev.productsSupplied.includes(productName);
      let newProducts;
      if (isSelected) {
        newProducts = prev.productsSupplied.filter(p => p !== productName);
      } else {
        newProducts = [...prev.productsSupplied, productName];
      }
      saveProducts(newProducts);
      return { ...prev, productsSupplied: newProducts };
    });
  };

  const removeProduct = (product: string) => {
    setProfile(p => {
      const newProducts = p.productsSupplied.filter(x => x !== product);
      saveProducts(newProducts);
      return { ...p, productsSupplied: newProducts };
    });
  };

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card">
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Total</span>
              <FileText className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="text-2xl md:text-3xl font-black">{metrics.total}</div>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Completed</span>
              <CheckCircle className="h-3.5 w-3.5 text-green-500" />
            </div>
            <div className="text-2xl md:text-3xl font-black text-green-500">{metrics.completed}</div>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Missing</span>
              <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
            </div>
            <div className="text-2xl md:text-3xl font-black text-orange-500">{metrics.missing}</div>
          </CardContent>
        </Card>
        <Card className={`bg-card ${isOrganic ? 'border-emerald-200 dark:border-emerald-800' : ''}`}>
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                {isOrganic ? 'Organic' : 'Status'}
              </span>
              {isOrganic ? (
                <Image src="/organic certified.png" alt="Organic" width={16} height={16} className="rounded-full" />
              ) : (
                <Clock className="h-3.5 w-3.5 text-primary" />
              )}
            </div>
            <div className="text-sm md:text-lg font-black tracking-tight mt-1">
              {isOrganic ? (
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <Leaf className="h-4 w-4" /> CERTIFIED
                </span>
              ) : metrics.missing > 0 ? (
                <span className="text-orange-500 flex items-center gap-1.5">⚠️ {metrics.status}</span>
              ) : (
                <span className="text-green-500 flex items-center gap-1.5"><CheckCircle className="h-4 w-4" /> COMPLIANT</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress & Credentials Section Grid - 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        {/* Progress Card */}
        <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col h-full shadow-sm">
          <div className="px-4 md:px-6 py-4 bg-muted/50 border-b border-border flex items-center justify-between shrink-0">
            <span className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
              <CheckCircle className="h-4 w-4" /> Completion Status
            </span>
            <span className="text-xs font-black text-muted-foreground">{metrics.completionPercentage}%</span>
          </div>
          <div className="p-6 flex-1 flex flex-col justify-center gap-3">
            <Progress value={metrics.completionPercentage} className="h-3" />
            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest text-right">
              {metrics.completed} of {metrics.total} Documents Uploaded
            </p>
          </div>
        </div>

        {/* Credentials Card */}
        <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col h-full shadow-sm">
          <div className="px-4 md:px-6 py-4 bg-muted/50 border-b border-border flex items-center gap-2 shrink-0">
            <Lock className="h-4 w-4 text-primary" />
            <span className="text-xs font-black uppercase tracking-widest">Portal Credentials</span>
          </div>
          <div className="p-4 md:p-6 flex-1 flex flex-col justify-center">
            <div className="grid grid-cols-2 gap-4">
              {/* Portal Email */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <Mail className="h-3 w-3" /> Email
                </label>
                <Input
                  value={profile.portalEmail}
                  disabled
                  className="h-10 text-xs font-medium bg-muted/30 border-transparent cursor-not-allowed opacity-70"
                />
              </div>

              {/* Portal Password */}
              <div className="space-y-1.5 relative">
                <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <Lock className="h-3 w-3" /> Password
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 flex">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={isChangingPassword ? newPassword : profile.portalPassword}
                      disabled={!isChangingPassword}
                      onChange={(e) => isChangingPassword && setNewPassword(e.target.value)}
                      className={`h-10 text-xs font-mono font-bold ${!isChangingPassword ? 'bg-muted/30 border-transparent cursor-not-allowed opacity-70 pr-8' : `bg-background border-primary shadow-sm ${newPassword ? 'border-b-2' : ''} ${newPassword?.length >= 12 ? 'border-b-green-500' : newPassword?.length >= 8 ? 'border-b-yellow-500' : 'border-b-red-500'} pr-16`}`}
                      placeholder={isChangingPassword ? "Enter new password..." : ""}
                    />
                    <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                      {isChangingPassword && (
                        <button
                          onClick={() => setNewPassword(generatePassword())}
                          className="h-7 w-7 flex items-center justify-center rounded-md text-primary hover:bg-primary/10 transition-colors"
                          title="Generate strong password"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => setShowPassword(!showPassword)}
                        className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted transition-colors"
                        title={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                  {isChangingPassword ? (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => { setIsChangingPassword(false); setNewPassword(''); }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        className="h-10 w-[60px] text-[9px] font-bold uppercase tracking-widest bg-primary text-primary-foreground shadow-md shadow-primary/20"
                        onClick={changePassword}
                        disabled={saving || !newPassword || newPassword.length < 6}
                      >
                        {saving ? <RefreshCw className="h-3 w-3 animate-spin" /> : 'Save'}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 px-4 text-[9px] font-bold uppercase tracking-widest border-primary/20 hover:bg-primary hover:text-primary-foreground whitespace-nowrap min-w-[60px]"
                      onClick={() => { setIsChangingPassword(true); setNewPassword(profile.portalPassword); setShowPassword(true); }}
                    >
                      Edit
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Profile & Products & Contacts Section Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Profile Section */}
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden flex flex-col h-full lg:col-span-1">
          <div className="px-4 md:px-6 h-16 bg-muted/50 border-b border-border flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <span className="text-xs font-black uppercase tracking-widest">Company Profile</span>
            </div>
            {isDirty && (
              <Button size="sm" className="h-8 text-[10px] font-bold uppercase tracking-widest gap-1.5 shadow-lg shadow-primary/20" onClick={saveProfile} disabled={saving}>
                <Save className="h-3.5 w-3.5" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            )}
          </div>
          <div className="p-4 md:p-6 space-y-5">
            <div className="flex flex-col gap-4">
              {/* Supplier Company Name */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <Building2 className="h-3 w-3" /> Company Name
                </label>
                <Input
                  value={profile.name}
                  onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
                  className="h-10 text-sm font-medium bg-foreground/5 border-transparent focus-visible:ring-1"
                  placeholder="Enter company name"
                />
              </div>

              {/* Manufacturing Site Address */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <Globe className="h-3 w-3" /> Manufacturing Site Address
                </label>
                <Input
                  value={profile.manufacturingAddress}
                  onChange={e => setProfile(p => ({ ...p, manufacturingAddress: e.target.value }))}
                  className="h-10 text-sm font-medium bg-foreground/5 border-transparent focus-visible:ring-1"
                  placeholder="Enter manufacturing address"
                />
              </div>

              {/* Country */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <Globe className="h-3 w-3" /> Country
                </label>
                <Input
                  value={profile.country}
                  onChange={e => setProfile(p => ({ ...p, country: e.target.value }))}
                  className="h-10 text-sm font-medium bg-foreground/5 border-transparent focus-visible:ring-1"
                  placeholder="Enter country"
                />
              </div>

              {/* Primary Contact Name */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <User className="h-3 w-3" /> Primary Contact Name
                </label>
                <Input
                  value={profile.primaryContactName}
                  onChange={e => setProfile(p => ({ ...p, primaryContactName: e.target.value }))}
                  className="h-10 text-sm font-medium bg-foreground/5 border-transparent focus-visible:ring-1"
                  placeholder="Enter contact name"
                />
              </div>

              {/* Communication Email */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <Mail className="h-3 w-3" /> Communication Email
                </label>
                <Input
                  type="email"
                  value={profile.communicationEmail}
                  onChange={e => setProfile(p => ({ ...p, communicationEmail: e.target.value }))}
                  className="h-10 text-sm font-medium bg-foreground/5 border-transparent focus-visible:ring-1"
                  placeholder="Enter email address"
                />
              </div>

              {/* Phone */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <Phone className="h-3 w-3" /> Phone
                </label>
                <Input
                  type="tel"
                  value={profile.phone}
                  onChange={e => setProfile(p => ({ ...p, phone: e.target.value.replace(/[^\d+]/g, '') }))}
                  className="h-10 text-sm font-medium bg-foreground/5 border-transparent focus-visible:ring-1"
                  placeholder="Enter phone number"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Contacts Section */}
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden flex flex-col h-full lg:col-span-1">
          <div className="px-4 md:px-6 h-16 bg-muted/50 border-b border-border flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <span className="text-xs font-black uppercase tracking-widest">Contacts</span>
            </div>
            <Button size="sm" variant="outline" className="h-8 text-[10px] font-bold uppercase tracking-widest gap-1.5 border-primary/20 hover:bg-primary hover:text-primary-foreground" onClick={openAddContact}>
              <Plus className="h-3.5 w-3.5" /> Add Contact
            </Button>
          </div>
          <div className="p-0 overflow-y-auto flex-1">
            <div className="divide-y divide-border/50 max-h-[500px] overflow-y-auto">
              {profile.contacts && profile.contacts.length > 0 ? profile.contacts.map((contact, i) => (
                <div key={i} className="p-4 hover:bg-muted/10 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-bold text-sm text-foreground">{contact.name}</div>
                      {contact.designation && <div className="text-[10px] uppercase font-black tracking-widest text-primary/70">{contact.designation}</div>}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => openEditContact(i)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => removeContact(i)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1.5 mt-2 bg-foreground/5 p-2.5 rounded-md">
                    {contact.emails && contact.emails.map((e, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <Mail className="h-3 w-3 shrink-0" /> {e}
                      </div>
                    ))}
                    {contact.phones && contact.phones.map((p, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <Phone className="h-3 w-3 shrink-0" /> {p.number} {p.ext && <span className="text-[9px] font-black uppercase px-1 rounded-sm bg-border/50 ml-1">EXT: {p.ext}</span>}
                      </div>
                    ))}
                    {contact.address && (
                      <div className="flex items-start gap-2 text-xs font-medium text-muted-foreground mt-2 text-left bg-background/50 p-2 rounded-sm border border-border/50">
                        <MapPin className="h-3 w-3 mt-0.5 shrink-0 text-primary/70" /> <span className="leading-tight">{contact.address}</span>
                      </div>
                    )}
                  </div>
                </div>
              )) : (
                <div className="text-center py-12 font-black uppercase text-[10px] tracking-widest text-muted-foreground/50 bg-accent/5 h-full flex flex-col items-center justify-center gap-2">
                  <User className="h-8 w-8 opacity-20" />
                  No contacts added yet
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Products Section */}
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden flex flex-col h-full lg:col-span-1">
          <div className="px-4 md:px-6 h-16 bg-muted/50 border-b border-border flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              <span className="text-xs font-black uppercase tracking-widest">Products</span>
            </div>
            <Popover open={isProductPopoverOpen} onOpenChange={setIsProductPopoverOpen}>
              <PopoverTrigger asChild>
                <Button size="sm" variant="outline" className="h-8 text-[10px] font-bold uppercase tracking-widest gap-1.5 border-primary/20 hover:bg-primary hover:text-primary-foreground">
                  <Plus className="h-3.5 w-3.5" />
                  Add Products
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0" align="end">
                <Command>
                  <CommandInput placeholder="Search global products..." className="h-9" />
                  <CommandList className="max-h-[300px]">
                    <CommandEmpty>No products found.</CommandEmpty>
                    <CommandGroup>
                      {systemProducts.map((p) => (
                        <CommandItem key={p.vbId} value={p.name} onSelect={() => toggleProduct(p.name)}>
                          <Check className={cn("mr-2 h-4 w-4", profile.productsSupplied.includes(p.name) ? "opacity-100" : "opacity-0")} />
                          {p.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="p-0 overflow-y-auto flex-1">
            <table className="w-full text-left text-sm text-muted-foreground whitespace-nowrap">
              <thead className="bg-muted text-[10px] uppercase font-black tracking-widest border-b border-border text-foreground sticky top-0 z-10 w-full">
                <tr>
                  <th className="px-4 py-3 w-16 text-center">S.No</th>
                  <th className="px-4 py-3">Product Name</th>
                  <th className="px-4 py-3 w-16 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {profile.productsSupplied.length > 0 ? profile.productsSupplied.map((product, i) => (
                  <tr key={i} className="hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3 text-center">{i + 1}</td>
                    <td className="px-4 py-3 font-semibold text-foreground whitespace-normal break-words leading-tight">
                      {product}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button title="Remove Product" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => removeProduct(product)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={3} className="text-center py-12 font-black uppercase text-[10px] tracking-widest text-muted-foreground/50 bg-accent/5">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Package className="h-8 w-8 opacity-20" />
                        No products added yet
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Dialog open={isContactDialogOpen} onOpenChange={setIsContactDialogOpen}>
        <DialogContent className="max-w-md bg-background border-border">
          <DialogHeader className="border-b border-border pb-4">
            <DialogTitle className="text-sm font-black uppercase tracking-widest text-foreground flex items-center gap-2">
              <User className="h-4 w-4 text-primary" /> {editingContactIndex !== null ? 'Edit Contact' : 'Add New Contact'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2 md:col-span-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Name</label>
                <Input value={contactForm.name} onChange={e => setContactForm(p => ({ ...p, name: e.target.value }))} className="h-10 text-sm font-medium bg-foreground/5 border-transparent focus-visible:ring-1" placeholder="Full name" />
              </div>
              <div className="space-y-1.5 col-span-2 md:col-span-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Designation</label>
                <Input value={contactForm.designation} onChange={e => setContactForm(p => ({ ...p, designation: e.target.value }))} className="h-10 text-sm font-medium bg-foreground/5 border-transparent focus-visible:ring-1" placeholder="ex. Supply Chain Manager" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center justify-between">
                Emails
                <Button variant="ghost" size="sm" className="h-4 text-[9px] uppercase px-1 text-primary py-0" onClick={() => setContactForm(p => ({ ...p, emails: [...p.emails, ''] }))}>+ Add</Button>
              </label>
              {contactForm.emails.map((email, i) => (
                <div key={`e-${i}`} className="flex items-center gap-2">
                  <Input value={email} onChange={e => { const ne = [...contactForm.emails]; ne[i] = e.target.value; setContactForm(p => ({ ...p, emails: ne })); }} className="h-9 text-xs font-medium bg-foreground/5 border-transparent focus-visible:ring-1" placeholder="Email address" type="email" />
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0" onClick={() => { const ne = contactForm.emails.filter((_, idx) => idx !== i); setContactForm(p => ({ ...p, emails: ne.length ? ne : [''] })); }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center justify-between">
                Phones
                <Button variant="ghost" size="sm" className="h-4 text-[9px] uppercase px-1 text-primary py-0" onClick={() => setContactForm(p => ({ ...p, phones: [...p.phones, { number: '', ext: '' }] }))}>+ Add</Button>
              </label>
              {contactForm.phones.map((phone, i) => (
                <div key={`p-${i}`} className="flex items-center gap-2">
                  <Input value={phone.number} onChange={e => { const np = [...contactForm.phones]; np[i] = { ...np[i], number: e.target.value.replace(/[^\d+]/g, '') }; setContactForm(p => ({ ...p, phones: np })); }} className="h-9 text-xs font-medium bg-foreground/5 border-transparent focus-visible:ring-1" placeholder="Phone Number" type="tel" />
                  <Input value={phone.ext || ''} onChange={e => { const np = [...contactForm.phones]; np[i] = { ...np[i], ext: e.target.value.replace(/\D/g, '') }; setContactForm(p => ({ ...p, phones: np })); }} className="h-9 w-20 text-xs font-medium bg-foreground/5 border-transparent focus-visible:ring-1" placeholder="Ext(Opt)" />
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0" onClick={() => { const np = contactForm.phones.filter((_, idx) => idx !== i); setContactForm(p => ({ ...p, phones: np.length ? np : [{ number: '', ext: '' }] })); }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Address / Notes</label>
              <Input value={contactForm.address} onChange={e => setContactForm(p => ({ ...p, address: e.target.value }))} className="h-10 text-sm font-medium bg-foreground/5 border-transparent focus-visible:ring-1" placeholder="Physical location details" />
            </div>

            <Button className="w-full text-[10px] h-10 font-black uppercase tracking-widest mt-2 bg-primary text-primary-foreground shadow-lg shadow-primary/20" onClick={submitContact}>
              <Save className="h-4 w-4 mr-2" /> Save Contact
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
