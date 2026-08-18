"use client";

import * as React from "react";

/**
 * Window Controls Overlay support.
 *
 * When `display_override: ["window-controls-overlay"]` is honoured, the browser
 * stops drawing its own title bar and hands that strip of the window to the web
 * content. That buys us a native-looking app frame, but it also means two
 * things become our responsibility:
 *
 *   1. Declaring a drag region — otherwise the window cannot be moved at all.
 *   2. Staying clear of the OS window buttons, which are still drawn on top of
 *      our content (right on Windows/Linux, left on macOS).
 *
 * This module is the single source of truth for both.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Window_Controls_Overlay_API
 */

/** How the app is currently being presented. Anything but `browser` is installed. */
export type AppDisplayMode =
  | "browser"
  | "minimal-ui"
  | "standalone"
  | "window-controls-overlay"
  | "fullscreen";

/**
 * Space the operating system has reserved for its own window buttons, in CSS
 * pixels, plus the height of the strip they live in.
 *
 * Reading both `start` and `end` — rather than sniffing the user agent — is
 * what lets one layout work on Windows (buttons right), macOS (traffic lights
 * left) and Linux without branching.
 */
export interface TitlebarInsets {
  /** Reserved width at the inline start of the title bar. */
  start: number;
  /** Reserved width at the inline end of the title bar. */
  end: number;
  /** Height of the OS-controlled title bar strip. */
  height: number;
}

export interface WindowControlsOverlayState {
  /** `false` until after hydration, so server and client render identically. */
  ready: boolean;
  displayMode: AppDisplayMode;
  /** The app is running installed, in any of its windowed forms. */
  isInstalled: boolean;
  /** The overlay is active right now — we own the title bar and must draw it. */
  isOverlayVisible: boolean;
  insets: TitlebarInsets;
}

/* -------------------------------------------------------------------------- */
/* Platform reads                                                             */
/* -------------------------------------------------------------------------- */

interface TitlebarAreaRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface WindowControlsOverlayApi extends EventTarget {
  visible: boolean;
  getTitlebarAreaRect(): TitlebarAreaRect;
}

type NavigatorWithOverlay = Navigator & {
  windowControlsOverlay?: WindowControlsOverlayApi;
  /** iOS Safari shipped home-screen apps years before `display-mode` existed. */
  standalone?: boolean;
};

const NO_INSETS: TitlebarInsets = { start: 0, end: 0, height: 0 };

/** Most specific first — a WCO window also matches `standalone`. */
const DISPLAY_MODE_PRECEDENCE: readonly AppDisplayMode[] = [
  "window-controls-overlay",
  "fullscreen",
  "standalone",
  "minimal-ui",
];

export function readDisplayMode(): AppDisplayMode {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "browser";
  }
  for (const mode of DISPLAY_MODE_PRECEDENCE) {
    if (window.matchMedia(`(display-mode: ${mode})`).matches) return mode;
  }
  if ((window.navigator as NavigatorWithOverlay).standalone === true) {
    return "standalone";
  }
  return "browser";
}

export function readTitlebarInsets(): TitlebarInsets {
  if (typeof window === "undefined") return NO_INSETS;

  const overlay = (window.navigator as NavigatorWithOverlay).windowControlsOverlay;
  if (!overlay?.visible) return NO_INSETS;

  const rect = overlay.getTitlebarAreaRect();

  // A zero-width rect means the overlay is mid-transition; treat it as absent
  // rather than collapsing the title bar to nothing for a frame.
  if (!rect || rect.width <= 0) return NO_INSETS;

  return {
    start: Math.max(0, Math.round(rect.x)),
    end: Math.max(0, Math.round(window.innerWidth - (rect.x + rect.width))),
    height: Math.max(0, Math.round(rect.height)),
  };
}

function insetsAreEqual(a: TitlebarInsets, b: TitlebarInsets): boolean {
  return a.start === b.start && a.end === b.end && a.height === b.height;
}

/* -------------------------------------------------------------------------- */
/* Hook                                                                       */
/* -------------------------------------------------------------------------- */

const SERVER_STATE: WindowControlsOverlayState = {
  ready: false,
  displayMode: "browser",
  isInstalled: false,
  isOverlayVisible: false,
  insets: NO_INSETS,
};

/**
 * Tracks how the app is being displayed and how much room the OS window buttons
 * are taking, re-reading on `geometrychange` (fired on move, resize, snap and
 * maximise) and on display-mode changes.
 *
 * Safe to call from any client component; renders as `browser` on the server so
 * hydration never mismatches.
 */
export function useWindowControlsOverlay(): WindowControlsOverlayState {
  const [state, setState] = React.useState<WindowControlsOverlayState>(SERVER_STATE);

  React.useEffect(() => {
    let frame = 0;
    let cancelled = false;

    const sync = () => {
      if (cancelled) return;
      const displayMode = readDisplayMode();
      const insets = readTitlebarInsets();
      const isOverlayVisible = displayMode === "window-controls-overlay" && insets.height > 0;

      setState((previous) => {
        if (
          previous.ready &&
          previous.displayMode === displayMode &&
          previous.isOverlayVisible === isOverlayVisible &&
          insetsAreEqual(previous.insets, insets)
        ) {
          // Nothing moved — bail out so a drag doesn't re-render the tree
          // on every geometry event.
          return previous;
        }
        return {
          ready: true,
          displayMode,
          isInstalled: displayMode !== "browser",
          isOverlayVisible,
          insets,
        };
      });
    };

    // `geometrychange` can fire many times per second while the user drags the
    // window edge. Coalescing to one read per frame keeps it off the hot path.
    const scheduleSync = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        sync();
      });
    };

    sync();

    const overlay = (window.navigator as NavigatorWithOverlay).windowControlsOverlay;
    overlay?.addEventListener("geometrychange", scheduleSync);
    window.addEventListener("resize", scheduleSync);

    const mediaQueries = DISPLAY_MODE_PRECEDENCE.map((mode) =>
      window.matchMedia(`(display-mode: ${mode})`)
    );
    for (const query of mediaQueries) {
      query.addEventListener("change", scheduleSync);
    }

    return () => {
      cancelled = true;
      if (frame) window.cancelAnimationFrame(frame);
      overlay?.removeEventListener("geometrychange", scheduleSync);
      window.removeEventListener("resize", scheduleSync);
      for (const query of mediaQueries) {
        query.removeEventListener("change", scheduleSync);
      }
    };
  }, []);

  return state;
}
