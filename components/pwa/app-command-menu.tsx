"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  IconLayoutSidebar,
  IconMoon,
  IconRefresh,
  IconSun,
} from "@tabler/icons-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useSidebar } from "@/components/ui/sidebar";
import { useCommandMenu } from "@/components/providers/command-menu-provider";
import { NAV_GROUPS, filterNavItems, type NavAccess, type NavItem } from "@/lib/navigation";

/**
 * ⌘K command palette.
 *
 * Runs off the same navigation registry and the same permission filter as the
 * sidebar, so it can never offer a destination the user is not allowed to open.
 *
 * Must be rendered inside `SidebarProvider` — it offers "toggle sidebar".
 */
export function AppCommandMenu({ isAdmin, isSupplier, permissions }: NavAccess) {
  const { open, setOpen } = useCommandMenu();
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();
  const { toggleSidebar } = useSidebar();

  const groups = React.useMemo(
    () =>
      NAV_GROUPS.map((group) => ({
        label: group.label,
        items: filterNavItems(group.items, { isAdmin, isSupplier, permissions }),
      })).filter((group) => group.items.length > 0),
    [isAdmin, isSupplier, permissions]
  );

  const run = React.useCallback(
    (action: () => void) => {
      setOpen(false);
      // Let the close animation start before the route transition, so the
      // palette doesn't appear to hang on a slow page.
      requestAnimationFrame(action);
    },
    [setOpen]
  );

  const navigate = React.useCallback(
    (item: NavItem) => run(() => router.push(item.url)),
    [router, run]
  );

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command palette"
      description="Jump to any screen or run a workspace action"
      showCloseButton={false}
      className="overflow-hidden p-0 shadow-2xl"
    >
      <CommandInput placeholder="Search screens and actions…" />
      <CommandList className="max-h-[60vh]">
        <CommandEmpty>
          <span className="text-muted-foreground text-sm">No matches.</span>
        </CommandEmpty>

        {groups.map((group) => (
          <CommandGroup key={group.label} heading={group.label}>
            {group.items.map((item) => (
              <CommandItem
                key={item.url}
                value={`${item.name} ${group.label} ${(item.keywords ?? []).join(" ")}`}
                onSelect={() => navigate(item)}
                className="gap-2.5"
              >
                <item.icon className="text-muted-foreground size-4 shrink-0" />
                <span className="truncate">{item.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}

        {groups.length > 0 && <CommandSeparator />}

        <CommandGroup heading="Workspace">
          <CommandItem
            value="toggle sidebar navigation collapse expand"
            onSelect={() => run(toggleSidebar)}
            className="gap-2.5"
          >
            <IconLayoutSidebar className="text-muted-foreground size-4 shrink-0" />
            <span>Toggle sidebar</span>
            <CommandShortcut>⌘B</CommandShortcut>
          </CommandItem>

          <CommandItem
            value="toggle theme dark light appearance mode"
            onSelect={() => run(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))}
            className="gap-2.5"
          >
            {resolvedTheme === "dark" ? (
              <IconSun className="text-muted-foreground size-4 shrink-0" />
            ) : (
              <IconMoon className="text-muted-foreground size-4 shrink-0" />
            )}
            <span>Switch to {resolvedTheme === "dark" ? "light" : "dark"} mode</span>
          </CommandItem>

          <CommandItem
            value="reload refresh reset window"
            onSelect={() => run(() => window.location.reload())}
            className="gap-2.5"
          >
            <IconRefresh className="text-muted-foreground size-4 shrink-0" />
            <span>Reload workspace</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
