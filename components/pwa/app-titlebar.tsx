"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconChevronRight, IconSearch } from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import { buildBreadcrumbs } from "@/lib/navigation";
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
 *   • Stays clear of the OS window buttons by reserving the space they occupy,
 *     read from the platform rather than guessed — right on Windows, left on
 *     macOS.
 *   • Earns the strip back by putting the app's identity, location and search
 *     where a desktop user expects them.
 *
 * Visibility and geometry are driven entirely by CSS (`[data-app-titlebar]` in
 * globals.css), never by React state. Hydration lands a frame or two after
 * first paint, so a JS-gated bar would cost a visible jump on every launch.
 * In a browser tab the whole thing is `display: none` and costs nothing.
 */
export function AppTitleBar() {
  const pathname = usePathname();
  const { openMenu } = useCommandMenu();
  const [shortcutHint, setShortcutHint] = React.useState("Ctrl K");

  const crumbs = React.useMemo(() => buildBreadcrumbs(pathname), [pathname]);
  const currentLabel = crumbs[crumbs.length - 1]?.label;

  React.useEffect(() => {
    // Read after mount: the platform is not knowable during SSR, and guessing
    // would produce a hydration mismatch on every macOS load.
    const platform =
      (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
        ?.platform ?? navigator.platform;
    if (/mac/i.test(platform ?? "")) setShortcutHint("⌘K");
  }, []);

  // Real title bars dim when their window loses focus. Reproducing that is the
  // cheapest, strongest signal that this is an application window rather than a
  // web page wearing one. Purely cosmetic, so driving it from JS costs nothing.
  React.useEffect(() => {
    const root = document.documentElement;
    const markActive = () => root.removeAttribute("data-window-inactive");
    const markInactive = () => root.setAttribute("data-window-inactive", "");

    if (document.hasFocus()) markActive();
    else markInactive();

    window.addEventListener("focus", markActive);
    window.addEventListener("blur", markInactive);
    return () => {
      window.removeEventListener("focus", markActive);
      window.removeEventListener("blur", markInactive);
      root.removeAttribute("data-window-inactive");
    };
  }, []);

  // Alt-Tab, the taskbar and window previews all read `document.title`. Left
  // static it says "Vida Buddies" for every screen, which undoes the point of
  // having a title bar. Scoped to the installed window so it never fights a
  // page's own metadata in a browser tab.
  React.useEffect(() => {
    if (!window.matchMedia("(display-mode: window-controls-overlay)").matches) return;
    document.title = currentLabel ? `${currentLabel} · Vida Buddies` : "Vida Buddies";
  }, [currentLabel]);

  return (
    <div
      data-app-titlebar=""
      data-app-region="drag"
      className={cn(
        "bg-sidebar text-sidebar-foreground relative z-50 w-full shrink-0 items-center",
        "border-sidebar-border border-b",
        "h-[var(--app-titlebar-height)]",
        // Never overlap the OS window buttons. Both insets are resolved from
        // env(titlebar-area-*), so one rule serves Windows and macOS alike.
        "pl-[var(--app-titlebar-inset-start)] pr-[var(--app-titlebar-inset-end)]",
        // A hairline along the top edge reads as the bevel of a window frame —
        // the difference between "a div" and "chrome".
        "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px",
        "before:bg-gradient-to-r before:from-transparent before:to-transparent",
        "before:via-black/10 dark:before:via-white/10"
      )}
    >
      <div className="grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-2.5">
        {/* Identity and location. Everything here that is not a link is extra
            surface the user can grab to move the window. */}
        <div className="flex min-w-0 items-center gap-2">
          <Image
            src="/icon-192x192.png"
            alt=""
            width={18}
            height={18}
            className="pointer-events-none size-[18px] shrink-0 rounded-md object-contain"
            priority
          />
          <span className="hidden shrink-0 text-[13px] leading-[1.4] font-semibold tracking-tight lg:inline">
            Vida Buddies
          </span>

          <span
            aria-hidden
            className="bg-sidebar-border hidden h-3.5 w-px shrink-0 lg:block"
          />

          {/* The current page is always shown; its ancestors appear once the
              window is wide enough to hold them. Dropping them wholesale beats
              letting them truncate — an ancestor squeezed to zero width leaves
              a bare chevron pointing at nothing. */}
          <nav aria-label="Breadcrumb" className="min-w-0">
            <ol className="flex min-w-0 items-center gap-0.5">
              {crumbs.map((crumb, index) => (
                <li
                  key={crumb.href}
                  className={cn(
                    "min-w-0 items-center gap-0.5",
                    crumb.current ? "flex" : "hidden lg:flex"
                  )}
                >
                  {index > 0 && (
                    <IconChevronRight
                      aria-hidden
                      className="text-muted-foreground hidden size-3 shrink-0 lg:block"
                    />
                  )}
                  {crumb.linkable && !crumb.current ? (
                    <Link
                      href={crumb.href}
                      title={crumb.label}
                      className="text-muted-foreground hover:text-foreground truncate rounded-sm text-[12px] leading-[1.4] transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar focus-visible:outline-none"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span
                      title={crumb.label}
                      aria-current={crumb.current ? "page" : undefined}
                      className={cn(
                        "truncate text-[12px] leading-[1.4]",
                        crumb.current ? "text-foreground font-medium" : "text-muted-foreground"
                      )}
                    >
                      {crumb.label}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        </div>

        {/* A fixed centre column keeps search optically centred in the
            draggable strip however long the breadcrumb grows. */}
        <button
          type="button"
          data-app-region="no-drag"
          onClick={openMenu}
          aria-keyshortcuts="Meta+K Control+K"
          className={cn(
            "flex h-6 w-40 items-center gap-1.5 rounded-md px-2 lg:w-64",
            "bg-background dark:bg-background/60 border-sidebar-border border text-[12px]",
            "text-muted-foreground hover:text-foreground hover:bg-muted",
            "transition-colors",
            "focus-visible:ring-ring focus-visible:ring-offset-sidebar focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          )}
        >
          <IconSearch className="size-3.5 shrink-0" />
          <span className="truncate leading-[1.4]">Search…</span>
          <kbd
            className={cn(
              "border-sidebar-border bg-muted text-muted-foreground ml-auto hidden shrink-0",
              "rounded-sm border px-1 py-px font-sans text-[10px] leading-none lg:inline-block"
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
