"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  NAV_ADMIN,
  NAV_INVENTORY,
  NAV_MANAGEMENT,
  NAV_REPORTS,
  NAV_SALES,
  NAV_SECONDARY,
  filterNavItems,
  type NavItem,
} from "@/lib/navigation";

import { NavDocuments } from "@/components/nav-documents";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const EMPTY_USER = {
  name: "",
  email: "",
  avatar: "",
};

export function AppSidebar({
  isSupplierProp = false,
  initialPermissions = [],
  initialIsAdmin = false,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  isSupplierProp?: boolean,
  initialPermissions?: any[],
  initialIsAdmin?: boolean
}) {
  const [reports, setReports] = React.useState<NavItem[]>(NAV_REPORTS);
  const [adminItems, setAdminItems] = React.useState<NavItem[]>(NAV_ADMIN);
  const [permissions, setPermissions] = React.useState<any[]>(initialPermissions);
  const [isAdmin, setIsAdmin] = React.useState(initialIsAdmin);
  const [isSupplier, setIsSupplier] = React.useState(isSupplierProp);
  const [loadingPermissions, setLoadingPermissions] = React.useState(false);

  // Background fetch latest shipment count (non-blocking)
  React.useEffect(() => {
    if (isSupplierProp) return;

    const fetchShipmentCount = async () => {
      try {
        const countRes = await fetch('/api/admin/live-shipments/count');
        if (countRes.ok) {
          const { count } = await countRes.json();
          if (count > 0) {
            setReports(prev => prev.map(item =>
              item.name === "Live Shipments"
                ? { ...item, badge: count }
                : item
            ));
          }
        }
      } catch (error) {
        console.error("Failed to fetch shipment count", error);
      }
    };

    fetchShipmentCount();

    // Fetch active actions count (Open + In Progress)
    const fetchActiveActionsCount = async () => {
      try {
        const res = await fetch('/api/admin/timeline/count');
        if (res.ok) {
          const { count } = await res.json();
          if (count > 0) {
            setAdminItems(prev => prev.map(item =>
              item.name === "Active Actions"
                ? { ...item, badge: count }
                : item
            ));
          }
        }
      } catch (error) {
        console.error("Failed to fetch active actions count", error);
      }
    };

    fetchActiveActionsCount();
  }, [isSupplierProp]);

  // Same registry, same filter as the ⌘K palette — the two cannot drift apart.
  const access = {
    isAdmin,
    isSupplier,
    permissions,
    loading: loadingPermissions,
  };

  const filteredAdmin = filterNavItems(adminItems, access);
  const filteredInventory = filterNavItems(NAV_INVENTORY, access);
  const filteredManagement = filterNavItems(NAV_MANAGEMENT, access);
  const filteredSales = filterNavItems(NAV_SALES, access);
  const filteredReports = filterNavItems(reports, access);
  const filteredSecondary = filterNavItems(NAV_SECONDARY, access).map((item) => ({
    // NavSecondary predates the shared registry and keys off `title`.
    title: item.name,
    url: item.url,
    icon: item.icon,
  }));

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-0 hover:bg-transparent active:bg-transparent"
              size="lg"
              tooltip="Treetop Dashboard"
            >
              <Link href="/admin/customers" className="flex items-center justify-center p-2 group-data-[collapsible=icon]:p-0">
                <Image
                  src="/sidebar-logo.png"
                  alt="Company Logo"
                  width={150}
                  height={50}
                  className="object-contain w-auto h-8 group-data-[collapsible=icon]:hidden"
                  priority
                />
                <Image
                  src="/sidebar-logo.png"
                  alt="Company Logo"
                  width={40}
                  height={40}
                  className="object-contain w-8 h-8 hidden group-data-[collapsible=icon]:block"
                  priority
                />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {filteredAdmin.length > 0 && <NavDocuments items={filteredAdmin} label="Admin" />}
        {filteredInventory.length > 0 && <NavDocuments items={filteredInventory} label="Inventory" />}
        {filteredManagement.length > 0 && <NavDocuments items={filteredManagement} label="Management" />}
        {filteredSales.length > 0 && <NavDocuments items={filteredSales} label="Sales" />}
        {filteredReports.length > 0 && <NavDocuments items={filteredReports} label="Reports" />}
        {filteredSecondary.length > 0 && <NavSecondary items={filteredSecondary} className="mt-auto" />}
      </SidebarContent>
      <SidebarFooter>
        <p className="text-[10px] text-gray-600 dark:text-gray-400 text-center pt-1 group-data-[collapsible=icon]:hidden">
          V.1.52
        </p>
        <NavUser user={EMPTY_USER} isSupplier={isSupplier} />
      </SidebarFooter>
    </Sidebar>
  );
}
