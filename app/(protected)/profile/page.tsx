"use client";
import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import Image from "next/image";

export default function ProfilePage() {
   const [user, setUser] = useState<any>(null);
   const [password, setPassword] = useState("");
   const [saving, setSaving] = useState(false);
   const [loading, setLoading] = useState(true);

   useEffect(() => {
     fetch("/api/profile")
       .then(res => res.json())
       .then(data => {
         if(data.error) throw new Error(data.error);
         setUser(data);
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
       setPassword("");
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
               <Input 
                 id="new-password"
                 type="password" 
                 placeholder="Enter new password" 
                 value={password}
                 onChange={e => setPassword(e.target.value)}
                 className="h-10"
               />
             </div>
             <Button className="w-full font-semibold" onClick={handleSavePassword} disabled={saving || !password}>
               {saving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
               Update Password
             </Button>
           </div>
         </CardContent>
       </Card>
     </div>
   );
}
