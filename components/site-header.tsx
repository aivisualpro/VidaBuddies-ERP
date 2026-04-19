"use client";

import { usePathname } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeSelector } from "./theme-selector";
import { ModeSwitcher } from "./mode-switcher";
import { useHeaderActions } from "@/components/providers/header-actions-provider";

export function SiteHeader() {
  const pathname = usePathname();
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

  const getTitle = (path: string) => {
    if (path === "/dashboard") return "Dashboard";
    if (path.includes("andres-tracker")) return "Andres Tracker";
    
    const segments = path.split("/").filter(Boolean);
    const lastSegment = segments[segments.length - 1];
    if (!lastSegment) return "Dashboard";
    
    // Convert hyphens/underscores to spaces and capitalize
    return lastSegment
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  const title = getTitle(pathname);
  const isSupplierPortal = /^\/[0-9a-fA-F]{24}\/(dashboard|documents|details)/.test(pathname);

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear">
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
          <ThemeSelector />
          <ModeSwitcher />
        </div>
      </div>
    </header>
  );
}
