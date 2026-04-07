"use client";

import Link from "next/link";
import { LayoutGrid, List } from "lucide-react";

export function ViewToggle({ currentView }: { currentView: "list" | "card" }) {
  return (
    <div className="flex items-center bg-muted/50 p-0.5 rounded-lg border border-border">
      <Link
        href="/admin/purchase-orders/list"
        className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-all ${
          currentView === "list"
            ? "bg-background shadow-sm text-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        }`}
      >
        <List className="w-3.5 h-3.5" />
        Table
      </Link>
      <Link
        href="/admin/purchase-orders/card"
        className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-all ${
          currentView === "card"
            ? "bg-background shadow-sm text-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        }`}
      >
        <LayoutGrid className="w-3.5 h-3.5" />
        Card
      </Link>
    </div>
  );
}
