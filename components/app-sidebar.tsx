"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  IconBell,
  IconBuildingStore,
  IconBuildingWarehouse,
  IconCheckbox,
  IconClipboardList,
  IconDashboard,
  IconFileDescription,
  IconListDetails,
  IconPackage,
  IconRoute,
  IconSearch,
  IconSettings,
  IconShoppingCart,
  IconTruck,
  IconUser,
  IconChartBar,
  IconCalculator,
  IconCurrencyDollar,
  IconFileInvoice,
} from "@tabler/icons-react";

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

const data = {
  user: {
    name: "",
    email: "",
    avatar: "",
  },
  navSecondary: [
    {
      title: "Notifications",
      url: "/admin/notifications",
      icon: IconBell,
    },
    {
      title: "Settings",
      url: "/admin/settings",
      icon: IconSettings,
    },
  ],
  admin: [
    {
      name: "Dashboard",
      url: "/dashboard",
      icon: IconDashboard,
    },
    {
      name: "Users",
      url: "/admin/users",
      icon: IconUser,
    },
    {
      name: "Customers",
      url: "/admin/customers",
      icon: IconBuildingStore,
    },
  ],
  inventory: [
    {
      name: "Warehouse",
      url: "/inventory/warehouse",
      icon: IconBuildingWarehouse,
    },
    {
      name: "Categories",
      url: "/inventory/categories",
      icon: IconListDetails,
    },
    {
      name: "Products",
      url: "/inventory/products",
      icon: IconPackage,
    },
    {
      name: "Release Requests",
      url: "/inventory/release-requests",
      icon: IconFileDescription,
    },
  ],
  management: [
    {
      name: "Purchase Orders",
      url: "/admin/purchase-orders",
      icon: IconShoppingCart,
    },
    {
      name: "Quality Control",
      url: "/quality-control",
      icon: IconCheckbox,
    },
  ],
  sales: [
    {
      name: "Sales Dashboard",
      url: "/admin/sales/dashboard",
      icon: IconChartBar,
    },
    {
      name: "Quote Builder",
      url: "/admin/sales/quote-builder",
      icon: IconCalculator,
    },
    {
      name: "Supplier Pricing",
      url: "/admin/sales/supplier-pricing",
      icon: IconCurrencyDollar,
    },
    {
      name: "Freight",
      url: "/admin/sales/freight",
      icon: IconTruck,
    },
    {
      name: "Shipment Tracking",
      url: "/admin/sales/shipment-tracking",
      icon: IconRoute,
    },
    {
      name: "Accounting",
      url: "/admin/sales/accounting",
      icon: IconFileInvoice,
    },
  ],
  reports: [
    {
      name: "Andres Tracker",
      url: "/admin/andres-tracker",
      icon: IconClipboardList,
    },
    {
      name: "Live Shipments",
      url: "/admin/live-shipments",
      icon: IconRoute,
    },
  ],
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
  const [reports, setReports] = React.useState(data.reports);
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
  }, [isSupplierProp]);

  const filterItems = (items: any[]) => {
    if (loadingPermissions) return []; // Show nothing while loading to prevent flash
    if (isSupplier) return []; // Suppliers see nothing in sidebar
    if (isAdmin) return items; // Super Admin sees all

    return items.filter(item => {
      const itemName = item.name || item.title;

      const perm = permissions.find((p: any) => p.module === itemName);
      // If permission entry exists, check view action.
      if (perm) {
        return perm.actions?.view === true;
      }

      // Fallback: If no permission record exists for this module, what to do?
      // Defaulting to FALSE prevents unauthorized users from seeing everything if their permission load failed or is incomplete.
      return false;
    });
  };

  const filteredAdmin = filterItems(data.admin);
  const filteredInventory = filterItems(data.inventory);
  const filteredManagement = filterItems(data.management);
  const filteredSales = filterItems(data.sales);
  const filteredReports = filterItems(reports);
  const filteredSecondary = filterItems(data.navSecondary);

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
        <NavUser user={data.user} isSupplier={isSupplier} />
      </SidebarFooter>
    </Sidebar>
  );
}
