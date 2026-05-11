"use client";

import { useMemo } from "react";
import { useUserDataStore } from "@/store/useUserDataStore";
import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ShipmentMapWrapper from "@/components/dashboard/shipment-map-wrapper";
import { Ship, Package, CheckCircle, Clock } from "lucide-react";
import { TablePageSkeleton } from "@/components/skeletons";

export default function DashboardPage() {
  const { purchaseOrders: data, isLoading } = useUserDataStore();

  const statsData = useMemo(() => {
    let total = 0, delivered = 0, inTransit = 0, pending = 0;
    
    // For Map
    const locations: any[] = [];
    let mapInTransitCount = 0;
    
    // For Chart
    const monthlyMap: Record<string, { delivered: number, inTransit: number, other: number }> = {};
    
    data.forEach((po: any) => {
      if (po.customerPO && Array.isArray(po.customerPO)) {
        po.customerPO.forEach((cpo: any) => {
          if (cpo.shipping && Array.isArray(cpo.shipping)) {
            cpo.shipping.forEach((ship: any) => {
              total++;
              
              const status = (ship.status || "").toLowerCase().trim();
              let category = "pending";
              
              // Determine base category
              if (status === "delivered" || status === "arrived") {
                category = "delivered";
              } else if (status === "in transit" || status === "in_transit" || status === "on water") {
                category = "inTransit";
              }

              // Auto-flag: if ETA is past and still "in transit", treat as delivered
              if (category === "inTransit") {
                const eta = ship.updatedETA || ship.ETA || "";
                if (eta) {
                  const etaDate = new Date(eta);
                  if (!isNaN(etaDate.getTime()) && etaDate.getTime() < Date.now()) {
                    category = "delivered";
                  }
                }
              }

              if (category === "delivered") delivered++;
              else if (category === "inTransit") inTransit++;
              else pending++;
              
              // Map locations
              if (category === "inTransit") {
                mapInTransitCount++;
                if (ship.containerNo && !locations.some(loc => loc.containerNo === ship.containerNo)) {
                  const records = ship.shippingTrackingRecords;
                  if (records && records.length > 0) {
                    const lastRecord = records[records.length - 1];
                    if (lastRecord.latlong) {
                      const parts = lastRecord.latlong.split(',');
                      if (parts.length === 2) {
                        const lat = parseFloat(parts[0].trim());
                        const lng = parseFloat(parts[1].trim());
                        if (!isNaN(lat) && !isNaN(lng)) {
                          // Port geocoding lookup
                          const _ports: Record<string, [number, number]> = {
                            'chennai': [13.08, 80.27], 'ennore': [13.22, 80.32], 'mundra': [22.74, 69.72],
                            'santos': [-23.96, -46.31], 'callao': [-12.06, -77.14], 'san antonio': [-33.59, -71.62],
                            'moin': [10.00, -83.08], 'kingston': [17.97, -76.84], 'freeport': [26.53, -78.70],
                            'new york': [40.68, -74.04], 'new york city': [40.68, -74.04],
                            'philadelphia': [39.90, -75.14], 'brampton': [43.73, -79.76],
                            'montreal': [45.50, -73.55], 'seattle': [47.60, -122.34],
                            'london gateway': [51.45, 0.45], 'bordeaux': [44.86, -0.57],
                            'colombo': [6.93, 79.85], 'singapore': [1.26, 103.82],
                            'piraeus': [37.94, 23.64], 'p&w': [39.90, -75.14],
                          };
                          const _fp = (n?: string) => {
                            if (!n) return undefined;
                            const lc = n.toLowerCase().trim();
                            for (const [k, c] of Object.entries(_ports)) { if (lc.includes(k) || k.includes(lc)) return c; }
                            return undefined;
                          };
                          const oC = _fp(lastRecord.pol_name) || _fp(ship.portOfLading);
                          const dC = _fp(lastRecord.pod_name) || _fp(ship.portOfEntryShipTo);

                          locations.push({
                            lat, lng,
                            title: (lastRecord.last_event_code === 'DEPA' || ship.status === 'IN_TRANSIT' || ship.status === 'In Transit' || ship.status === 'On Water') ? `On Water (${lastRecord.vessel_names || 'Vessel'})` : (lastRecord.last_event_location || ship.vessellTrip || "Unknown Location"),
                            containerNo: ship.containerNo,
                            vbid: po.vbpoNo,
                            status: ship.status,
                            origin: lastRecord.pol_name || ship.fromPort?.name || "N/A",
                            destination: lastRecord.pod_name || ship.toPort?.name || "N/A",
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
              }

              // Chart data
              const shipDateStr = ship.updatedETA || ship.ETA || ship.supplierPoDate;
              if (shipDateStr) {
                 const d = new Date(shipDateStr);
                 if (!isNaN(d.getTime())) {
                   const mm = String(d.getMonth() + 1).padStart(2, '0');
                   const yyyy = d.getFullYear();
                   const monthKey = `${yyyy}-${mm}`;
                   if (!monthlyMap[monthKey]) {
                     monthlyMap[monthKey] = { delivered: 0, inTransit: 0, other: 0 };
                   }
                   if (category === "delivered") monthlyMap[monthKey].delivered++;
                   else if (category === "inTransit") monthlyMap[monthKey].inTransit++;
                   else monthlyMap[monthKey].other++;
                 }
              }
            });
          }
        });
      }
    });

    const chart = Object.entries(monthlyMap)
      .map(([date, counts]) => ({ date, ...counts }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return { total, delivered, inTransit, pending, locations, mapInTransitCount, chart };
  }, [data]);

  const totalPOs = data.length;
  const { total, delivered, inTransit, pending, locations: mapLocations, mapInTransitCount: totalInTransit, chart: chartData } = statsData;

  const statCards = [
    { label: "Purchase Orders", value: totalPOs, icon: Package, color: "text-violet-500", bg: "bg-violet-500/10" },
    { label: "Total Shipments", value: total, icon: Ship, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "In Transit", value: inTransit, icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Delivered", value: delivered, icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/10" },
  ];

  if (isLoading) {
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
            {totalInTransit !== mapLocations.length ? ` of ${totalInTransit}` : ''})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          <ShipmentMapWrapper locations={mapLocations} />
        </CardContent>
      </Card>
    </div>
  );
}
