"use client";

import * as React from "react";
import {
  IconAlertTriangle,
  IconLoader2,
  IconPointFilled,
  IconWifiOff,
} from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import { getPusherClient } from "@/lib/pusher/client";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Live connection indicator.
 *
 * In a shared ERP, "am I looking at current data?" is a real question — two
 * people editing the same purchase order need to know the moment realtime
 * drops. This surfaces network reachability and the realtime socket as one
 * honest signal, rather than letting the screen quietly go stale.
 *
 * Each state carries its own glyph as well as its own colour: at 11px in a
 * 36px strip, hue alone is not a signal anyone can rely on (WCAG 1.4.1), and
 * the label is hidden entirely on narrow windows.
 */

type Health = "live" | "connecting" | "degraded" | "offline";

interface Presentation {
  label: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Light-mode shades are one step darker: -600 on the near-white sidebar
   *  clears 4.5:1, -500 does not. */
  tone: string;
  spin?: boolean;
}

const PRESENTATION: Record<Health, Presentation> = {
  live: {
    label: "Live",
    detail: "Connected. Changes from your team appear in real time.",
    icon: IconPointFilled,
    tone: "text-emerald-700 dark:text-emerald-400",
  },
  connecting: {
    label: "Connecting",
    detail: "Re-establishing the realtime connection…",
    icon: IconLoader2,
    tone: "text-amber-700 dark:text-amber-400",
    spin: true,
  },
  degraded: {
    label: "Delayed",
    detail:
      "Realtime updates are unavailable. Your work still saves — the screen just won't refresh on its own.",
    icon: IconAlertTriangle,
    tone: "text-amber-700 dark:text-amber-400",
  },
  offline: {
    label: "Offline",
    detail: "No network connection. Changes cannot be saved until you reconnect.",
    icon: IconWifiOff,
    tone: "text-rose-700 dark:text-rose-400",
  },
};

/** Pusher's state machine, mapped onto something a human can act on. */
function healthFromSocket(state: string | undefined, online: boolean): Health {
  if (!online) return "offline";
  switch (state) {
    case "connected":
      return "live";
    case "connecting":
    case "initialized":
      return "connecting";
    case "unavailable":
    case "failed":
    case "disconnected":
      return "degraded";
    default:
      // No realtime configured at all — the network is the only signal we have,
      // and claiming "Live" would be a lie.
      return "degraded";
  }
}

export function ConnectionStatus({ className }: { className?: string }) {
  const [online, setOnline] = React.useState(true);
  const [socketState, setSocketState] = React.useState<string | undefined>(undefined);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    setOnline(navigator.onLine);
    setReady(true);

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const pusher = getPusherClient();
    let unbind: (() => void) | undefined;

    if (pusher) {
      setSocketState(pusher.connection.state);
      const onStateChange = ({ current }: { current: string }) => setSocketState(current);
      pusher.connection.bind("state_change", onStateChange);
      unbind = () => pusher.connection.unbind("state_change", onStateChange);
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      unbind?.();
    };
  }, []);

  // Stay optimistic until we've actually measured, so the title bar never
  // flashes a red "Offline" on a perfectly healthy connection.
  const health: Health = ready ? healthFromSocket(socketState, online) : "live";
  const { label, detail, icon: Icon, tone, spin } = PRESENTATION[health];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          data-app-region="no-drag"
          aria-label={`Connection status: ${label}`}
          className={cn(
            "flex h-6 shrink-0 items-center gap-1.5 rounded-md px-1.5",
            "text-[11px] leading-[1.4] font-medium tracking-tight",
            "transition-colors hover:bg-foreground/10 dark:hover:bg-white/10",
            "focus-visible:ring-ring focus-visible:ring-offset-sidebar focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
            tone,
            className
          )}
        >
          <span className="relative flex size-3.5 shrink-0 items-center justify-center">
            {health === "live" && (
              <span
                aria-hidden
                className="bg-emerald-600/60 dark:bg-emerald-400/60 absolute size-2 rounded-full motion-safe:animate-ping"
                style={{ animationDuration: "2.4s" }}
              />
            )}
            <Icon
              className={cn("relative size-3.5", spin && "motion-safe:animate-spin")}
            />
          </span>
          <span className="hidden md:inline">{label}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-56">
        <p className="font-medium">{label}</p>
        <p className="text-primary-foreground/80 mt-0.5 text-xs leading-snug">{detail}</p>
      </TooltipContent>
    </Tooltip>
  );
}
