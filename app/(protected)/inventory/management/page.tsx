"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { SimpleDataTable } from "@/components/admin/simple-data-table";
import { ColumnDef } from "@tanstack/react-table";
import { TablePageSkeleton } from "@/components/skeletons";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface InventoryRow {
  _id: string;
  warehouse?: { _id: string; name: string } | null;
  vbShipmentNumber?: { _id: string; VBShipmentNumber?: string; svbid?: string } | null;
  product?: { _id: string; name: string; vbId?: string } | null;
  supplier?: { _id: string; name: string; vbId?: string } | null;
  serialNumber?: string;
  qty: number;
  releasedQty: number;
  availableQty: number;
  batchNumber?: string;
  uom?: string;
  weight?: number;
  receivedDate?: string;
}

const FILTER_DEFAULTS = { search: "", warehouse: "all" };

function InventoryManagementContent() {
  const { filters, inputs, setFilter } = useUrlFilters(FILTER_DEFAULTS, ["search"], 300);

  const [data, setData] = useState<InventoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/inventory-management")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setData(d);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  // Unique warehouses for filter
  const warehouseList = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of data) {
      if (row.warehouse && typeof row.warehouse === "object") {
        map.set(row.warehouse._id, row.warehouse.name);
      }
    }
    return Array.from(map.entries());
  }, [data]);

  // Filter data
  const filteredData = useMemo(() => {
    let result = data;

    if (filters.warehouse && filters.warehouse !== "all") {
      result = result.filter(
        (r) => typeof r.warehouse === "object" && r.warehouse?._id === filters.warehouse
      );
    }

    if (inputs.search) {
      const q = inputs.search.toLowerCase();
      result = result.filter((r) => {
        const productName = typeof r.product === "object" ? r.product?.name || "" : "";
        const vbId = typeof r.product === "object" ? r.product?.vbId || "" : "";
        const shipNo = typeof r.vbShipmentNumber === "object" ? r.vbShipmentNumber?.VBShipmentNumber || "" : "";
        const serial = r.serialNumber || "";
        const batch = r.batchNumber || "";
        const supplierName = typeof r.supplier === "object" ? r.supplier?.name || "" : "";
        return (
          productName.toLowerCase().includes(q) ||
          vbId.toLowerCase().includes(q) ||
          shipNo.toLowerCase().includes(q) ||
          serial.toLowerCase().includes(q) ||
          batch.toLowerCase().includes(q) ||
          supplierName.toLowerCase().includes(q)
        );
      });
    }

    return result;
  }, [data, filters.warehouse, inputs.search]);

  const globalFilterFn = () => true;

  const headerExtra = (
    <select
      value={filters.warehouse}
      onChange={(e) => setFilter("warehouse", e.target.value)}
      className="h-8 rounded-md border border-input bg-background px-3 text-xs"
    >
      <option value="all">All Warehouses</option>
      {warehouseList.map(([id, name]) => (
        <option key={id} value={id}>{name}</option>
      ))}
    </select>
  );

  const columns: ColumnDef<InventoryRow>[] = [
    {
      id: "warehouse",
      header: "Warehouse",
      accessorFn: (row) => typeof row.warehouse === "object" ? row.warehouse?.name || "-" : "-",
    },
    {
      id: "originVB",
      header: "Origin VB #",
      cell: ({ row }) => {
        const ship = row.original.vbShipmentNumber;
        if (!ship || typeof ship !== "object") return "-";
        return <span className="font-mono font-semibold text-primary">{ship.VBShipmentNumber || ship.svbid || "-"}</span>;
      },
      accessorFn: (row) => typeof row.vbShipmentNumber === "object" ? row.vbShipmentNumber?.VBShipmentNumber || row.vbShipmentNumber?.svbid || "-" : "-",
    },
    {
      id: "itemNo",
      header: "Item #",
      accessorFn: (row) => typeof row.product === "object" ? row.product?.vbId || "-" : "-",
    },
    {
      id: "product",
      header: "Product",
      cell: ({ row }) => {
        const p = row.original.product;
        if (!p || typeof p !== "object") return "-";
        return <span className="truncate max-w-[220px] block" title={p.name}>{p.name || "-"}</span>;
      },
      accessorFn: (row) => typeof row.product === "object" ? row.product?.name || "-" : "-",
    },
    {
      id: "supplier",
      header: "Supplier",
      cell: ({ row }) => {
        const s = row.original.supplier;
        if (!s || typeof s !== "object") return "-";
        return <span className="truncate max-w-[180px] block" title={s.name}>{s.name || "-"}</span>;
      },
      accessorFn: (row) => typeof row.supplier === "object" ? row.supplier?.name || "-" : "-",
    },
    {
      accessorKey: "serialNumber",
      header: "Serial/Lot",
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.serialNumber || "-"}</span>,
    },
    {
      id: "availableQty",
      header: "Available Qty",
      cell: ({ row }) => {
        const avail = row.original.availableQty;
        const total = row.original.qty;
        return (
          <div className="flex items-center gap-2">
            <Badge
              variant={avail <= 0 ? "destructive" : avail < total ? "secondary" : "default"}
              className="font-mono text-xs min-w-[40px] justify-center"
            >
              {avail}
            </Badge>
            <span className="text-muted-foreground text-xs">/ {total}</span>
          </div>
        );
      },
      accessorFn: (row) => row.availableQty,
    },
    {
      accessorKey: "batchNumber",
      header: "Batch #",
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.batchNumber || "-"}</span>,
    },
    {
      accessorKey: "uom",
      header: "UOM",
    },
    {
      id: "weightUnit",
      header: "Weight/Unit",
      cell: ({ row }) => row.original.weight ? <span className="font-mono text-xs">{row.original.weight}</span> : "-",
      accessorFn: (row) => row.weight || 0,
    },
    {
      id: "receivedDate",
      header: "Received Date",
      cell: ({ row }) => row.original.receivedDate ? format(new Date(row.original.receivedDate), "MMM dd, yyyy") : "-",
      accessorFn: (row) => row.receivedDate || "",
    },
  ];

  if (isLoading) {
    return <TablePageSkeleton />;
  }

  return (
    <div className="w-full h-full overflow-hidden">
      <SimpleDataTable
        columns={columns}
        data={filteredData}
        title="Inventory Management"
        showColumnToggle={false}
        globalFilter={inputs.search}
        onGlobalFilterChange={(v: string) => setFilter("search", v)}
        globalFilterFn={globalFilterFn}
        headerExtra={headerExtra}
      />
    </div>
  );
}

export default function InventoryManagementPage() {
  return (
    <Suspense fallback={<TablePageSkeleton />}>
      <InventoryManagementContent />
    </Suspense>
  );
}
