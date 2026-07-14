"use client";

import { useMemo } from "react";
import { usePurchaseOrders } from "@/hooks/queries/usePurchaseOrders";
import { useLiveShipments, normalizeShipmentStatus } from "@/hooks/queries/useLiveShipments";
import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ShipmentMapWrapper from "@/components/dashboard/shipment-map-wrapper";
import { Ship, Package, CheckCircle, Clock } from "lucide-react";
import { TablePageSkeleton } from "@/components/skeletons";

/* Port name → [lat, lng] fallback geocoding for origin/destination arcs */
const PORTS: Record<string, [number, number]> = {
  chennai: [13.08, 80.27], ennore: [13.22, 80.32], mundra: [22.74, 69.72],
  santos: [-23.96, -46.31], callao: [-12.06, -77.14], "san antonio": [-33.59, -71.62],
  moin: [10.0, -83.08], kingston: [17.97, -76.84], freeport: [26.53, -78.7],
  "new york": [40.68, -74.04], "new york city": [40.68, -74.04],
  philadelphia: [39.9, -75.14], brampton: [43.73, -79.76],
  montreal: [45.5, -73.55], seattle: [47.6, -122.34],
  "london gateway": [51.45, 0.45], bordeaux: [44.86, -0.57],
  colombo: [6.93, 79.85], singapore: [1.26, 103.82],
  piraeus: [37.94, 23.64], "p&w": [39.9, -75.14],
};

function findPort(n?: string): [number, number] | undefined {
  if (!n) return undefined;
  const lc = n.toLowerCase().trim();
  for (const [k, c] of Object.entries(PORTS)) {
    if (lc.includes(k) || k.includes(lc)) return c;
  }
  return undefined;
}

export default function DashboardPage() {
  const { data: poData = [], isLoading: poLoading } = usePurchaseOrders();
  // Same collection + cache as /admin/live-shipments — counts always match
  const { data: shipments = [], isLoading: shipmentsLoading } = useLiveShipments();

  const statsData = useMemo(() => {
    let total = 0, delivered = 0, inTransit = 0, pending = 0;

    // For Map
    const locations: any[] = [];
    const seenContainers = new Set<string>();
    let mapInTransitCount = 0;

    // For Chart
    const monthlyMap: Record<string, { delivered: number; inTransit: number; other: number }> = {};

    shipments.forEach((ship: any) => {
      total++;

      const normalized = normalizeShipmentStatus(ship.status);
      let category: "delivered" | "inTransit" | "pending" =
        normalized === "Delivered" ? "delivered" :
        normalized === "In Transit" ? "inTransit" : "pending";

      if (category === "delivered") delivered++;
      else if (category === "inTransit") inTransit++;
      else pending++;

      // Map locations — latest tracking record with a lat/long
      if (category === "inTransit") {
        mapInTransitCount++;
        const records = ship.shippingTrackingRecords;
        if (
          ship.containerNo && !seenContainers.has(ship.containerNo) &&
          records && records.length > 0
        ) {
          const lastRecord = records[records.length - 1];
          if (lastRecord?.latlong) {
            const parts = String(lastRecord.latlong).split(",");
            if (parts.length === 2) {
              const lat = parseFloat(parts[0].trim());
              const lng = parseFloat(parts[1].trim());
              if (!isNaN(lat) && !isNaN(lng)) {
                seenContainers.add(ship.containerNo);
                const oC = findPort(lastRecord.pol_name) || findPort(ship.portOfLading);
                const dC = findPort(lastRecord.pod_name) || findPort(ship.portOfEntryShipTo);

                locations.push({
                  lat, lng,
                  title:
                    lastRecord.last_event_code === "DEPA" || normalized === "In Transit"
                      ? `On Water (${lastRecord.vessel_names || "Vessel"})`
                      : lastRecord.last_event_location || ship.vessellTrip || "Unknown Location",
                  containerNo: ship.containerNo,
                  vbid: ship._displayVBNumber || "",
                  status: ship.status,
                  origin: lastRecord.pol_name || ship.portOfLading || "N/A",
                  destination: lastRecord.pod_name || ship.portOfEntryShipTo || "N/A",
                  eta: lastRecord.pod_predictive_eta || lastRecord.pod_date || ship.updatedETA || ship.ETA || null,
                  departure: lastRecord.pol_date || null,
                  updatedAt: lastRecord.updated_at || null,
                  vessel: lastRecord.vessel_names || ship.vesselName || null,
                  type: lastRecord.container_size_type || "",
                  rawJson: lastRecord.raw_json || null,
                  originLat: oC?.[0], originLng: oC?.[1],
                  destLat: dC?.[0], destLng: dC?.[1],
                });
              }
            }
          }
        }
      }

      // Chart data
      const shipDateStr = ship.updatedETA || ship.ETA || ship.supplierPoDate;
      if (shipDateStr) {
        const d = new Date(shipDateStr);
        if (!isNaN(d.getTime())) {
          const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          if (!monthlyMap[monthKey]) monthlyMap[monthKey] = { delivered: 0, inTransit: 0, other: 0 };
          if (category === "delivered") monthlyMap[monthKey].delivered++;
          else if (category === "inTransit") monthlyMap[monthKey].inTransit++;
          else monthlyMap[monthKey].other++;
        }
      }
    });

    const chart = Object.entries(monthlyMap)
      .map(([date, counts]) => ({ date, ...counts }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return { total, delivered, inTransit, pending, locations, mapInTransitCount, chart };
  }, [shipments]);

  const totalPOs = poData.length;
  const { total, delivered, inTransit, locations: mapLocations, mapInTransitCount: totalInTransit, chart: chartData } = statsData;

  const statCards = [
    { label: "Purchase Orders", value: totalPOs, icon: Package, color: "text-violet-500", bg: "bg-violet-500/10" },
    { label: "Total Shipments", value: total, icon: Ship, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "In Transit", value: inTransit, icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Delivered", value: delivered, icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/10" },
  ];

  if (poLoading && shipmentsLoading) {
    return <TablePageSkeleton />;
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="relative overflow-hidden group">
            <CardContent className="p-4 flex items-center gap-4">
              <div className={`h-12 w-12 rounded-xl ${stat.bg} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold mt-0.5">{stat.value.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <ChartAreaInteractive data={chartData} />
      <Card>
        <CardHeader>
          <CardTitle>
            Live Shipments Map ({mapLocations.length}
            {totalInTransit !== mapLocations.length ? ` of ${totalInTransit}` : ""})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          <ShipmentMapWrapper locations={mapLocations} />
        </CardContent>
      </Card>
    </div>
  );
}
