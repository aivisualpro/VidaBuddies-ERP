"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, AlertTriangle, CheckCircle, Clock, Save, Eye, EyeOff, 
  RefreshCw, X, Plus, Lock, Building2, User, Mail, Phone, Globe, Package 
} from "lucide-react";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";

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
}

export function SupplierDashboard({ supplierId, isSupplierView = false }: { supplierId: string, isSupplierView?: boolean }) {
  const { setLeftContent } = useHeaderActions();
  const [supplierName, setSupplierName] = useState<string>("");
  const [metrics, setMetrics] = useState({
    total: 40,
    completed: 0,
    missing: 40,
    completionPercentage: 0,
    status: "MISSING DOCUMENTS",
  });

  const [profile, setProfile] = useState<SupplierProfile>({
    name: '', portalEmail: '', portalPassword: '', manufacturingAddress: '',
    country: '', primaryContactName: '', communicationEmail: '', phone: '', productsSupplied: []
  });
  const [originalProfile, setOriginalProfile] = useState<SupplierProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newProductInput, setNewProductInput] = useState('');
  const productInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchSupplier = async () => {
      try {
        const response = await fetch(`/api/admin/suppliers/${supplierId}`);
        if (response.ok) {
          const data = await response.json();
          setSupplierName(data.name || "");
          
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
    fetchSupplier();
  }, [supplierId]);

  useEffect(() => {
    if (supplierName) {
      setLeftContent(
        <h1 className="text-xl font-black tracking-tight uppercase bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent flex items-center gap-2">
          <span className="hidden md:inline">{supplierName} <span className="text-primary/40">/</span></span> <span className="text-primary/40 md:text-primary/40">DASHBOARD</span>
        </h1>
      );
    }
  }, [supplierName, setLeftContent]);

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

  const addProduct = () => {
    const val = newProductInput.trim();
    if (!val) return;
    if (profile.productsSupplied.includes(val)) {
      toast.error("Product already exists.");
      return;
    }
    setProfile(p => ({ ...p, productsSupplied: [...p.productsSupplied, val] }));
    setNewProductInput('');
    productInputRef.current?.focus();
  };

  const removeProduct = (product: string) => {
    setProfile(p => ({ ...p, productsSupplied: p.productsSupplied.filter(x => x !== product) }));
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
        <Card className="bg-card">
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Status</span>
              <Clock className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="text-sm md:text-lg font-black tracking-tight mt-1">
              {metrics.missing > 0 ? (
                <span className="text-orange-500 flex items-center gap-1.5">⚠️ {metrics.status}</span>
              ) : (
                <span className="text-green-500 flex items-center gap-1.5"><CheckCircle className="h-4 w-4"/> COMPLIANT</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress */}
      <Card className="bg-card border-border">
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center justify-between text-xs font-black uppercase tracking-widest">
            <span className="text-primary">Completion %</span>
            <span className="text-muted-foreground">{metrics.completionPercentage}%</span>
          </div>
          <Progress value={metrics.completionPercentage} className="h-3" />
        </CardContent>
      </Card>

      {/* Profile Section */}
      <Card className="bg-card border-border overflow-hidden">
        <div className="px-4 md:px-6 py-4 bg-muted/50 border-b border-border flex items-center justify-between">
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
        <CardContent className="pt-6 pb-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
                className="h-10 text-sm font-medium bg-foreground/5 border-transparent focus-visible:ring-1"
                placeholder="Enter phone number"
              />
            </div>
          </div>

          {/* Products Supplied - Full Width */}
          <div className="space-y-2">
            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Package className="h-3 w-3" /> Products Supplied
            </label>
            <div className="flex flex-wrap gap-2 min-h-[36px]">
              {profile.productsSupplied.map((product, i) => (
                <Badge 
                  key={i} 
                  variant="secondary"
                  className="h-7 pl-3 pr-1.5 text-xs font-bold uppercase tracking-wider gap-1 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 cursor-default"
                >
                  {product}
                  <button
                    onClick={() => removeProduct(product)}
                    className="ml-1 h-4 w-4 rounded-full hover:bg-destructive/20 hover:text-destructive flex items-center justify-center transition-colors"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                ref={productInputRef}
                value={newProductInput}
                onChange={e => setNewProductInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addProduct(); } }}
                className="h-9 text-sm font-medium bg-foreground/5 border-transparent focus-visible:ring-1 flex-1"
                placeholder="Type product name and press Enter..."
              />
              <Button variant="outline" size="sm" className="h-9 px-3 text-[10px] font-bold uppercase tracking-widest border-primary/20 hover:bg-primary hover:text-primary-foreground gap-1" onClick={addProduct}>
                <Plus className="h-3 w-3" /> Add
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Credentials Section */}
      <Card className="bg-card border-border overflow-hidden">
        <div className="px-4 md:px-6 py-4 bg-muted/50 border-b border-border flex items-center gap-2">
          <Lock className="h-4 w-4 text-primary" />
          <span className="text-xs font-black uppercase tracking-widest">Portal Credentials</span>
        </div>
        <CardContent className="pt-6 pb-6 space-y-4">
          {/* Portal Email */}
          <div className="space-y-1.5">
            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Mail className="h-3 w-3" /> Portal Email
            </label>
            <Input
              value={profile.portalEmail}
              disabled
              className="h-10 text-sm font-medium bg-muted/30 border-transparent cursor-not-allowed opacity-70"
            />
          </div>

          {/* Portal Password */}
          <div className="space-y-1.5">
            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Lock className="h-3 w-3" /> Portal Password
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={profile.portalPassword}
                  disabled
                  className="h-10 text-sm font-mono font-bold bg-muted/30 border-transparent cursor-not-allowed opacity-70 pr-10"
                />
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-10 text-[10px] font-bold uppercase tracking-widest border-primary/20 hover:bg-primary hover:text-primary-foreground whitespace-nowrap"
                onClick={() => { setIsChangingPassword(!isChangingPassword); setNewPassword(''); }}
              >
                {isChangingPassword ? 'Cancel' : 'Change'}
              </Button>
            </div>
          </div>

          {/* Change Password Form */}
          {isChangingPassword && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
              <label className="text-[9px] font-black uppercase tracking-widest text-primary flex items-center gap-1.5">
                <Lock className="h-3 w-3" /> New Password
              </label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="h-10 text-sm font-mono font-bold bg-background border-primary/20 focus-visible:ring-primary flex-1"
                  placeholder="Enter new password..."
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 border-primary/30 hover:bg-primary/10 shrink-0"
                  title="Generate strong password"
                  onClick={() => setNewPassword(generatePassword())}
                >
                  <RefreshCw className="h-4 w-4 text-primary" />
                </Button>
              </div>
              {newPassword && (
                <div className="flex items-center gap-2">
                  <div className={`h-1.5 flex-1 rounded-full ${newPassword.length >= 12 ? 'bg-green-500' : newPassword.length >= 8 ? 'bg-yellow-500' : 'bg-red-500'}`} />
                  <span className={`text-[9px] font-black uppercase tracking-widest ${newPassword.length >= 12 ? 'text-green-500' : newPassword.length >= 8 ? 'text-yellow-500' : 'text-red-500'}`}>
                    {newPassword.length >= 12 ? 'Strong' : newPassword.length >= 8 ? 'Medium' : 'Weak'}
                  </span>
                </div>
              )}
              <Button
                size="sm"
                className="h-9 text-[10px] font-bold uppercase tracking-widest gap-1.5 w-full shadow-lg shadow-primary/20"
                onClick={changePassword}
                disabled={saving || !newPassword || newPassword.length < 6}
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? 'Saving...' : 'Update Password'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
