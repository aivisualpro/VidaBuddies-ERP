import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { HeaderActionsProvider } from "@/components/providers/header-actions-provider";
import { cookies } from "next/headers";
import { getSession, logout } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import VidaUser from "@/lib/models/VidaUser";
import { redirect } from "next/navigation";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  
  // Extra security: Verify status in database on every page load
  if (session) {
    await connectToDatabase();
    const user = await VidaUser.findById(session.id);
    if (!user || !user.isActive) {
      await logout();
      redirect("/login");
    }
  }

  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

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
        <AppSidebar variant="inset" />
        <SidebarInset className="flex flex-col h-full overflow-hidden">
          <SiteHeader />
          <div className="flex-1 overflow-hidden p-4">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </HeaderActionsProvider>
  );
}
