"use client";

import * as React from "react";
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
 * In a shared ERP the question "am I looking at current data?" is a real one —
 * two people editing the same purchase order need to know the moment realtime
 * drops. This surfaces network reachability and the realtime socket as a single
 * honest signal, rather than letting the UI quietly go stale.
 */

type Health = "live" | "connecting" | "degraded" | "offline";

const PRESENTATION: Record<
  Health,
  { label: string; detail: string; dot: string; ring: string; text: string }
> = {
  live: {
    label: "Live",
    detail: "Connected. Changes from your team appear in real time.",
    dot: "bg-emerald-500",
    ring: "bg-emerald-500/70",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  connecting: {
    label: "Connecting",
    detail: "Re-establishing the realtime connection…",
    dot: "bg-amber-500",
    ring: "bg-amber-500/70",
    text: "text-amber-600 dark:text-amber-400",
  },
  degraded: {
    label: "Delayed",
    detail:
      "Realtime updates are unavailable. Your work still saves — the screen just won't refresh on its own.",
    dot: "bg-amber-500",
    ring: "bg-amber-500/70",
    text: "text-amber-600 dark:text-amber-400",
  },
  offline: {
    label: "Offline",
    detail: "No network connection. Changes cannot be saved until you reconnect.",
    dot: "bg-rose-500",
    ring: "bg-rose-500/70",
    text: "text-rose-600 dark:text-rose-400",
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

  // Render the optimistic state until we've actually measured, so the title bar
  // never flashes a red "Offline" on a perfectly healthy connection.
  const health: Health = ready ? healthFromSocket(socketState, online) : "live";
  const presentation = PRESENTATION[health];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          data-app-region="no-drag"
          aria-label={`Connection status: ${presentation.label}`}
          className={cn(
            "group/status flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2",
            "text-[11px] font-medium tracking-tight",
            "transition-colors hover:bg-foreground/5 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-2",
            className
          )}
        >
          <span className="relative flex size-1.5 shrink-0">
            {health === "live" && (
              <span
                className={cn(
                  "absolute inline-flex size-full animate-ping rounded-full opacity-60",
                  presentation.ring
                )}
                style={{ animationDuration: "2.4s" }}
              />
            )}
            <span
              className={cn(
                "relative inline-flex size-1.5 rounded-full",
                presentation.dot,
                health === "connecting" && "animate-pulse"
              )}
            />
          </span>
          <span className={cn("hidden md:inline", presentation.text)}>
            {presentation.label}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-56">
        <p className="font-medium">{presentation.label}</p>
        <p className="text-muted-foreground mt-0.5 text-xs leading-snug">
          {presentation.detail}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
