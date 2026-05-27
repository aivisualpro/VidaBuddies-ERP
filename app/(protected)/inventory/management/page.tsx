"use client";

import { ClipboardList } from "lucide-react";

export default function InventoryManagementPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-20 text-center">
      <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
        <ClipboardList className="h-8 w-8 text-primary" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight">Inventory Management</h1>
      <p className="text-muted-foreground mt-2 max-w-md">
        This section is under development. Content will be added soon.
      </p>
    </div>
  );
}
