"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { useNotificationStore } from "@/lib/stores/notification-store";
import { getPusherClient } from "@/lib/pusher/client";
import type { BellNotification } from "@/lib/notifications/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/** Try to play a soft notification sound. Degrades silently if unavailable. */
function playBellSound() {
  try {
    const audio = new Audio("/sounds/bell.wav");
    audio.volume = 0.3;
    audio.play().catch(() => {
      // Autoplay blocked or file missing — degrade silently
    });
  } catch {
    // No audio support
  }
}

export function NotificationBell() {
  const open = useNotificationStore((s) => s.open);
  const setOpen = useNotificationStore((s) => s.setOpen);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const hasNew = useNotificationStore((s) => s.hasNewSinceLastOpen);

  // Super Admin gating — hide bell entirely for non-Super Admins
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const pusherChannelRef = useRef<any>(null);

  // Fetch /api/me on mount to get role + userId
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/me");
        if (!res.ok) {
          setIsSuperAdmin(false);
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setIsSuperAdmin(data.role === "Super Admin");
          setUserId(data.id);
        }
      } catch {
        if (!cancelled) setIsSuperAdmin(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch unread count on mount (so badge shows immediately)
  useEffect(() => {
    if (!isSuperAdmin) return;

    (async () => {
      try {
        const res = await fetch("/api/notifications/reminders");
        if (!res.ok) return;
        const data: BellNotification[] = await res.json();
        useNotificationStore.getState().setItems(data);
      } catch {
        // Silent fail — badge just stays at 0
      }
    })();
  }, [isSuperAdmin]);

  // Subscribe to Pusher private channel when we have a userId
  useEffect(() => {
    if (!isSuperAdmin || !userId) return;

    const pusher = getPusherClient();
    if (!pusher) return;

    const channelName = `private-user-${userId}`;
    const channel = pusher.subscribe(channelName);
    pusherChannelRef.current = channel;

    channel.bind("notification:new", (notification: BellNotification) => {
      // Push into store (bumps unreadCount, sets hasNewSinceLastOpen)
      useNotificationStore.getState().pushIncoming(notification);

      // Play notification sound
      playBellSound();

      // Show sonner toast
      toast(notification.title, {
        description: notification.message,
        duration: 6000,
        action: notification.link
          ? {
              label: "View",
              onClick: () => {
                useNotificationStore.getState().setOpen(true);
                if (notification.link) {
                  window.location.href = notification.link;
                }
              },
            }
          : undefined,
      });
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(channelName);
      pusherChannelRef.current = null;
    };
  }, [isSuperAdmin, userId]);

  const toggle = useCallback(() => {
    setOpen(!open);
  }, [open, setOpen]);

  // Keyboard shortcut: "n" opens the panel when not focused on an input
  useEffect(() => {
    if (!isSuperAdmin) return;

    const handleKey = (e: KeyboardEvent) => {
      if (
        e.key === "n" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.shiftKey
      ) {
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
        const isEditable =
          tag === "input" ||
          tag === "textarea" ||
          tag === "select" ||
          (e.target as HTMLElement)?.isContentEditable;
        if (!isEditable) {
          e.preventDefault();
          toggle();
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [toggle, isSuperAdmin]);

  // Don't render anything if not Super Admin (or still loading)
  if (!isSuperAdmin) return null;

  const displayCount = unreadCount > 99 ? "99+" : unreadCount;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          id="notification-bell"
          variant="ghost"
          onClick={toggle}
          className={cn(
            "relative h-9 w-9 rounded-full p-0",
            "hover:bg-muted/80 hover:ring-1 hover:ring-primary/20",
            "transition-all duration-200"
          )}
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        >
          <Bell
            className={cn(
              "h-[18px] w-[18px] text-muted-foreground transition-colors",
              open && "text-primary",
              hasNew && "animate-[bell-ring_0.5s_ease-in-out]"
            )}
          />

          {/* Unread badge */}
          {unreadCount > 0 && (
            <span
              className={cn(
                "absolute -top-0.5 -right-0.5",
                "flex items-center justify-center",
                "h-4 min-w-[16px] px-1 rounded-full",
                "bg-gradient-to-br from-rose-500 to-red-600",
                "text-white text-[10px] font-bold leading-none",
                "ring-2 ring-background",
                "transition-transform duration-200",
                hasNew && "animate-pulse"
              )}
            >
              {displayCount}
            </span>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={4}>
        <p>Notifications {unreadCount > 0 && `(${unreadCount})`}</p>
      </TooltipContent>
    </Tooltip>
  );
}
