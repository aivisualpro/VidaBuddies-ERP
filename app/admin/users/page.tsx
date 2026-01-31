"use client";

import { useEffect, useState } from "react";
import { SimpleDataTable } from "@/components/admin/simple-data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Pencil, Trash, User as UserIcon, Mail, Phone, MapPin, Shield, Lock, Activity, Hash, Briefcase, FileText } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRef } from "react";

interface User {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  AppRole: "Super Admin" | "Manager";
  password?: string;
  isActive: boolean;
  serialNo?: string;
  designation?: string;
  bioDescription?: string;
  profilePicture?: string;
  signature?: string;
  isOnWebsite?: boolean;
}

export default function UsersPage() {
  const [data, setData] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<User | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
          toast.error("File excessively large. Please choose a smaller image.");
          return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, profilePicture: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Form state
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
  });

  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    // Set drawing styles
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
        // Save signature to formData
        setFormData(prev => ({ ...prev, signature: canvas.toDataURL() }));
    }
  };

  const clearSignature = () => {
      const canvas = signatureCanvasRef.current;
      if (canvas) {
          const ctx = canvas.getContext("2d");
          ctx?.clearRect(0, 0, canvas.width, canvas.height);
          setFormData(prev => ({ ...prev, signature: "" }));
      }
  };

  // Load signature into canvas when editing
  useEffect(() => {
      if (isSheetOpen && formData.signature && signatureCanvasRef.current) {
          const canvas = signatureCanvasRef.current;
          const ctx = canvas.getContext("2d");
          const img = new Image();
          img.onload = () => {
              ctx?.drawImage(img, 0, 0);
          };
          img.src = formData.signature;
      }
  }, [isSheetOpen, formData.signature]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/users");
      const users = await response.json();
      if (Array.isArray(users)) {
        const sortedUsers = users.sort((a: User, b: User) => {
             // 1. Primary Sort: Serial No
             const serialA = a.serialNo ? String(a.serialNo).trim() : "";
             const serialB = b.serialNo ? String(b.serialNo).trim() : "";

             if (serialA && serialB) {
                 // Try numeric sort first if both look like numbers
                 const numA = Number(serialA);
                 const numB = Number(serialB);
                 if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
                     return numA - numB;
                 }
                 // Alpha-numeric sort strings (e.g. A1 vs A2)
                 if (serialA !== serialB) {
                    return serialA.localeCompare(serialB, undefined, { numeric: true });
                 }
             }
             
             // Put items WITH serialNo before items WITHOUT
             if (serialA && !serialB) return -1;
             if (!serialA && serialB) return 1;

             // 2. Secondary Sort: Name
             return (a.name || "").localeCompare(b.name || "");
        });
        setData(sortedUsers);
      }
    } catch (error) {
      toast.error("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingItem
        ? `/api/admin/users/${editingItem._id}`
        : "/api/admin/users";
      const method = editingItem ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error("Failed to save");

      toast.success(editingItem ? "User updated" : "User created");
      setIsSheetOpen(false);
      fetchUsers();
    } catch (error) {
      toast.error("An error occurred");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      const response = await fetch(`/api/admin/users/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete");
      toast.success("User deleted");
      fetchUsers();
    } catch (error) {
      toast.error("Failed to delete user");
    }
  };

  const openAddSheet = () => {
    setEditingItem(null);
    setFormData({
      name: "",
      email: "",
      phone: "",
      address: "",
      password: "",
      isActive: true,
      AppRole: "Manager",
    });
    setIsSheetOpen(true);
  };

  const openEditSheet = (user: User) => {
    setEditingItem(user);
    setFormData(user);
    setIsSheetOpen(true);
  };

  const columns: ColumnDef<User>[] = [
    {
      accessorKey: "serialNo",
      header: "Sno",
    },
    {
      id: "profilePicture",
      header: "Image",
      cell: ({ row }) => (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted overflow-hidden">
               {row.original.profilePicture ? (
                   <img src={row.original.profilePicture} alt="User" className="h-full w-full object-cover" />
               ) : (
                   <UserIcon className="h-5 w-5 text-muted-foreground" />
               )}
          </div>
      ),
    },
    {
      accessorKey: "name",
      header: "Name",
    },
    {
      accessorKey: "designation",
      header: "Designation",
    },
    {
      accessorKey: "AppRole",
      header: "App Role",
    },
    {
      accessorKey: "email",
      header: "",
      cell: ({ row }) => (
         <div title={row.original.email} className="flex justify-center">
            <Mail className="h-4 w-4 text-muted-foreground" />
         </div>
      ),
    },
    {
      accessorKey: "phone",
      header: "",
      cell: ({ row }) => (
         <div title={row.original.phone || "No phone"} className="flex justify-center">
            <Phone className="h-4 w-4 text-muted-foreground" />
         </div>
      ),
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => (
        <span className={`px-2 py-1 rounded text-xs ${row.original.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {row.original.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      accessorKey: "isOnWebsite",
      header: "On Website",
      cell: ({ row }) => (
          row.original.isOnWebsite ? <span className="text-green-600 text-xs">Yes</span> : <span className="text-muted-foreground text-xs">No</span>
      ),
    },
    {
      id: "details",
      header: "", // Icon only, no header text requested? Or just header "Details" with icon cell? Request: "Details (change this to icon only)" -> Interpreted as icon button.
      cell: ({ row }) => (
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => toast.info("User details coming soon...")}
          className="h-8 w-8 p-0"
        >
          <FileText className="h-4 w-4" />
        </Button>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const user = row.original;
        return (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => openEditSheet(user)}
              className="h-8 w-8 p-0"
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDelete(user._id)}
              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
              title="Delete"
            >
              <Trash className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="w-full h-full">
      <SimpleDataTable 
         data={data} 
         columns={columns} 
         title="Users" 
         onAdd={() => openAddSheet()} 
         loading={loading}
         showColumnToggle={false}
      /><Dialog open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit User" : "Add User"}</DialogTitle>
          </DialogHeader>
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
                          onChange={(e) =>
                            setFormData({ ...formData, serialNo: e.target.value })
                          }
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
                          onChange={(e) =>
                            setFormData({ ...formData, name: e.target.value })
                          }
                          required={!editingItem}
                        />
                      </div>
                    </div>
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
                          onChange={(e) =>
                            setFormData({ ...formData, email: e.target.value })
                          }
                          required={!editingItem}
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
                          onChange={(e) =>
                            setFormData({ ...formData, designation: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  </div>

                   <div className="grid grid-cols-2 gap-4">
                     <div className="grid gap-2">
                      <Label htmlFor="password">Password</Label>
                       <div className="relative">
                          <Lock className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="password"
                            type="password"
                            className="pl-9"
                            placeholder={editingItem ? "Leave empty to keep" : "******"}
                            value={formData.password || ""}
                            onChange={(e) =>
                              setFormData({ ...formData, password: e.target.value })
                            }
                            required={!editingItem}
                          />
                       </div>
                    </div>
                     <div className="grid grid-cols-2 gap-4">
                       <div className="grid gap-2">
                        <Label htmlFor="status">Status</Label>
                         <div className="relative">
                            <Activity className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground z-10" />
                            <div className="[&>button]:pl-9">
                              <Select
                                value={formData.isActive ? "active" : "inactive"}
                                onValueChange={(value) =>
                                  setFormData({ ...formData, isActive: value === "active" })
                                }
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
                            onCheckedChange={(checked) =>
                              setFormData({ ...formData, isOnWebsite: checked })
                            }
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
                              onValueChange={(value: any) =>
                                setFormData({ ...formData, AppRole: value })
                              }
                            >
                              <SelectTrigger className="pl-9 w-full">
                                <SelectValue placeholder="Select a role" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Super Admin">Super Admin</SelectItem>
                                <SelectItem value="Manager">Manager</SelectItem>
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
                          onChange={(e) =>
                            setFormData({ ...formData, phone: e.target.value })
                          }
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
                        onChange={(e) =>
                          setFormData({ ...formData, address: e.target.value })
                        }
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
                      onChange={(e) =>
                        setFormData({ ...formData, bioDescription: e.target.value })
                      }
                    />
                 </div>
              </div>

              {/* Right Column: 1/3 width */}
              <div className="col-span-1 space-y-6">
                 {/* Profile Picture */}
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

                 {/* Signature */}
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

                 {/* Action Buttons */}
                 <div className="flex flex-col gap-3 pt-4">
                    <Button type="submit" className="w-full">
                      {editingItem ? "Save Changes" : "Create User"}
                    </Button>
                    <Button variant="outline" type="button" className="w-full" onClick={() => setIsSheetOpen(false)}>
                      Cancel
                    </Button>
                 </div>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
