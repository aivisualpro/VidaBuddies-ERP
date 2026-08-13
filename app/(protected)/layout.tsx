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
import { RealtimeInvalidator } from "@/components/RealtimeInvalidator";
import { GlobalProgressBar } from "@/components/GlobalProgressBar";
import { AppTitleBar } from "@/components/pwa/app-titlebar";
import { AppCommandMenu } from "@/components/pwa/app-command-menu";
import { CommandMenuProvider } from "@/components/providers/command-menu-provider";


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

  const isSupplier = session?.role === "Supplier";

  return (
    <HeaderActionsProvider>
      {/* Wraps both the title bar and the shell: the ⌘K trigger lives in the
          title bar, which sits outside SidebarProvider, while the palette
          itself needs sidebar context. */}
      <CommandMenuProvider>
        <GlobalProgressBar />

        {/* Renders only in an installed desktop window, where the browser has
            handed us the title bar. A no-op in a normal tab. */}
        <AppTitleBar />

        <SidebarProvider
          defaultOpen={defaultOpen}
          // `--app-titlebar-height` is 0px unless we are drawing the window's
          // title bar ourselves, so this is exactly `h-screen` in a browser tab.
          className="h-[calc(100vh-var(--app-titlebar-height))] min-h-0 overflow-hidden"
          style={
            {
              "--header-height": "3rem",
            } as React.CSSProperties
          }
        >

          <RealtimeInvalidator />
          <AppSidebar variant="inset" isSupplierProp={isSupplier} initialPermissions={initialPermissions} initialIsAdmin={isSuperAdmin} />
          <SidebarInset className="flex flex-col h-full w-full overflow-hidden bg-background">
            <SiteHeader />
            <div className="flex-1 overflow-auto origin-top-left flex flex-col p-4">
                {children}
            </div>
          </SidebarInset>

          <AppCommandMenu
            isAdmin={isSuperAdmin}
            isSupplier={isSupplier}
            permissions={initialPermissions}
          />
        </SidebarProvider>
      </CommandMenuProvider>
    </HeaderActionsProvider>
  );
}
