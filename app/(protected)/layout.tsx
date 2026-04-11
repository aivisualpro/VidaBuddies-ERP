import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { HeaderActionsProvider } from "@/components/providers/header-actions-provider";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import VidaUser from "@/lib/models/VidaUser";
import VidaAppRole from "@/lib/models/VidaAppRole";
import { redirect } from "next/navigation";
import { StoreInitializer } from "@/store/StoreInitializer";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  
  let initialPermissions: any[] = [];
  let isSuperAdmin = false;

  // Extra security: Verify status in database on every page load
  if (session && session.id) {
    try {
      await connectToDatabase();
      const userId = String(session.id);
      if (userId.match(/^[0-9a-fA-F]{24}$/)) {
        if (session.role === "Supplier") {
           // Assume supplier is active for now, or check VidaSupplier if needed
        } else {
           const user = await VidaUser.findById(userId).select('isActive AppRole').lean();
           if (!user || !user.isActive) {
             // Cannot mutate cookies in a Server Component Layout
             // Instead, clear it via redirecting to a GET logout route
             redirect("/api/auth/logout?redirect=true");
           } else {
             if (user.AppRole === 'Super Admin') {
               isSuperAdmin = true;
             } else if (user.AppRole) {
               const roleDoc = await VidaAppRole.findOne({ name: user.AppRole }).lean();
               if (roleDoc && roleDoc.permissions) {
                 // Clone to ensure plain object for React Server Components serialization
                 initialPermissions = JSON.parse(JSON.stringify(roleDoc.permissions));
               }
             }
           }
        }
      }
    } catch (error) {
       console.error("Layout Auth Check Error:", error);
    }
  }

  const cookieStore = await cookies();
  let defaultOpen = cookieStore.get("sidebar_state")?.value === "true";
  
  if (session?.role === "Supplier") {
    defaultOpen = false;
  }

  return (
    <HeaderActionsProvider>
      <SidebarProvider
        defaultOpen={defaultOpen}
        className="h-screen overflow-hidden"
        style={
          {
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <StoreInitializer isSupplier={session?.role === "Supplier"} />
        <AppSidebar variant="inset" isSupplierProp={session?.role === "Supplier"} initialPermissions={initialPermissions} initialIsAdmin={isSuperAdmin} />
        <SidebarInset className="flex flex-col h-full overflow-hidden bg-background shadow-none border-none m-0">
          <SiteHeader />
          <div className="flex-1 overflow-auto p-[16px]">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </HeaderActionsProvider>
  );
}
