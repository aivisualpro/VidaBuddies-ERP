"use client";

import { useEffect, useState, useCallback } from "react";
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
  Bell,
  CalendarClock,
  Ship,
  Inbox,
  CheckCheck,
  Sparkles,
  RefreshCw,
  ExternalLink,
  Tag,
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

/* ── Empty state component ────────────────────────────────── */
function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof CalendarClock;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60 mb-4">
        <Icon className="h-7 w-7 text-muted-foreground/50" />
      </div>
      <h4 className="text-sm font-semibold text-foreground/80 mb-1">{title}</h4>
      <p className="text-xs text-muted-foreground max-w-[260px] leading-relaxed">
        {description}
      </p>
    </div>
  );
}

/* ── Shimmer skeleton rows ────────────────────────────────── */
function ReminderSkeleton() {
  return (
    <div className="p-3 space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-3 rounded-xl p-3 animate-pulse">
          <div className="h-9 w-9 rounded-xl bg-muted/60 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-3/4 rounded bg-muted/60" />
            <div className="h-3 w-full rounded bg-muted/40" />
            <div className="flex gap-2">
              <div className="h-4 w-14 rounded-md bg-muted/50" />
              <div className="h-4 w-20 rounded-md bg-muted/40" />
            </div>
          </div>
        </div>
      ))}
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
      onClick={() => onNavigate(item.link || "/admin/active-actions", item.id)}
      className={cn(
        "group relative flex gap-3 rounded-xl p-3",
        item.read
          ? "bg-transparent hover:bg-muted/20"
          : "bg-muted/30 hover:bg-muted/50",
        "border border-transparent hover:border-border/50",
        "transition-all duration-200 cursor-pointer"
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
          {/* Status pill */}
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

          {/* Category */}
          {category && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground/70 bg-muted/40 px-1.5 py-0.5 rounded-md">
              <Tag className="h-2.5 w-2.5" />
              {category}
            </span>
          )}

          {/* VB Number */}
          {vbNumber && (
            <span className="text-[10px] text-primary/70 font-medium bg-primary/5 px-1.5 py-0.5 rounded-md">
              {vbNumber}
            </span>
          )}

          {/* Serial */}
          {serialNumber && (
            <span className="text-[10px] text-muted-foreground/60 bg-muted/30 px-1.5 py-0.5 rounded-md">
              {serialNumber}
            </span>
          )}

          {/* Relative time */}
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

/* ── Reminders Tab ────────────────────────────────────────── */
function RemindersTab() {
  const [reminders, setReminders] = useState<BellNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const setItems = useNotificationStore((s) => s.setItems);
  const markRead = useNotificationStore((s) => s.markRead);
  const router = useRouter();

  const fetchReminders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/notifications/reminders");
      if (!res.ok) throw new Error("Failed");
      const data: BellNotification[] = await res.json();
      setReminders(data);
      // Also update the store so the bell badge reflects the count
      setItems(data);
    } catch (err) {
      console.error("[Reminders] Fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, [setItems]);

  const syncAndRefresh = useCallback(async () => {
    setSyncing(true);
    try {
      await fetch("/api/notifications/reminders/sync", { method: "POST" });
      await fetchReminders();
    } catch (err) {
      console.error("[Reminders] Sync failed:", err);
    } finally {
      setSyncing(false);
    }
  }, [fetchReminders]);

  // Fetch on mount
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

  if (loading) return <ReminderSkeleton />;

  if (reminders.length === 0) {
    return (
      <EmptyState
        icon={CalendarClock}
        title="All caught up!"
        description="You'll see reminders here when they're due. Open or In Progress items with a reminder date will appear automatically."
      />
    );
  }

  return (
    <div className="p-3 space-y-2">
      {/* Tab header */}
      <div className="flex items-center justify-between px-1 pb-1">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          {reminders.length} due today
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={syncAndRefresh}
          disabled={syncing}
          className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground gap-1"
        >
          <RefreshCw
            className={cn("h-3 w-3", syncing && "animate-spin")}
          />
          Refresh
        </Button>
      </div>

      {/* Reminder cards */}
      {reminders.map((item) => (
        <ReminderCard
          key={item.id}
          item={item}
          onNavigate={handleNavigate}
        />
      ))}
    </div>
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
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => markAllRead()}
                className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1.5"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </Button>
            )}
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
                icon={Ship}
                title="No shipment updates yet"
                description="Coming soon — we'll wire this up next. You'll see live shipment status changes here."
              />
            </ScrollArea>
          </TabsContent>

          <TabsContent
            value="all"
            className="flex-1 min-h-0 mt-0"
          >
            <ScrollArea className="h-full">
              <EmptyState
                icon={Inbox}
                title="Inbox zero. Nice."
                description="Coming soon — we'll wire this up next. All system notifications will appear here."
              />
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {/* ── Footer ──────────────────────────────── */}
        <div className="border-t border-border/50 px-5 py-3">
          <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground/60">
            <Sparkles className="h-3 w-3" />
            <span>Press <kbd className="px-1 py-0.5 rounded bg-muted text-[9px] font-mono font-bold">N</kbd> to toggle</span>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
