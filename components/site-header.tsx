"use client";

import { usePathname } from "next/navigation";
import { IconSearch } from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import { resolvePageTitle } from "@/lib/navigation";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeSelector } from "./theme-selector";
import { ModeSwitcher } from "./mode-switcher";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import { useCommandMenu } from "@/components/providers/command-menu-provider";
import { useWindowControlsOverlay } from "@/hooks/use-window-controls-overlay";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { NotificationPanel } from "@/components/notifications/notification-panel";

export function SiteHeader() {
  const pathname = usePathname();
  const { openMenu } = useCommandMenu();
  const { isOverlayVisible } = useWindowControlsOverlay();

  // Safe consumption of context to avoid crashing if provider is missing
  let headerCtx: {
    actions: import("react").ReactNode;
    leftContent: import("react").ReactNode;
    rightContent: import("react").ReactNode;
  } = {
    actions: null,
    leftContent: null,
    rightContent: null,
  };

  try {
     // eslint-disable-next-line react-hooks/rules-of-hooks
     const context = useHeaderActions();
     headerCtx = {
       actions: context.actions,
       leftContent: context.leftContent,
       rightContent: context.rightContent,
     };
  } catch (e) {
    // Provider missing
  }

  const title = resolvePageTitle(pathname);
  const isSupplierPortal = /^\/[0-9a-fA-F]{24}\/(dashboard|documents|details)/.test(pathname);

  // The desktop title bar already carries a search field. A second one directly
  // beneath it would be noise, so this trigger only appears when the title bar
  // is not there to provide it.
  const showSearchTrigger = !isSupplierPortal && !isOverlayVisible;

  return (
    <header
      data-app-shell-header=""
      className={cn(
        "flex shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear",
        // `--app-safe-top` is 0px everywhere except an installed mobile app,
        // where the web view runs underneath the status bar and notch.
        "h-[calc(3.5rem+var(--app-safe-top))] pt-[var(--app-safe-top)]"
      )}
    >
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        {!isSupplierPortal && (
          <>
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mx-2 data-[orientation=vertical]:h-4"
            />
          </>
        )}
        {headerCtx.leftContent ? (
          headerCtx.leftContent
        ) : (
          <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            {title}
          </h1>
        )}
        <div className="ml-auto flex items-center gap-2">
          {headerCtx.rightContent || headerCtx.actions}
          {showSearchTrigger && (
            <button
              type="button"
              onClick={openMenu}
              aria-label="Search screens and actions"
              aria-keyshortcuts="Meta+K Control+K"
              className={cn(
                "text-muted-foreground hover:text-foreground hover:bg-muted/80",
                "flex h-8 items-center gap-2 rounded-md border px-2 text-sm",
                "transition-colors",
                "focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-2"
              )}
            >
              <IconSearch className="size-4 shrink-0" />
              <span className="hidden lg:inline">Search</span>
              <kbd className="bg-muted text-muted-foreground hidden rounded border px-1 py-px font-sans text-[10px] leading-none lg:inline-block">
                ⌘K
              </kbd>
            </button>
          )}
          <NotificationBell />
          <ThemeSelector />
          <ModeSwitcher />
        </div>
      </div>
      <NotificationPanel />
    </header>
  );
}
