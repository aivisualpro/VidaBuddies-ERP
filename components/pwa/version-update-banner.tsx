"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

/**
 * Polls /api/version every 60s. When the build ID changes after
 * a new Vercel deployment, shows a minimal banner prompting reload.
 */
export function VersionUpdateBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const initialBuildId = useRef<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;

    const check = async () => {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const { buildId } = await res.json();
        if (!buildId || buildId === "dev") return;

        if (!initialBuildId.current) {
          initialBuildId.current = buildId;
          return;
        }

        if (buildId !== initialBuildId.current) {
          setShowBanner(true);
        }
      } catch {
        // silently ignore
      }
    };

    // Initial check after 5s, then every 60s
    const initial = setTimeout(() => {
      check();
      timer = setInterval(check, 60_000);
    }, 5_000);

    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, []);

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] animate-in slide-in-from-bottom-4 fade-in duration-500">
      <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/95 backdrop-blur-md shadow-lg shadow-black/10 px-4 py-2.5 text-sm">
        <div className="flex items-center gap-2 text-foreground/80">
          <div className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </div>
          <span className="font-medium">A new version is available</span>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
          Update
        </button>
        <button
          onClick={() => setShowBanner(false)}
          className="text-muted-foreground hover:text-foreground transition-colors text-xs px-1"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
