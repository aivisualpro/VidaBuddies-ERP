"use client";

import { useMemo } from "react";
import { useLiveShipments, normalizeShipmentStatus } from "@/hooks/queries/useLiveShipments";
import { LiveShipmentsTable } from "@/components/admin/live-shipments-table";
import { TablePageSkeleton } from "@/components/skeletons";

export default function LiveShipmentsPage() {
  // Shared react-query cache with the dashboard — instant on revisit
  const { data: items = [], isLoading } = useLiveShipments();

  const containers = useMemo(() => {
    const mapped = items.map((ship: any) => {
      const hasContainer = ship.containerNo && ship.containerNo.toLowerCase() !== "tbd";
      const eta = ship.updatedETA || ship.ETA || "";

      return {
        id: ship._id?.toString() || "",
        shippingId: ship._id?.toString() || "",
        containerNo: ship.containerNo || "",
        vbid: ship._displayVBNumber || ship.VBNumber || "",
        poNo: ship._displayVBSerialNumber || ship.VBSerialNumber || "",
        svbid: ship.VBShipmentNumber || ship.svbid || "",
        customerName: ship._displaySupplier || "Unknown",
        status: normalizeShipmentStatus(ship.status),
        updatedETA: eta,
        rawShipData: ship,
        initialData:
          hasContainer && ship.shippingTrackingRecords && ship.shippingTrackingRecords.length > 0
            ? ship.shippingTrackingRecords[ship.shippingTrackingRecords.length - 1]
            : null,
      };
    });

    // Unique by shippingId, sorted by soonest ETA
    const seen = new Set<string>();
    return mapped
      .filter((item: any) => {
        const key = item.shippingId || item.containerNo || item.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a: any, b: any) => {
        if (!a.updatedETA && !b.updatedETA) return 0;
        if (!a.updatedETA) return 1;
        if (!b.updatedETA) return -1;
        return new Date(a.updatedETA).getTime() - new Date(b.updatedETA).getTime();
      });
  }, [items]);

  if (isLoading) {
    return <TablePageSkeleton />;
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto h-full">
      <LiveShipmentsTable containers={containers} />
    </div>
  );
}
