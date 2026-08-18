import {
  IconBell,
  IconBuildingStore,
  IconBuildingWarehouse,
  IconCalculator,
  IconChartBar,
  IconCheckbox,
  IconClipboardList,
  IconCurrencyDollar,
  IconDashboard,
  IconFileDescription,
  IconFileInvoice,
  IconListDetails,
  IconMessage,
  IconPackage,
  IconRoute,
  IconSettings,
  IconShoppingCart,
  IconTruck,
  IconUser,
  type Icon,
} from "@tabler/icons-react";

/**
 * The application's navigation registry.
 *
 * This is the single source of truth consumed by the sidebar, the command
 * palette and the title bar breadcrumb. Adding a destination in one place keeps
 * all three in step — and, more importantly, keeps the permission filter
 * identical everywhere, so the palette can never surface a route the sidebar
 * has hidden.
 */

export interface NavItem {
  /** Display name. Also the key the RBAC permission records are matched on. */
  name: string;
  url: string;
  icon: Icon;
  /** Extra terms the command palette should match on. Never rendered. */
  keywords?: string[];
  badge?: number | string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_ADMIN: NavItem[] = [
  { name: "Dashboard", url: "/dashboard", icon: IconDashboard, keywords: ["home", "overview", "kpi"] },
  { name: "Users", url: "/admin/users", icon: IconUser, keywords: ["staff", "team", "accounts", "rbac"] },
  { name: "Customers", url: "/admin/customers", icon: IconBuildingStore, keywords: ["clients", "buyers", "accounts"] },
  { name: "Active Actions", url: "/admin/active-actions", icon: IconCheckbox, keywords: ["tasks", "todo", "timeline", "open"] },
  { name: "Documents Box", url: "/admin/documents-box", icon: IconFileDescription, keywords: ["files", "drive", "attachments"] },
];

export const NAV_INVENTORY: NavItem[] = [
  { name: "Warehouse", url: "/inventory/warehouse", icon: IconBuildingWarehouse, keywords: ["stock", "storage", "bins"] },
  { name: "Categories", url: "/inventory/categories", icon: IconListDetails, keywords: ["taxonomy", "subcategories", "groups"] },
  { name: "Products", url: "/inventory/products", icon: IconPackage, keywords: ["sku", "items", "catalog"] },
  { name: "Transfer Orders", url: "/inventory/transfer-orders", icon: IconRoute, keywords: ["move", "stock transfer", "to"] },
  { name: "Release Requests", url: "/inventory/release-requests", icon: IconFileDescription, keywords: ["release", "approval", "outbound"] },
  { name: "Inventory Mgt.", url: "/inventory/management", icon: IconClipboardList, keywords: ["inventory", "management", "counts", "adjustments"] },
];

export const NAV_MANAGEMENT: NavItem[] = [
  { name: "Purchase Orders", url: "/admin/purchase-orders", icon: IconShoppingCart, keywords: ["po", "procurement", "supplier order"] },
  { name: "Customer POs", url: "/admin/customer-pos", icon: IconClipboardList, keywords: ["cpo", "sales order", "demand"] },
  { name: "Shipments", url: "/admin/shipments", icon: IconTruck, keywords: ["freight", "containers", "logistics", "bl"] },
  { name: "Quality Control", url: "/quality-control", icon: IconCheckbox, keywords: ["qc", "inspection", "specs", "compliance"] },
];

export const NAV_SALES: NavItem[] = [
  { name: "Sales Dashboard", url: "/admin/sales/dashboard", icon: IconChartBar, keywords: ["revenue", "pipeline", "targets"] },
  { name: "Quote Builder", url: "/admin/sales/quote-builder", icon: IconCalculator, keywords: ["quotation", "pricing", "estimate"] },
  { name: "Supplier Pricing", url: "/admin/sales/supplier-pricing", icon: IconCurrencyDollar, keywords: ["cost", "rates", "vendor price"] },
  { name: "Freight Requests", url: "/admin/sales/freight-requests", icon: IconTruck, keywords: ["shipping quote", "forwarder", "rates"] },
  { name: "Shipment Tracking", url: "/admin/sales/shipment-tracking", icon: IconRoute, keywords: ["track", "eta", "vessel", "container"] },
  { name: "Accounting", url: "/admin/sales/accounting", icon: IconFileInvoice, keywords: ["invoice", "finance", "ledger", "payments"] },
];

export const NAV_REPORTS: NavItem[] = [
  { name: "Andres Tracker", url: "/admin/andres-tracker", icon: IconClipboardList, keywords: ["report", "tracker"] },
  { name: "Live Shipments", url: "/admin/live-shipments", icon: IconRoute, keywords: ["in transit", "map", "vessel", "live"] },
];

export const NAV_SECONDARY: NavItem[] = [
  { name: "Chat", url: "/admin/chat", icon: IconMessage, keywords: ["messages", "dm", "whatsapp", "inbox"] },
  { name: "Notifications", url: "/admin/notifications", icon: IconBell, keywords: ["alerts", "bell", "updates"] },
  { name: "Settings", url: "/admin/settings", icon: IconSettings, keywords: ["preferences", "config", "admin"] },
];

/** Ordered for both the sidebar and the command palette. */
export const NAV_GROUPS: NavGroup[] = [
  { label: "Admin", items: NAV_ADMIN },
  { label: "Inventory", items: NAV_INVENTORY },
  { label: "Management", items: NAV_MANAGEMENT },
  { label: "Sales", items: NAV_SALES },
  { label: "Reports", items: NAV_REPORTS },
  { label: "Workspace", items: NAV_SECONDARY },
];

/* -------------------------------------------------------------------------- */
/* Access control                                                             */
/* -------------------------------------------------------------------------- */

export interface NavAccess {
  isAdmin: boolean;
  isSupplier: boolean;
  permissions: Array<{ module?: string; actions?: { view?: boolean } }>;
  /** Suppress everything while permissions are still loading, to avoid a flash. */
  loading?: boolean;
}

/**
 * Filters navigation destinations against a user's RBAC record.
 *
 * Deliberately fails closed: a module with no matching permission entry is
 * hidden rather than shown. A partially-loaded permission set should never
 * expose a route the user cannot open.
 */
export function filterNavItems<T extends { name: string }>(
  items: T[],
  { isAdmin, isSupplier, permissions, loading = false }: NavAccess
): T[] {
  if (loading) return [];
  if (isSupplier) return [];
  if (isAdmin) return items;

  return items.filter((item) => {
    const permission = permissions.find((entry) => entry?.module === item.name);
    return permission?.actions?.view === true;
  });
}

/* -------------------------------------------------------------------------- */
/* Route labelling                                                            */
/* -------------------------------------------------------------------------- */

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

/** Segments whose humanised form reads badly or wrongly. */
const SEGMENT_LABELS: Record<string, string> = {
  admin: "Admin",
  "customer-pos": "Customer POs",
  "purchase-orders": "Purchase Orders",
  "andres-tracker": "Andres Tracker",
  "quality-control": "Quality Control",
  qc: "QC",
  po: "PO",
};

/** Exact URL → the name the sidebar uses for it. */
const ROUTE_LABELS = new Map<string, string>(
  NAV_GROUPS.flatMap((group) => group.items.map((item) => [item.url, item.name] as const))
);

function humanise(segment: string): string {
  if (OBJECT_ID.test(segment)) return "Detail";
  return segment
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export interface Crumb {
  label: string;
  href: string;
  /** The last crumb — the page you are actually on. */
  current: boolean;
  /**
   * Whether `href` is a real destination. Group folders such as `/admin` and
   * `/inventory` are routing artefacts with no page behind them, so linking
   * them would hand the user a 404.
   */
  linkable: boolean;
}

/**
 * Turns a pathname into a breadcrumb trail, preferring registry names over
 * naive segment humanising so "customer-pos" reads as "Customer POs".
 */
export function buildBreadcrumbs(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) {
    return [{ label: "Dashboard", href: "/dashboard", current: true, linkable: true }];
  }

  const crumbs: Crumb[] = [];
  let href = "";

  for (let index = 0; index < segments.length; index += 1) {
    href += `/${segments[index]}`;

    const registered = ROUTE_LABELS.get(href);
    const label = registered ?? SEGMENT_LABELS[segments[index]] ?? humanise(segments[index]);

    crumbs.push({ label, href, current: false, linkable: registered !== undefined });
  }

  crumbs[crumbs.length - 1].current = true;
  return crumbs;
}

/** The page title for the current route — the last breadcrumb. */
export function resolvePageTitle(pathname: string): string {
  const crumbs = buildBreadcrumbs(pathname);
  return crumbs[crumbs.length - 1]?.label ?? "Dashboard";
}
