"use client";

import * as React from "react";
import { useTheme } from "next-themes";

/**
 * Chrome paints the Window Controls Overlay buttons — minimise, maximise,
 * close — on the document's `theme-color`. Pinning that to a single dark value
 * leaves the OS buttons sitting on a black patch whenever the user is in light
 * mode, which is the tell that a title bar was bolted on rather than designed.
 *
 * Keeping the meta tag in step with the resolved theme is what makes the native
 * buttons read as part of our own chrome.
 *
 * The values are literal hex on purpose: `theme-color` is consumed by browser
 * chrome outside the page's style resolution, so the `oklch()` value of
 * `--sidebar` cannot be handed over directly. These mirror stone-50 / stone-800
 * in `globals.css` — update both together.
 */
const THEME_COLOR = {
  light: "#fafaf9",
  dark: "#292524",
} as const;

export function ThemeColorSync() {
  const { resolvedTheme } = useTheme();

  React.useEffect(() => {
    const color = resolvedTheme === "light" ? THEME_COLOR.light : THEME_COLOR.dark;

    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    meta.content = color;
  }, [resolvedTheme]);

  return null;
}
