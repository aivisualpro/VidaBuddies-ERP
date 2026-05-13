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
 * All returned callbacks (setFilter, setFilters, resetFilters) are
 * **referentially stable** — safe to use in useEffect / useLayoutEffect deps.
 *
 * @param defaults        – object of `{ paramName: defaultValue }`.
 *                          Empty/default values are stripped from the URL.
 * @param debounceKeys    – array of keys to debounce (e.g. ["search"]).
 * @param debounceMs      – debounce delay for those keys (default 300ms).
 */
export function useUrlFilters<T extends Defaults>(
  defaults: T,
  debounceKeys: (keyof T & string)[] = [],
  debounceMs = 300
): UseUrlFiltersReturn<T> {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // ── Stable key lists (serialize to avoid reference issues from call-site arrays) ──
  const keysStr = Object.keys(defaults).sort().join(",");
  const keys = useMemo(() => keysStr.split(",") as (keyof T & string)[], [keysStr]);

  const debounceStr = [...debounceKeys].sort().join(",");
  const debounceSet = useMemo(() => new Set(debounceStr ? debounceStr.split(",") : []), [debounceStr]);

  // ── Read current filter values from the URL ──
  const filters = useMemo(() => {
    const result = { ...defaults };
    for (const key of keys) {
      const v = searchParams.get(key);
      if (v !== null) (result as any)[key] = v;
    }
    return result;
  }, [searchParams, keys, defaults]);

  // ── Local input state for debounced fields ──
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

  // ── Refs for mutable values so callbacks stay stable ──
  const ref = useRef({ searchParams, router, pathname, defaults, debounceSet, debounceMs });
  ref.current = { searchParams, router, pathname, defaults, debounceSet, debounceMs };

  // ── Stable callbacks (never change identity) ──

  const pushToUrl = useCallback((patch: Partial<T>) => {
    const { searchParams: sp, defaults: d, router: r, pathname: p } = ref.current;
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === d[k as keyof T] || v === "" || v === null || v === undefined) {
        params.delete(k);
      } else {
        params.set(k, v as string);
      }
    }
    const qs = params.toString();
    r.replace(`${p}${qs ? `?${qs}` : ""}`, { scroll: false });
  }, []);

  const setFilter = useCallback((key: keyof T & string, value: string) => {
    if (ref.current.debounceSet.has(key)) {
      setLocalInputs((prev) => ({ ...prev, [key]: value }));
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        pushToUrl({ [key]: value } as Partial<T>);
      }, ref.current.debounceMs);
    } else {
      pushToUrl({ [key]: value } as Partial<T>);
    }
  }, [pushToUrl]);

  const setFilters = useCallback((patch: Partial<T>) => {
    pushToUrl(patch);
  }, [pushToUrl]);

  const resetFilters = useCallback(() => {
    const { searchParams: sp, router: r, pathname: p } = ref.current;
    const params = new URLSearchParams(sp.toString());
    for (const key of keys) {
      params.delete(key);
    }
    setLocalInputs({});
    const qs = params.toString();
    r.replace(`${p}${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [keys]);

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
