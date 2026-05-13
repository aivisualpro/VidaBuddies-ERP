"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useRef, useEffect, useState, useMemo } from "react";

type Defaults = Record<string, string>;

interface UseUrlFiltersReturn<T extends Defaults> {
  /** Current filter values — always reflects the URL (or defaults). */
  filters: T;
  /** Live input values — may be ahead of the URL during debounce. */
  inputs: T;
  /** Set a single filter value. Debounced keys update the URL after `debounceMs`. */
  setFilter: (key: keyof T & string, value: string) => void;
  /** Set multiple filter values at once. */
  setFilters: (patch: Partial<T>) => void;
  /** Reset all filters to defaults (clears URL params). */
  resetFilters: () => void;
  /** True if any filter differs from its default. */
  hasActiveFilters: boolean;
}

/**
 * Multi-field URL filter hook.
 *
 * @param defaults        – object of `{ paramName: defaultValue }`.
 *                          Empty/default values are stripped from the URL.
 * @param debounceKeys    – array of keys to debounce (e.g. ["search"]).
 * @param debounceMs      – debounce delay for those keys (default 300ms).
 *
 * Example:
 * ```ts
 * const { filters, inputs, setFilter, resetFilters, hasActiveFilters } =
 *   useUrlFilters(
 *     { search: "", status: "", orderType: "" },
 *     ["search"],
 *     300,
 *   );
 * ```
 */
export function useUrlFilters<T extends Defaults>(
  defaults: T,
  debounceKeys: (keyof T & string)[] = [],
  debounceMs = 300
): UseUrlFiltersReturn<T> {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const keys = useMemo(() => Object.keys(defaults) as (keyof T & string)[], [defaults]);
  const debounceSet = useMemo(() => new Set(debounceKeys), [debounceKeys]);

  // Read current filter values from the URL
  const filters = useMemo(() => {
    const result = { ...defaults };
    for (const key of keys) {
      const v = searchParams.get(key);
      if (v !== null) (result as any)[key] = v;
    }
    return result;
  }, [searchParams, keys, defaults]);

  // Local input state for debounced fields (updates immediately on keystrokes)
  const [localInputs, setLocalInputs] = useState<Partial<T>>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync local inputs when URL changes externally (back/forward)
  useEffect(() => {
    setLocalInputs({});
  }, [searchParams]);

  // Merged inputs: local overrides for debounced keys, URL for the rest
  const inputs = useMemo(() => {
    const result = { ...filters };
    for (const [k, v] of Object.entries(localInputs)) {
      if (v !== undefined) (result as any)[k] = v;
    }
    return result;
  }, [filters, localInputs]);

  // Push a patch to the URL
  const pushToUrl = useCallback(
    (patch: Partial<T>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === defaults[k as keyof T] || v === "" || v === null || v === undefined) {
          params.delete(k);
        } else {
          params.set(k, v as string);
        }
      }
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [searchParams, router, pathname, defaults]
  );

  const setFilter = useCallback(
    (key: keyof T & string, value: string) => {
      if (debounceSet.has(key)) {
        // Update local input immediately for responsive UI
        setLocalInputs((prev) => ({ ...prev, [key]: value }));
        // Debounce the URL push
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          pushToUrl({ [key]: value } as Partial<T>);
        }, debounceMs);
      } else {
        pushToUrl({ [key]: value } as Partial<T>);
      }
    },
    [debounceSet, debounceMs, pushToUrl]
  );

  const setFilters = useCallback(
    (patch: Partial<T>) => {
      pushToUrl(patch);
    },
    [pushToUrl]
  );

  const resetFilters = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of keys) {
      params.delete(key);
    }
    setLocalInputs({});
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [keys, searchParams, router, pathname]);

  const hasActiveFilters = useMemo(
    () => keys.some((k) => filters[k] !== defaults[k]),
    [keys, filters, defaults]
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { filters, inputs, setFilter, setFilters, resetFilters, hasActiveFilters };
}
