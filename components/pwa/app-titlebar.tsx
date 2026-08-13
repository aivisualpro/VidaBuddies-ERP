"use client";

import * as React from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { IconChevronRight, IconSearch } from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import { buildBreadcrumbs } from "@/lib/navigation";
import { useWindowControlsOverlay } from "@/hooks/use-window-controls-overlay";
import { useCommandMenu } from "@/components/providers/command-menu-provider";
import { ConnectionStatus } from "@/components/pwa/connection-status";

/**
 * The desktop application title bar.
 *
 * `manifest.json` opts into `window-controls-overlay`, which means the browser
 * stops drawing a title bar of its own and hands that strip to us. That is what
 * makes the installed app look like a native product — and it is also why the
 * window could not be moved: with no `app-region: drag` surface declared, there
 * was simply nothing to grab.
 *
 * This component owns that contract:
 *
 *   • Declares the drag surface, so the window moves and double-click still
 *     maximises, exactly as a native title bar would.
 *   • Reserves the space the OS window buttons occupy, reading it from the
 *     platform rather than guessing — right on Windows, left on macOS.
 *   • Earns the strip back by putting the app's identity, location and search
 *     where a desktop user expects them.
 *
 * Renders nothing at all in a browser tab, where the browser's own chrome is
 * already doing this job.
 */

/** Never let the bar get so short that the controls inside it stop being usable. */
const MIN_BAR_HEIGHT = 36;

export function AppTitleBar() {
  const { isOverlayVisible, insets } = useWindowControlsOverlay();
  const pathname = usePathname();
  const { openMenu } = useCommandMenu();
  const [shortcutHint, setShortcutHint] = React.useState("Ctrl K");

  React.useEffect(() => {
    // Read after mount: the platform is not knowable during SSR, and guessing
    // would produce a hydration mismatch on every macOS load.
    const platform =
      (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
        ?.platform ?? navigator.platform;
    if (/mac/i.test(platform ?? "")) setShortcutHint("⌘K");
  }, []);

  const crumbs = React.useMemo(() => buildBreadcrumbs(pathname), [pathname]);

  if (!isOverlayVisible) return null;

  const barHeight = Math.max(insets.height, MIN_BAR_HEIGHT);

  return (
    <div
      data-app-region="drag"
      data-app-titlebar=""
      style={{
        // Physical, not logical: the geometry we read back from the platform is
        // physical, and mixing the two would break on any RTL locale.
        height: barHeight,
        paddingLeft: insets.start,
        paddingRight: insets.end,
      }}
      className={cn(
        "bg-sidebar text-sidebar-foreground relative z-50 flex w-full shrink-0 items-center",
        "border-sidebar-border border-b",
        // A hairline of light along the top edge reads as the bevel of a window
        // frame — the difference between "a div" and "chrome".
        "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px",
        "before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent"
      )}
    >
      <div className="grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-2.5">
        {/* Identity and location. Deliberately non-interactive: every element
            here is extra surface the user can grab to move the window. */}
        <div className="flex min-w-0 items-center gap-2">
          <Image
            src="/icon-192x192.png"
            alt=""
            width={18}
            height={18}
            className="pointer-events-none size-[18px] shrink-0 rounded-[5px] object-contain"
            priority
          />
          <span className="hidden shrink-0 text-[13px] font-semibold tracking-tight sm:inline">
            Vida Buddies
          </span>

          {crumbs.length > 0 && (
            <>
              <span
                aria-hidden
                className="bg-sidebar-border hidden h-3.5 w-px shrink-0 md:block"
              />
              <nav
                aria-label="Breadcrumb"
                className="hidden min-w-0 items-center gap-0.5 md:flex"
              >
                {crumbs.map((crumb, index) => (
                  <React.Fragment key={crumb.href}>
                    {index > 0 && (
                      <IconChevronRight
                        aria-hidden
                        className="text-muted-foreground/50 size-3 shrink-0"
                      />
                    )}
                    <span
                      aria-current={crumb.current ? "page" : undefined}
                      className={cn(
                        "truncate text-[12px] leading-none",
                        crumb.current
                          ? "text-foreground font-medium"
                          : "text-muted-foreground"
                      )}
                    >
                      {crumb.label}
                    </span>
                  </React.Fragment>
                ))}
              </nav>
            </>
          )}
        </div>

        {/* Search sits in a fixed centre column so it stays optically centred in
            the window no matter how long the breadcrumb gets. */}
        <button
          type="button"
          data-app-region="no-drag"
          onClick={openMenu}
          aria-keyshortcuts="Meta+K Control+K"
          className={cn(
            "group/search flex h-6 w-40 items-center gap-1.5 rounded-md px-2 lg:w-64",
            "bg-background/60 border-sidebar-border border text-[12px]",
            "text-muted-foreground hover:text-foreground hover:bg-background",
            "transition-colors",
            "focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-2"
          )}
        >
          <IconSearch className="size-3.5 shrink-0" />
          <span className="truncate">Search…</span>
          <kbd
            className={cn(
              "border-sidebar-border bg-muted/60 text-muted-foreground ml-auto hidden shrink-0",
              "rounded border px-1 py-px font-sans text-[10px] leading-none lg:inline-block"
            )}
          >
            {shortcutHint}
          </kbd>
        </button>

        <div className="flex min-w-0 items-center justify-end gap-1">
          <ConnectionStatus />
        </div>
      </div>
    </div>
  );
}
