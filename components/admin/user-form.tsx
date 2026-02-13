"use client";

import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  User as UserIcon, 
  Mail, 
  Phone, 
  MapPin, 
  Briefcase, 
  Shield, 
  ShieldCheck,
  Lock, 
  Activity, 
  Hash,
  Wand2,
  Eye,
  EyeOff,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";

interface User {
  _id?: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  AppRole: string;
  password?: string;
  isActive: boolean;
  serialNo?: string;
  designation?: string;
  bioDescription?: string;
  profilePicture?: string;
  signature?: string;
  isOnWebsite?: boolean;
  isTwoFactorRequired?: boolean;
}

interface UserFormProps {
  initialData?: Partial<User>;
  onSubmit: (data: Partial<User>) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function UserForm({ initialData, onSubmit, onCancel, isSubmitting }: UserFormProps) {
  const [formData, setFormData] = useState<Partial<User>>({
    name: "",
    email: "",
    phone: "",
    address: "",
    password: "",
    isActive: true,
    AppRole: "Manager",
    serialNo: "",
    designation: "",
    bioDescription: "",
    profilePicture: "",
    signature: "",
    isOnWebsite: false,
    isTwoFactorRequired: false,
    ...initialData,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);

  const generatePassword = () => {
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*_+-=';
    const all = upper + lower + numbers + symbols;
    
    // Ensure at least one of each
    let pass = '';
    pass += upper[Math.floor(Math.random() * upper.length)];
    pass += lower[Math.floor(Math.random() * lower.length)];
    pass += numbers[Math.floor(Math.random() * numbers.length)];
    pass += symbols[Math.floor(Math.random() * symbols.length)];
    
    // Fill the rest
    for (let i = 4; i < 16; i++) {
      pass += all[Math.floor(Math.random() * all.length)];
    }
    
    // Shuffle
    pass = pass.split('').sort(() => Math.random() - 0.5).join('');
    
    setFormData({ ...formData, password: pass });
    setShowPassword(true);
    toast.success('Strong password generated!', { description: 'Password has been filled in.' });
  };

  const copyPassword = async () => {
    if (formData.password) {
      await navigator.clipboard.writeText(formData.password);
      setCopiedPassword(true);
      toast.success('Password copied to clipboard');
      setTimeout(() => setCopiedPassword(false), 2000);
    }
  };

  const [availableRoles, setAvailableRoles] = useState<{name: string}[]>([]);

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const res = await fetch("/api/admin/roles");
        if (res.ok) {
          const data = await res.json();
          setAvailableRoles(data);
        }
      } catch (error) {
        console.error("Failed to fetch roles", error);
      }
    };
    fetchRoles();
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    if (formData.signature) {
      const timer = setTimeout(() => {
        const canvas = signatureCanvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext("2d");
          if (ctx) {
            const img = new Image();
            img.onload = () => {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(img, 0, 0);
            };
            img.src = formData.signature!;
          }
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [formData.signature]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File excessively large. Please choose a smaller image.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({ ...prev, profilePicture: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = signatureCanvasRef.current;
    if (canvas) {
      setFormData((prev) => ({ ...prev, signature: canvas.toDataURL() }));
    }
  };

  const clearSignature = () => {
    const canvas = signatureCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      setFormData((prev) => ({ ...prev, signature: "" }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-3 gap-8 py-4">
        {/* Left Column: 2/3 width */}
        <div className="col-span-2 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="serialNo">Serial No</Label>
              <div className="relative">
                <Hash className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="serialNo"
                  className="pl-9"
                  placeholder="001"
                  value={formData.serialNo || ""}
                  onChange={(e) => setFormData({ ...formData, serialNo: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <div className="relative">
                <UserIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="name"
                  className="pl-9"
                  placeholder="John Doe"
                  value={formData.name || ""}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
            </div>
          </div>

          {/* Two‑Factor Authentication Toggle */}
          <div className="flex items-center justify-between rounded-lg border border-input px-4 py-3 bg-muted/30">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10">
                <ShieldCheck className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <Label htmlFor="isTwoFactorRequired" className="text-sm font-medium cursor-pointer">Two-Factor Authentication</Label>
                <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">Require 2FA for this user to sign in</p>
              </div>
            </div>
            <Switch
              id="isTwoFactorRequired"
              checked={formData.isTwoFactorRequired || false}
              onCheckedChange={(checked) => setFormData({ ...formData, isTwoFactorRequired: checked })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  className="pl-9"
                  placeholder="john@example.com"
                  value={formData.email || ""}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="designation">Designation</Label>
              <div className="relative">
                <Briefcase className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="designation"
                  className="pl-9"
                  placeholder="e.g. Sales Manager"
                  value={formData.designation || ""}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 text-xs text-blue-600 hover:text-blue-700 px-2"
                  onClick={generatePassword}
                >
                  <Wand2 className="h-3 w-3" />
                  Suggest
                </Button>
              </div>
              <div className="relative">
                <Lock className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  className="pl-9 pr-20"
                  placeholder={initialData?._id ? "Leave empty to keep" : "******"}
                  value={formData.password || ""}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required={!initialData?._id}
                />
                <div className="absolute right-1 top-1 flex items-center gap-0.5">
                  {formData.password && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={copyPassword}
                    >
                      {copiedPassword ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
              {formData.password && showPassword && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        (formData.password?.length || 0) < 6
                          ? 'w-1/4 bg-red-500'
                          : (formData.password?.length || 0) < 10
                          ? 'w-2/4 bg-amber-500'
                          : (formData.password?.length || 0) < 14
                          ? 'w-3/4 bg-blue-500'
                          : 'w-full bg-green-500'
                      }`}
                    />
                  </div>
                  <span className={`text-[10px] font-medium ${
                    (formData.password?.length || 0) < 6
                      ? 'text-red-500'
                      : (formData.password?.length || 0) < 10
                      ? 'text-amber-500'
                      : (formData.password?.length || 0) < 14
                      ? 'text-blue-500'
                      : 'text-green-500'
                  }`}>
                    {(formData.password?.length || 0) < 6
                      ? 'Weak'
                      : (formData.password?.length || 0) < 10
                      ? 'Fair'
                      : (formData.password?.length || 0) < 14
                      ? 'Good'
                      : 'Strong'}
                  </span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <div className="relative">
                  <Activity className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground z-10" />
                  <div className="[&>button]:pl-9">
                    <Select
                      value={formData.isActive ? "active" : "inactive"}
                      onValueChange={(value) => setFormData({ ...formData, isActive: value === "active" })}
                    >
                      <SelectTrigger className="pl-9 w-full">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="isOnWebsite">Show on Website</Label>
                <div className="flex h-10 items-center justify-between rounded-md border border-input bg-transparent px-3 py-2">
                  <span className="text-sm text-muted-foreground">Visible</span>
                  <Switch
                    id="isOnWebsite"
                    checked={formData.isOnWebsite || false}
                    onCheckedChange={(checked) => setFormData({ ...formData, isOnWebsite: checked })}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="role">Role</Label>
              <div className="relative">
                <Shield className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground z-10" />
                <div className="[&>button]:pl-9">
                  <Select
                    value={formData.AppRole}
                    onValueChange={(value: any) => setFormData({ ...formData, AppRole: value })}
                  >
                    <SelectTrigger className="pl-9 w-full">
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRoles.length > 0 ? (
                        availableRoles.map((role) => (
                          <SelectItem key={role.name} value={role.name}>
                            {role.name}
                          </SelectItem>
                        ))
                      ) : (
                        // Fallback if no roles loaded yet or none exist
                        <>
                          <SelectItem value="Super Admin">Super Admin</SelectItem>
                          <SelectItem value="Manager">Manager</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone</Label>
              <div className="relative">
                <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  className="pl-9"
                  placeholder="+1 234 567 890"
                  value={formData.phone || ""}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="address">Address</Label>
            <div className="relative">
              <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="address"
                className="pl-9"
                placeholder="123 Main St, City, Country"
                value={formData.address || ""}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="bioDescription">Bio / Description</Label>
            <textarea
              id="bioDescription"
              className="flex min-h-[220px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Enter user biography..."
              value={formData.bioDescription || ""}
              onChange={(e) => setFormData({ ...formData, bioDescription: e.target.value })}
            />
          </div>
        </div>

        {/* Right Column: 1/3 width */}
        <div className="col-span-1 space-y-6">
          <div className="grid gap-2">
            <Label>Profile Picture</Label>
            <div
              className="flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-lg hover:bg-accent/50 transition-colors cursor-pointer group"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileChange}
              />
              {formData.profilePicture ? (
                <div className="relative w-32 h-32 rounded-full overflow-hidden border">
                  <img src={formData.profilePicture} alt="Profile" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-32 h-32 rounded-full bg-muted flex items-center justify-center group-hover:scale-105 transition-transform">
                  <UserIcon className="h-10 w-10 text-muted-foreground" />
                </div>
              )}
              <Button variant="ghost" size="sm" type="button" className="mt-2 text-xs">
                {formData.profilePicture ? "Change Photo" : "Upload Photo"}
              </Button>
            </div>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Signature</Label>
              <Button type="button" variant="ghost" size="sm" className="h-6 text-xs text-destructive" onClick={clearSignature}>
                Clear
              </Button>
            </div>
            <div className="border rounded-md overflow-hidden bg-white border-input">
              <canvas
                ref={signatureCanvasRef}
                width={300}
                height={120}
                className="w-full h-[120px] touch-none cursor-crosshair"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">Sign in the box above</p>
          </div>

          <div className="flex flex-col gap-3 pt-4 border-t">
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : initialData?._id ? "Save Changes" : "Create User"}
            </Button>
            <Button type="button" variant="outline" className="w-full" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
