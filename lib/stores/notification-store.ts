import { create } from "zustand";
import type { BellNotification } from "@/lib/notifications/types";

type TabValue = "reminders" | "shipments" | "all";

export interface NotificationState {
  open: boolean;
  activeTab: TabValue;
  items: BellNotification[];
  unreadCount: number;
  /** True when a brand-new notification has arrived since the panel was last opened */
  hasNewSinceLastOpen: boolean;

  setOpen: (v: boolean) => void;
  setActiveTab: (t: TabValue) => void;
  setItems: (items: BellNotification[]) => void;
  markAllRead: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  /** Called by Pusher subscriber when a realtime notification arrives */
  pushIncoming: (n: BellNotification) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  open: false,
  activeTab: "reminders",
  items: [],
  unreadCount: 0,
  hasNewSinceLastOpen: false,

  setOpen: (v) => {
    set({ open: v });
    // When opening the panel, clear the "new" pulse flag
    if (v) {
      set({ hasNewSinceLastOpen: false });
    }
  },

  setActiveTab: (t) => set({ activeTab: t }),

  setItems: (items) =>
    set({
      items,
      unreadCount: items.filter((i) => !i.read).length,
    }),

  markAllRead: async () => {
    const { items } = get();
    // Optimistic update
    const updated = items.map((i) => ({ ...i, read: true }));
    set({ items: updated, unreadCount: 0 });

    // API call will be wired in Step 3
    try {
      await fetch("/api/notifications/mark-all-read", { method: "POST" });
    } catch (error) {
      console.error("[Notifications] Failed to mark all read:", error);
    }
  },

  markRead: async (id) => {
    const { items } = get();
    // Optimistic update
    const updated = items.map((i) =>
      i.id === id ? { ...i, read: true } : i
    );
    set({
      items: updated,
      unreadCount: updated.filter((i) => !i.read).length,
    });

    // API call will be wired in Step 3
    try {
      await fetch(`/api/notifications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ read: true }),
      });
    } catch (error) {
      console.error("[Notifications] Failed to mark read:", error);
    }
  },

  pushIncoming: (n) => {
    const { items } = get();
    // Prevent duplicates
    if (items.some((i) => i.id === n.id)) return;
    const updated = [n, ...items];
    set({
      items: updated,
      unreadCount: updated.filter((i) => !i.read).length,
      hasNewSinceLastOpen: true,
    });
  },
}));
