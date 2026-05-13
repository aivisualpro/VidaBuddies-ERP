"use client";

import { useIsFetching } from "@tanstack/react-query";

/**
 * Thin progress bar fixed to the very top of the viewport.
 * Visible whenever TanStack Query has background fetches in flight.
 * Uses a CSS animation (indeterminate) so it works without JS timers.
 */
export function GlobalProgressBar() {
  const isFetching = useIsFetching();

  if (!isFetching) return null;

  return (
    <div
      aria-hidden
      className="fixed top-0 left-0 right-0 z-[9999] h-[2px] overflow-hidden pointer-events-none"
    >
      <div
        className="h-full bg-primary animate-progress-bar"
        style={{
          background: "linear-gradient(90deg, transparent 0%, hsl(var(--primary)) 50%, transparent 100%)",
        }}
      />
    </div>
  );
}
