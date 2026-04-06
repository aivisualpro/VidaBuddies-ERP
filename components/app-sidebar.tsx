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
    {
      title: "Search",
      url: "#",
      icon: IconSearch,
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

// localStorage keys
const LS_KEY_PERMISSIONS = 'vb_sidebar_permissions';
const LS_KEY_ADMIN = 'vb_sidebar_isAdmin';
const LS_KEY_SUPPLIER = 'vb_sidebar_isSupplier';
const LS_KEY_SHIPCOUNT = 'vb_sidebar_shipmentCount';
const LS_KEY_TIMESTAMP = 'vb_sidebar_ts';

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Try to read from localStorage synchronously to prevent flash
function getLocalStorageCache(): {
  permissions: any[];
  isAdmin: boolean;
  isSupplier: boolean;
  shipmentCount: number;
} | null {
  try {
    const ts = localStorage.getItem(LS_KEY_TIMESTAMP);
    if (!ts || Date.now() - parseInt(ts) > CACHE_DURATION) return null;
    
    return {
      permissions: JSON.parse(localStorage.getItem(LS_KEY_PERMISSIONS) || '[]'),
      isAdmin: localStorage.getItem(LS_KEY_ADMIN) === 'true',
      isSupplier: localStorage.getItem(LS_KEY_SUPPLIER) === 'true',
      shipmentCount: parseInt(localStorage.getItem(LS_KEY_SHIPCOUNT) || '0'),
    };
  } catch {
    return null;
  }
}

function saveToLocalStorage(data: { permissions: any[]; isAdmin: boolean; isSupplier: boolean; shipmentCount: number }) {
  try {
    localStorage.setItem(LS_KEY_PERMISSIONS, JSON.stringify(data.permissions));
    localStorage.setItem(LS_KEY_ADMIN, String(data.isAdmin));
    localStorage.setItem(LS_KEY_SUPPLIER, String(data.isSupplier));
    localStorage.setItem(LS_KEY_SHIPCOUNT, String(data.shipmentCount));
    localStorage.setItem(LS_KEY_TIMESTAMP, String(Date.now()));
  } catch { /* quota exceeded or private mode */ }
}

export function AppSidebar({ isSupplierProp = false, ...props }: React.ComponentProps<typeof Sidebar> & { isSupplierProp?: boolean }) {
  const [reports, setReports] = React.useState(data.reports);
  const [permissions, setPermissions] = React.useState<any[]>([]);
  // Default to isAdmin=true so server + client initial render both show all items (no mismatch)
  const [isAdmin, setIsAdmin] = React.useState(!isSupplierProp);
  const [isSupplier, setIsSupplier] = React.useState(isSupplierProp);
  // Never start in loading state — avoids empty sidebar on initial render
  const [loadingPermissions, setLoadingPermissions] = React.useState(false);

  // Step 1: Read localStorage BEFORE browser paints (client-only, synchronous)
  // This applies cached permissions instantly with zero visual flash
  React.useLayoutEffect(() => {
    if (isSupplierProp) return;
    const cached = getLocalStorageCache();
    if (cached) {
      setPermissions(cached.permissions);
      setIsAdmin(cached.isAdmin);
      setIsSupplier(cached.isSupplier);
      if (cached.shipmentCount > 0) {
        setReports(prev => prev.map(item =>
          item.name === "Live Shipments" ? { ...item, badge: cached.shipmentCount } : item
        ));
      }
    }
  }, []);

  // Step 2: Background fetch latest permissions from API (non-blocking)
  React.useEffect(() => {
    if (isSupplierProp) return;

    const fetchData = async () => {
      try {
        let shipmentCount = 0;
        let fetchedPermissions: any[] = [];
        let fetchedIsAdmin = false;
        let fetchedIsSupplier = false;

        const [countRes, permRes] = await Promise.all([
          fetch('/api/admin/live-shipments/count'),
          fetch('/api/user/permissions'),
        ]);

        if (countRes.ok) {
          const { count } = await countRes.json();
          shipmentCount = count;
          if (count > 0) {
            setReports(prev => prev.map(item =>
              item.name === "Live Shipments"
                ? { ...item, badge: count }
                : item
            ));
          }
        }

        if (permRes.ok) {
          const data = await permRes.json();

          if (data.isSupplier) {
            fetchedIsSupplier = true;
            setIsSupplier(true);
          } else {
            fetchedPermissions = data.permissions || [];
            if (data.role === 'Super Admin') {
              fetchedIsAdmin = true;
            }
          }

          setPermissions(fetchedPermissions);
          setIsAdmin(fetchedIsAdmin);
        }

        saveToLocalStorage({
          permissions: fetchedPermissions,
          isAdmin: fetchedIsAdmin,
          isSupplier: fetchedIsSupplier,
          shipmentCount,
        });
      } catch (error) {
        console.error("Failed to fetch sidebar data", error);
      }
    };

    fetchData();
  }, []);

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
        {filteredReports.length > 0 && <NavDocuments items={filteredReports} label="Reports" />}
        {filteredSecondary.length > 0 && <NavSecondary items={filteredSecondary} className="mt-auto" />}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} isSupplier={isSupplier} />
      </SidebarFooter>
    </Sidebar>
  );
}
