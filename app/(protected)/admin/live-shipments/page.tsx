"use client";

import { useUserDataStore } from "@/store/useUserDataStore";
import { LiveShipmentsTable } from "@/components/admin/live-shipments-table";
import { TablePageSkeleton } from "@/components/skeletons";

export default function LiveShipmentsPage() {
  const { purchaseOrders: rawShipments, isLoading } = useUserDataStore();

  const containers: Array<{
    id: string;
    shippingId: string;
    containerNo: string;
    vbid: string;
    poNo: string;
    svbid: string;
    customerName: string;
    status: string;
    updatedETA?: string;
    initialData?: any;
  }> = [];

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

  rawShipments.forEach((po: any) => {
    if (po.customerPO && Array.isArray(po.customerPO)) {
      po.customerPO.forEach((cpo: any) => {
        if (cpo.shipping && Array.isArray(cpo.shipping)) {
          cpo.shipping.forEach((ship: any) => {
            const hasContainer = ship.containerNo && ship.containerNo.toLowerCase() !== "tbd";
            const eta = ship.updatedETA || ship.ETA || "";
            let status = normalizeStatus(ship.status);

            // Auto-flag: if ETA is in the past and status is still "In Transit", show as "Delivered"
            if (status === 'In Transit' && eta) {
              const etaDate = new Date(eta);
              if (!isNaN(etaDate.getTime()) && etaDate.getTime() < Date.now()) {
                status = 'Delivered';
              }
            }

            containers.push({
              id: po._id.toString(),
              shippingId: ship._id?.toString() || "",
              containerNo: ship.containerNo || "",
              vbid: po.vbpoNo,
              poNo: cpo.poNo || "",
              svbid: ship.svbid || "",
              customerName: cpo.customer || "Unknown",
              status,
              updatedETA: eta,
              initialData: (hasContainer && ship.shippingTrackingRecords && ship.shippingTrackingRecords.length > 0)
                ? JSON.parse(JSON.stringify(ship.shippingTrackingRecords[ship.shippingTrackingRecords.length - 1]))
                : null
            });
          });
        }
      });
    }
  });

  // Unique by svbid
  const seen = new Set<string>();
  const uniqueContainers = containers
    .filter(item => {
      const key = item.svbid || item.containerNo || `${item.id}-${item.poNo}-${Math.random()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => {
      if (!a.updatedETA && !b.updatedETA) return 0;
      if (!a.updatedETA) return 1;
      if (!b.updatedETA) return -1;
      return new Date(a.updatedETA).getTime() - new Date(b.updatedETA).getTime();
    });

  if (isLoading) {
    return <TablePageSkeleton />;
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto h-full">
      <LiveShipmentsTable containers={uniqueContainers} />
    </div>
  );
}
