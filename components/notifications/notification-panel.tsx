"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Bell,
  BellRing,
  CalendarClock,
  Ship,
  Inbox,
  CheckCheck,
  Sparkles,
  RefreshCw,
  ExternalLink,
  Tag,
  BellOff,
  Search,
} from "lucide-react";
import { useNotificationStore } from "@/lib/stores/notification-store";
import type { BellNotification } from "@/lib/notifications/types";
import { cn } from "@/lib/utils";

/* ── Relative time helper ──────────────────────────────────── */
function relativeTime(isoDate: string): string {
  const now = Date.now();
  const target = new Date(isoDate).getTime();
  const diffMs = now - target;
  const absDiff = Math.abs(diffMs);

  const minutes = Math.floor(absDiff / 60000);
  const hours = Math.floor(absDiff / 3600000);
  const days = Math.floor(absDiff / 86400000);

  let timeStr: string;
  if (minutes < 1) timeStr = "just now";
  else if (minutes < 60) timeStr = `${minutes}m`;
  else if (hours < 24) timeStr = `${hours}h`;
  else timeStr = `${days}d`;

  if (diffMs > 0) return `Due ${timeStr} ago`;
  if (minutes < 1) return "Due now";
  return `Due in ${timeStr}`;
}

/* ── Inline SVG Empty States ──────────────────────────────── */
function RemindersEmptyIllustration() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="40" r="36" fill="currentColor" opacity="0.04" />
      <circle cx="40" cy="40" r="24" fill="currentColor" opacity="0.06" />
      <path d="M40 22C33 22 27.5 27.5 27.5 34.5V42L24 48H56L52.5 42V34.5C52.5 27.5 47 22 40 22Z" stroke="currentColor" opacity="0.25" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M35 48C35 50.76 37.24 53 40 53C42.76 53 45 50.76 45 48" stroke="currentColor" opacity="0.25" strokeWidth="2" strokeLinecap="round" />
      <path d="M32 36L38 42L48 30" stroke="currentColor" opacity="0.4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ShipEmptyIllustration() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="40" r="36" fill="currentColor" opacity="0.04" />
      <circle cx="40" cy="40" r="24" fill="currentColor" opacity="0.06" />
      <path d="M20 50L26 32H54L60 50" stroke="currentColor" opacity="0.25" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 50H60L56 56H24L20 50Z" stroke="currentColor" opacity="0.25" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="34" y="26" width="12" height="10" rx="1" stroke="currentColor" opacity="0.2" strokeWidth="1.5" />
      <line x1="40" y1="26" x2="40" y2="22" stroke="currentColor" opacity="0.2" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function InboxEmptyIllustration() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="40" r="36" fill="currentColor" opacity="0.04" />
      <circle cx="40" cy="40" r="24" fill="currentColor" opacity="0.06" />
      <rect x="26" y="24" width="28" height="32" rx="3" stroke="currentColor" opacity="0.25" strokeWidth="2" />
      <path d="M26 44H34L37 48H43L46 44H54" stroke="currentColor" opacity="0.2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M36 34L39 37L44 31" stroke="currentColor" opacity="0.4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EmptyState({
  illustration: Illustration,
  title,
  description,
}: {
  illustration: React.FC;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center text-muted-foreground">
      <Illustration />
      <h4 className="text-sm font-semibold text-foreground/80 mb-1 mt-3">{title}</h4>
      <p className="text-xs text-muted-foreground max-w-[260px] leading-relaxed">
        {description}
      </p>
    </div>
  );
}

/* ── Shimmer skeleton rows ────────────────────────────────── */
function ReminderSkeleton() {
  return (
    <div className="p-3 space-y-2" role="status" aria-label="Loading reminders">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-3 rounded-xl p-3 animate-pulse">
          <div className="h-9 w-9 rounded-xl bg-muted/60 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-3/4 rounded bg-muted/60" />
            <div className="h-3 w-full rounded bg-muted/40" />
            <div className="flex gap-2">
              <div className="h-4 w-14 rounded-md bg-muted/50" />
              <div className="h-4 w-20 rounded-md bg-muted/40" />
              <div className="h-4 w-16 rounded-md bg-muted/30 ml-auto" />
            </div>
          </div>
        </div>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/* ── Reminder card row ────────────────────────────────────── */
function ReminderCard({
  item,
  onNavigate,
}: {
  item: BellNotification;
  onNavigate: (link: string, id: string) => void;
}) {
  const status = (item.meta?.status as string) || "Open";
  const category = item.meta?.category as string | null;
  const vbNumber = item.meta?.VBNumber as string | null;
  const serialNumber = item.meta?.VBSerialNumber as string | null;
  const isOverdue = new Date(item.createdAt).getTime() < Date.now();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onNavigate(item.link || "/admin/active-actions", item.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onNavigate(item.link || "/admin/active-actions", item.id);
        }
      }}
      aria-label={`${item.title}. ${status}. ${relativeTime(item.createdAt)}`}
      className={cn(
        "group relative flex gap-3 rounded-xl p-3",
        item.read
          ? "bg-transparent hover:bg-muted/20"
          : "bg-muted/30 hover:bg-muted/50",
        "border border-transparent hover:border-border/50",
        "transition-all duration-200 cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1"
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
          isOverdue ? "bg-red-500/10" : "bg-amber-500/10"
        )}
      >
        <CalendarClock
          className={cn(
            "h-4 w-4",
            isOverdue ? "text-red-500" : "text-amber-500"
          )}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm font-semibold text-foreground line-clamp-1",
            item.read && "font-medium text-foreground/70"
          )}
        >
          {item.title}
        </p>
        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
          {item.message}
        </p>

        {/* Chips row */}
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          <span
            className={cn(
              "text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md",
              status === "Open"
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
            )}
          >
            {status}
          </span>

          {category && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground/70 bg-muted/40 px-1.5 py-0.5 rounded-md">
              <Tag className="h-2.5 w-2.5" />
              {category}
            </span>
          )}

          {vbNumber && (
            <span className="text-[10px] text-primary/70 font-medium bg-primary/5 px-1.5 py-0.5 rounded-md">
              {vbNumber}
            </span>
          )}

          {serialNumber && (
            <span className="text-[10px] text-muted-foreground/60 bg-muted/30 px-1.5 py-0.5 rounded-md">
              {serialNumber}
            </span>
          )}

          <span
            className={cn(
              "text-[10px] ml-auto",
              isOverdue
                ? "text-red-500/80 font-semibold"
                : "text-muted-foreground/60"
            )}
          >
            {relativeTime(item.createdAt)}
          </span>
        </div>
      </div>

      {/* Unread dot / Open link */}
      <div className="flex flex-col items-end justify-between shrink-0">
        {!item.read && (
          <span className="block h-2 w-2 rounded-full bg-primary/60" />
        )}
        <ExternalLink className="h-3 w-3 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}

/* ── Filter type ──────────────────────────────────────────── */
type ReminderFilter = "all" | "overdue" | "today";

/* ── Reminders Tab ────────────────────────────────────────── */
function RemindersTab() {
  const [reminders, setReminders] = useState<BellNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState<ReminderFilter>("all");
  const [search, setSearch] = useState("");

  const setItems = useNotificationStore((s) => s.setItems);
  const markRead = useNotificationStore((s) => s.markRead);
  const isCacheFresh = useNotificationStore((s) => s.isCacheFresh);
  const invalidateCache = useNotificationStore((s) => s.invalidateCache);
  const cachedItems = useNotificationStore((s) => s.items);
  const router = useRouter();

  const fetchReminders = useCallback(async (force = false) => {
    // Use cache if fresh and not forced
    if (!force && isCacheFresh() && cachedItems.length > 0) {
      setReminders(cachedItems);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/notifications/reminders");
      if (!res.ok) throw new Error("Failed");
      const data: BellNotification[] = await res.json();
      setReminders(data);
      setItems(data);
    } catch (err) {
      console.error("[Reminders] Fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, [setItems, isCacheFresh, cachedItems]);

  const syncAndRefresh = useCallback(async () => {
    setSyncing(true);
    try {
      invalidateCache();
      await fetch("/api/notifications/reminders/sync", { method: "POST" });
      await fetchReminders(true);
    } catch (err) {
      console.error("[Reminders] Sync failed:", err);
    } finally {
      setSyncing(false);
    }
  }, [fetchReminders, invalidateCache]);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  const handleNavigate = useCallback(
    (link: string, id: string) => {
      markRead(id);
      router.push(link);
      useNotificationStore.getState().setOpen(false);
    },
    [markRead, router]
  );

  // Filter + search
  const filtered = useMemo(() => {
    const now = Date.now();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    let result = reminders;

    // Time filter
    if (filter === "overdue") {
      result = result.filter((r) => new Date(r.createdAt).getTime() < now);
    } else if (filter === "today") {
      result = result.filter((r) => {
        const t = new Date(r.createdAt).getTime();
        return t >= startOfToday.getTime();
      });
    }

    // Text search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.message.toLowerCase().includes(q) ||
          String(r.meta?.VBNumber || "").toLowerCase().includes(q) ||
          String(r.meta?.category || "").toLowerCase().includes(q)
      );
    }

    return result;
  }, [reminders, filter, search]);

  if (loading) return <ReminderSkeleton />;

  if (reminders.length === 0) {
    return (
      <EmptyState
        illustration={RemindersEmptyIllustration}
        title="All caught up!"
        description="You'll see reminders here when they're due. Open or In Progress items with a reminder date will appear automatically."
      />
    );
  }

  const overdueCount = reminders.filter(
    (r) => new Date(r.createdAt).getTime() < Date.now()
  ).length;

  return (
    <div className="p-3 space-y-2">
      {/* Tab header with count + refresh */}
      <div className="flex items-center justify-between px-1 pb-1">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          {reminders.length} due today
          {overdueCount > 0 && (
            <span className="text-red-500/80 ml-1">
              ({overdueCount} overdue)
            </span>
          )}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={syncAndRefresh}
          disabled={syncing}
          className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground gap-1"
          aria-label="Refresh reminders"
        >
          <RefreshCw
            className={cn("h-3 w-3", syncing && "animate-spin")}
          />
          Refresh
        </Button>
      </div>

      {/* Filter chips + search */}
      <div className="flex items-center gap-1.5 px-1">
        {(["all", "overdue", "today"] as ReminderFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "text-[10px] font-medium px-2 py-1 rounded-full transition-all duration-150",
              "border",
              filter === f
                ? "bg-primary/10 text-primary border-primary/20"
                : "bg-transparent text-muted-foreground/70 border-transparent hover:bg-muted/40 hover:border-border/40"
            )}
          >
            {f === "all" ? "All" : f === "overdue" ? "Overdue" : "Today"}
          </button>
        ))}

        <div className="relative ml-auto">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/40" />
          <input
            type="text"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              "h-6 w-28 pl-6 pr-2 text-[10px] rounded-full",
              "bg-muted/30 border border-transparent",
              "text-foreground placeholder:text-muted-foreground/40",
              "focus:outline-none focus:border-primary/30 focus:bg-muted/50",
              "transition-all duration-200"
            )}
            aria-label="Search reminders"
          />
        </div>
      </div>

      {/* Reminder cards */}
      {filtered.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-xs text-muted-foreground/60">
            No reminders match your filter.
          </p>
        </div>
      ) : (
        filtered.map((item) => (
          <ReminderCard
            key={item.id}
            item={item}
            onNavigate={handleNavigate}
          />
        ))
      )}
    </div>
  );
}

/* ── Push Permission Pill ─────────────────────────────────── */
function PushPermissionPill() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);
  }, []);

  const handleEnable = useCallback(async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;

    setSubscribing(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result !== "granted") {
        setSubscribing(false);
        return;
      }

      const registration = await navigator.serviceWorker.ready;

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        console.warn("[Push] No VAPID public key configured");
        setSubscribing(false);
        return;
      }

      const urlBase64ToUint8Array = (base64String: string) => {
        const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding)
          .replace(/-/g, "+")
          .replace(/_/g, "/");
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; i++) {
          outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
      };

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      const subJSON = subscription.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subJSON.endpoint,
          keys: subJSON.keys,
        }),
      });
    } catch (err) {
      console.error("[Push] Subscribe error:", err);
    } finally {
      setSubscribing(false);
    }
  }, []);

  if (permission === "granted") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full">
        <BellRing className="h-3 w-3" />
        Push on
      </span>
    );
  }

  if (permission === "denied") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground/60 bg-muted/30 px-2 py-1 rounded-full cursor-help">
            <BellOff className="h-3 w-3" />
            Push blocked
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[240px] text-xs">
          <p>
            Push notifications are blocked. To re-enable, click the 🔒 icon
            in your browser address bar → Notifications → Allow.
          </p>
        </TooltipContent>
      </Tooltip>
    );
  }

  if (permission === "unsupported") return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleEnable}
      disabled={subscribing}
      className={cn(
        "h-6 px-2.5 text-[10px] font-medium gap-1 rounded-full",
        "bg-primary/5 text-primary hover:bg-primary/10",
        "border border-primary/20",
        "transition-all duration-200"
      )}
    >
      <BellRing className={cn("h-3 w-3", subscribing && "animate-pulse")} />
      {subscribing ? "Enabling…" : "Enable push"}
    </Button>
  );
}

/* ── Main Panel ───────────────────────────────────────────── */
export function NotificationPanel() {
  const open = useNotificationStore((s) => s.open);
  const setOpen = useNotificationStore((s) => s.setOpen);
  const activeTab = useNotificationStore((s) => s.activeTab);
  const setActiveTab = useNotificationStore((s) => s.setActiveTab);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const markAllRead = useNotificationStore((s) => s.markAllRead);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="left"
        className="w-[420px] sm:w-[460px] sm:max-w-[460px] p-0 flex flex-col"
        aria-live="polite"
        aria-label="Notifications panel"
      >
        {/* ── Header ──────────────────────────────────── */}
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <SheetTitle className="text-lg font-bold">
                Notifications
              </SheetTitle>
              {unreadCount > 0 && (
                <span className="flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <PushPermissionPill />
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => markAllRead()}
                  className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1.5"
                  aria-label="Mark all notifications as read"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark all read
                </Button>
              )}
            </div>
          </div>
          <SheetDescription className="sr-only">
            View and manage your notifications
          </SheetDescription>
        </SheetHeader>

        {/* ── Tabs ─────────────────────────────────── */}
        <Tabs
          value={activeTab}
          onValueChange={(v) =>
            setActiveTab(v as "reminders" | "shipments" | "all")
          }
          className="flex-1 flex flex-col min-h-0"
        >
          <div className="px-4 pt-3 pb-1">
            <TabsList className="w-full h-9">
              <TabsTrigger value="reminders" className="text-xs gap-1.5">
                <CalendarClock className="h-3.5 w-3.5" />
                Reminders
              </TabsTrigger>
              <TabsTrigger value="shipments" className="text-xs gap-1.5">
                <Ship className="h-3.5 w-3.5" />
                Shipment updates
              </TabsTrigger>
              <TabsTrigger value="all" className="text-xs gap-1.5">
                <Bell className="h-3.5 w-3.5" />
                Notifications
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ── Tab bodies ─────────────────────────── */}
          <TabsContent
            value="reminders"
            className="flex-1 min-h-0 mt-0"
          >
            <ScrollArea className="h-full">
              <RemindersTab />
            </ScrollArea>
          </TabsContent>

          <TabsContent
            value="shipments"
            className="flex-1 min-h-0 mt-0"
          >
            <ScrollArea className="h-full">
              <EmptyState
                illustration={ShipEmptyIllustration}
                title="No shipment updates yet"
                description="Coming soon — you'll see live shipment status changes here."
              />
            </ScrollArea>
          </TabsContent>

          <TabsContent
            value="all"
            className="flex-1 min-h-0 mt-0"
          >
            <ScrollArea className="h-full">
              <EmptyState
                illustration={InboxEmptyIllustration}
                title="Inbox zero. Nice."
                description="Coming soon — all system notifications will appear here."
              />
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {/* ── Footer ──────────────────────────────── */}
        <div className="border-t border-border/50 px-5 py-3">
          <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground/60">
            <Sparkles className="h-3 w-3" />
            <span>Press <kbd className="px-1 py-0.5 rounded bg-muted text-[9px] font-mono font-bold">N</kbd> to toggle • <kbd className="px-1 py-0.5 rounded bg-muted text-[9px] font-mono font-bold">ESC</kbd> to close</span>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
