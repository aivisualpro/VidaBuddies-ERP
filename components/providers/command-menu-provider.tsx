"use client";

import * as React from "react";

/**
 * Holds the command palette's open state and owns the ⌘K / Ctrl+K shortcut.
 *
 * The trigger lives in the desktop title bar, which sits *outside* the sidebar
 * provider, while the palette itself needs sidebar context to offer "toggle
 * sidebar". Lifting the state to a provider that wraps both is what lets those
 * two components talk without prop-drilling through the shell.
 */

interface CommandMenuContextValue {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  openMenu: () => void;
}

const CommandMenuContext = React.createContext<CommandMenuContextValue | null>(null);

function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return element.isContentEditable;
}

export function CommandMenuProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key?.toLowerCase() !== "k" || !(event.metaKey || event.ctrlKey)) return;
      // Rich text editors bind ⌘K to "insert link"; don't steal it there.
      if (isTypingTarget(event.target)) return;

      event.preventDefault();
      setOpen((previous) => !previous);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const value = React.useMemo<CommandMenuContextValue>(
    () => ({ open, setOpen, openMenu: () => setOpen(true) }),
    [open]
  );

  return <CommandMenuContext.Provider value={value}>{children}</CommandMenuContext.Provider>;
}

/**
 * Never throws — a component that offers the palette should degrade to a no-op
 * rather than crash the shell if it is rendered outside the provider.
 */
export function useCommandMenu(): CommandMenuContextValue {
  const context = React.useContext(CommandMenuContext);
  return (
    context ?? {
      open: false,
      setOpen: () => {},
      openMenu: () => {},
    }
  );
}
