"use client";

import { useUserDataStore } from "@/store/useUserDataStore";
import { LiveShipmentsTable } from "@/components/admin/live-shipments-table";
import { TablePageSkeleton } from "@/components/skeletons";

export default function LiveShipmentsPage() {
  const { purchaseOrders: rawShipments, isLoading } = useUserDataStore();

  const containers: Array<{
    id: string;
    containerNo: string;
    vbid: string;
    poNo: string;
    svbid: string;
    customerName: string;
    status: string;
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
    // If it's already one of the app statuses, return as-is
    if (['Pending', 'Planned', 'In Transit', 'Delivered'].includes(raw)) return raw;
    return 'Pending';
  }

  rawShipments.forEach((po: any) => {
    if (po.customerPO && Array.isArray(po.customerPO)) {
      po.customerPO.forEach((cpo: any) => {
        if (cpo.shipping && Array.isArray(cpo.shipping)) {
          cpo.shipping.forEach((ship: any) => {
            const hasContainer = ship.containerNo && ship.containerNo.toLowerCase() !== "tbd";
            containers.push({
              id: po._id.toString(),
              containerNo: ship.containerNo || "",
              vbid: po.vbpoNo,
              poNo: cpo.poNo || "",
              svbid: ship.svbid || "",
              customerName: cpo.customer || "Unknown",
              status: normalizeStatus(ship.status),
              initialData: (hasContainer && ship.shippingTrackingRecords && ship.shippingTrackingRecords.length > 0)
                ? JSON.parse(JSON.stringify(ship.shippingTrackingRecords[ship.shippingTrackingRecords.length - 1]))
                : null
            });
          });
        }
      });
    }
  });

  // Unique by svbid (shipping VBID) if available, otherwise by containerNo, otherwise keep all
  const seen = new Set<string>();
  const uniqueContainers = containers.filter(item => {
    const key = item.svbid || item.containerNo || `${item.id}-${item.poNo}-${Math.random()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
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
