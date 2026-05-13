"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useRef, useEffect, useState } from "react";

/**
 * A single URL query-param state hook.
 *
 * Returns `[value, setValue]` where:
 *   - `value` is the current URL param (or `defaultValue` if absent)
 *   - `setValue(v)` replaces the URL param via `router.replace` (no scroll,
 *     no history entry for search/filter changes)
 *
 * Supports an optional `debounceMs` for text inputs (e.g. 300ms)
 * so every keystroke doesn't push a URL change.
 */
export function useUrlState(
  key: string,
  defaultValue = "",
  { debounceMs = 0 }: { debounceMs?: number } = {}
): [string, (v: string) => void] {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Current URL value (or default)
  const urlValue = searchParams.get(key) ?? defaultValue;

  // For debounced inputs: keep a local state that updates immediately
  // while the URL update is debounced.
  const [localValue, setLocalValue] = useState(urlValue);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync local state when URL changes externally (back/forward, link click)
  useEffect(() => {
    setLocalValue(urlValue);
  }, [urlValue]);

  const setValue = useCallback(
    (v: string) => {
      // Update local state immediately (for responsive input)
      setLocalValue(v);

      const update = () => {
        const params = new URLSearchParams(searchParams.toString());
        if (v === defaultValue || v === "") {
          params.delete(key);
        } else {
          params.set(key, v);
        }
        const qs = params.toString();
        router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
      };

      if (debounceMs > 0) {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(update, debounceMs);
      } else {
        update();
      }
    },
    [key, defaultValue, debounceMs, searchParams, router, pathname]
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return debounceMs > 0 ? [localValue, setValue] : [urlValue, setValue];
}
