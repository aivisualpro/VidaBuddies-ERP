"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Lazy-load devtools to avoid React 19 "Maximum update depth" crash
// caused by ref callback loops in the devtools panel component.
const ReactQueryDevtools = dynamic(
  () =>
    import("@tanstack/react-query-devtools").then(
      (mod) => mod.ReactQueryDevtools
    ),
  { ssr: false }
);

/**
 * Global React Query provider with sensible defaults.
 *
 * - staleTime 30s:   prevents duplicate fetches when navigating quickly
 * - gcTime   5min:   keeps unused cache around for fast back-navigation
 * - refetchOnWindowFocus / refetchOnReconnect: ensures data is fresh
 *   when the user returns or connectivity is restored
 * - retry 1:         one automatic retry on transient failures
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  // useState ensures the QueryClient is stable across re-renders
  // and is unique per SSR request (no data leaking between users).
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,              // 30 seconds
            gcTime: 5 * 60_000,             // 5 minutes
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

