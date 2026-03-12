"use client";

import { useEffect } from "react";
import { useUserDataStore } from "./useUserDataStore";

export function StoreInitializer() {
  const fetchInitialData = useUserDataStore(state => state.fetchInitialData);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Optionally, show a beautiful loading overlay on first load if we want to block the app
  // or return null to fetch transparently in the background while the UI resolves.
  return null;
}
