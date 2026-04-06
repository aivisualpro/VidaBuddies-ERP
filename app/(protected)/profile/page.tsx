"use client";
import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, RefreshCw } from "lucide-react";
import Image from "next/image";

export default function ProfilePage() {
   const [user, setUser] = useState<any>(null);
   const [password, setPassword] = useState("");
   const [showPassword, setShowPassword] = useState(false);
   const [saving, setSaving] = useState(false);
   const [loading, setLoading] = useState(true);

   const generatePassword = () => {
     const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
     let newPass = "";
     for (let i = 0; i < 16; i++) {
       newPass += chars.charAt(Math.floor(Math.random() * chars.length));
     }
     setPassword(newPass);
     setShowPassword(true); // Reveal it so user can copy/see it
   };

   const getPasswordStrength = (pass: string) => {
     if (!pass) return 0;
     let score = 0;
     if (pass.length >= 8) score += 1;
     if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score += 1;
     if (/\d/.test(pass)) score += 1;
     if (/[^a-zA-Z0-9]/.test(pass)) score += 1;
     return score === 0 ? 1 : score;
   };

   const strength = getPasswordStrength(password);
   const strengthLabels = ["Weak", "Fair", "Good", "Strong"];
   const strengthColors = ["bg-red-500", "bg-amber-500", "bg-blue-500", "bg-emerald-500"];

   useEffect(() => {
     fetch("/api/profile")
       .then(res => res.json())
       .then(data => {
         if(data.error) throw new Error(data.error);
         setUser(data);
         if (data.password) {
           setPassword(data.password);
         }
       })
       .catch(err => toast.error("Failed to load profile", { description: err.message }))
       .finally(() => setLoading(false));
   }, []);

   const handleSavePassword = async () => {
     if (!password) {
       toast.error("Password cannot be empty");
       return;
     }
     setSaving(true);
     try {
       const res = await fetch("/api/profile", {
         method: "PUT",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ password }),
       });
       if (!res.ok) {
           const err = await res.json();
           throw new Error(err.error || "Failed to update password");
       }
       toast.success("Password updated successfully");
     } catch (err: any) {
       toast.error(err.message || "Something went wrong");
     } finally {
       setSaving(false);
     }
   };

   if (loading) return <div className="p-20 flex justify-center h-[calc(100vh-8rem)] items-center"><Loader2 className="animate-spin text-primary h-10 w-10" /></div>;
   if (!user) return <div className="text-center p-20 text-muted-foreground">Unable to load profile.</div>;

   return (
     <div className="max-w-3xl mx-auto py-10 space-y-6 px-4">
       <Card className="border-0 shadow-lg bg-gradient-to-br from-card to-muted/20">
         <CardHeader className="pb-4">
           <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">My Profile</CardTitle>
         </CardHeader>
         <CardContent className="grid gap-8">
           <div className="flex items-center gap-6">
             <div className="h-28 w-28 rounded-full overflow-hidden border-4 border-muted shadow-xl bg-zinc-900 flex-shrink-0 relative">
                {user.profilePicture ? (
                   <Image src={user.profilePicture} alt="Profile" fill className="object-cover" />
                ) : (
                   <div className="h-full w-full flex items-center justify-center text-zinc-500 font-bold text-4xl">
                     {user.name?.charAt(0)}
                   </div>
                )}
             </div>
             <div>
                <h2 className="text-2xl font-bold text-foreground tracking-tight">{user.name}</h2>
                <p className="text-muted-foreground mt-1 font-medium">{user.role} {user.designation && user.designation !== "N/A" ? `• ${user.designation}` : ""}</p>
             </div>
           </div>

           <div className="grid md:grid-cols-2 gap-6 bg-muted/10 p-6 rounded-2xl border">
             <div className="space-y-2">
               <Label className="text-muted-foreground uppercase text-[10px] tracking-wider font-bold">Email Address</Label>
               <p className="font-medium">{user.email || ""}</p>
             </div>
             <div className="space-y-2">
               <Label className="text-muted-foreground uppercase text-[10px] tracking-wider font-bold">Phone Number</Label>
               <p className="font-medium">{user.phone || "N/A"}</p>
             </div>
             <div className="space-y-2 md:col-span-2">
               <Label className="text-muted-foreground uppercase text-[10px] tracking-wider font-bold">Address</Label>
               <p className="font-medium">{user.address || "N/A"}</p>
             </div>
             {user.bio && user.bio !== "N/A" && (
                 <div className="space-y-2 md:col-span-2">
                   <Label className="text-muted-foreground uppercase text-[10px] tracking-wider font-bold">Bio</Label>
                   <p className="font-medium text-sm">{user.bio}</p>
                 </div>
             )}
           </div>
         </CardContent>
       </Card>

       <Card className="border-0 shadow-lg">
         <CardHeader>
           <CardTitle className="text-xl">Update Password</CardTitle>
         </CardHeader>
         <CardContent className="space-y-4">
           <div className="flex flex-col gap-4 max-w-sm">
             <div className="space-y-2">
               <Label htmlFor="new-password">New Password</Label>
               <div className="relative">
                 <Input 
                   id="new-password"
                   type={showPassword ? "text" : "password"} 
                   placeholder="Enter new password" 
                   value={password}
                   onChange={e => setPassword(e.target.value)}
                   className="h-10 pr-10"
                 />
                 <button
                   type="button"
                   onClick={() => setShowPassword(!showPassword)}
                   className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                 >
                   {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                 </button>
               </div>
               {password && (
                 <div className="space-y-1.5 mt-2 transition-all">
                   <div className="flex justify-between items-center text-xs">
                     <span className="text-muted-foreground">Password strength:</span>
                     <span className={`font-semibold ${strengthColors[strength - 1]?.replace("bg-", "text-")}`}>
                       {strengthLabels[strength - 1]}
                     </span>
                   </div>
                   <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden flex gap-0.5">
                     {[1, 2, 3, 4].map(level => (
                       <div 
                         key={level} 
                         className={`h-full flex-1 transition-all duration-300 ${level <= strength ? strengthColors[strength - 1] : "bg-transparent"}`} 
                       />
                     ))}
                   </div>
                 </div>
               )}
             </div>

             <button 
               type="button" 
               onClick={generatePassword} 
               className="text-xs text-primary font-medium flex items-center gap-1.5 hover:underline self-start"
             >
               <RefreshCw className="h-3 w-3" />
               Suggest strong password
             </button>

             <Button className="w-full font-semibold mt-2" onClick={handleSavePassword} disabled={saving || !password}>
               {saving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
               Update Password
             </Button>
           </div>
         </CardContent>
       </Card>
     </div>
   );
}
