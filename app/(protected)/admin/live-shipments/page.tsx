"use client";

import { useEffect, useState } from "react";
import { LiveShipmentsTable } from "@/components/admin/live-shipments-table";
import { TablePageSkeleton } from "@/components/skeletons";

export default function LiveShipmentsPage() {
  const [containers, setContainers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Normalize legacy/raw status values to app standard statuses
  function normalizeStatus(raw: string): string {
    if (!raw) return "Pending";
    const s = raw.toLowerCase().trim();
    if (s === 'delivered' || s === 'arrived') return 'Delivered';
    if (s === 'in transit' || s === 'in_transit' || s === 'on water') return 'In Transit';
    if (s === 'planned' || s === 'booking confirmed') return 'Planned';
    if (s === 'pending' || s === 'ordered') return 'Pending';
    if (['Pending', 'Planned', 'In Transit', 'Delivered'].includes(raw)) return raw;
    return 'Pending';
  }

  useEffect(() => {
    async function fetchShipments() {
      try {
        const res = await fetch("/api/admin/vb-shipping?includeTracking=1");
        const items = await res.json();
        if (!Array.isArray(items)) { setContainers([]); return; }

        const mapped = items.map((ship: any) => {
          const hasContainer = ship.containerNo && ship.containerNo.toLowerCase() !== "tbd";
          const eta = ship.updatedETA || ship.ETA || "";
          const status = normalizeStatus(ship.status);

          return {
            id: ship._id?.toString() || "",
            shippingId: ship._id?.toString() || "",
            containerNo: ship.containerNo || "",
            vbid: ship._displayVBNumber || ship.VBNumber || "",
            poNo: ship._displayVBSerialNumber || ship.VBSerialNumber || "",
            svbid: ship.VBShipmentNumber || ship.svbid || "",
            customerName: ship._displaySupplier || "Unknown",
            status,
            updatedETA: eta,
            rawShipData: ship,
            initialData: (hasContainer && ship.shippingTrackingRecords && ship.shippingTrackingRecords.length > 0)
              ? ship.shippingTrackingRecords[ship.shippingTrackingRecords.length - 1]
              : null,
          };
        });

        // Unique by shippingId
        const seen = new Set<string>();
        const unique = mapped
          .filter((item: any) => {
            const key = item.shippingId || item.containerNo || `${item.id}-${Math.random()}`;
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

        setContainers(unique);
      } catch (error) {
        console.error("Failed to fetch shipments for live view:", error);
        setContainers([]);
      } finally {
        setIsLoading(false);
      }
    }
    fetchShipments();
  }, []);

  if (isLoading) {
    return <TablePageSkeleton />;
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto h-full">
      <LiveShipmentsTable containers={containers} />
    </div>
  );
}
