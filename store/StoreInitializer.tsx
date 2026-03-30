"use client";

import { useEffect } from "react";
import { useUserDataStore } from "./useUserDataStore";

export function StoreInitializer({ isSupplier = false }: { isSupplier?: boolean }) {
  const fetchInitialData = useUserDataStore(state => state.fetchInitialData);
  const resetStore = useUserDataStore(state => state.resetStore);

  useEffect(() => {
    if (isSupplier) {
      resetStore(); // Wipe any stale admin data from prev session
      return;
    }
    fetchInitialData();
  }, [fetchInitialData, resetStore, isSupplier]);

  // Optionally, show a beautiful loading overlay on first load if we want to block the app
  // or return null to fetch transparently in the background while the UI resolves.
  return null;
}
