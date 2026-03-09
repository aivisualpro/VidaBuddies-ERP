import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { cookies } from "next/headers";
import connectToDatabase from "@/lib/db";
import VidaPO from "@/lib/models/VidaPO";
import ShipmentMapWrapper from "@/components/dashboard/shipment-map-wrapper";
import { Ship, Package, CheckCircle, Clock } from "lucide-react";

export default async function Page() {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

  await connectToDatabase();

  // Chart data: Group shipments by month using updatedETA → ETA → supplierPoDate fallback
  const chartData = await VidaPO.aggregate([
    { $unwind: "$customerPO" },
    { $unwind: "$customerPO.shipping" },
    {
      $addFields: {
        "shipDate": {
          $ifNull: [
            "$customerPO.shipping.updatedETA",
            { $ifNull: ["$customerPO.shipping.ETA", "$customerPO.shipping.supplierPoDate"] }
          ]
        }
      }
    },
    {
      $match: {
        "shipDate": { $exists: true, $ne: null }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m", date: "$shipDate" }
        },
        delivered: {
          $sum: {
            $cond: [{ $eq: ["$customerPO.shipping.status", "Delivered"] }, 1, 0]
          }
        },
        inTransit: {
          $sum: {
            $cond: [
              { $in: ["$customerPO.shipping.status", ["In Transit", "IN_TRANSIT", "On Water"]] },
              1, 0
            ]
          }
        },
        other: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ["$customerPO.shipping.status", "Delivered"] },
                  { $not: { $in: ["$customerPO.shipping.status", ["In Transit", "IN_TRANSIT", "On Water"]] } }
                ]
              },
              1, 0
            ]
          }
        }
      }
    },
    {
      $project: {
        _id: 0,
        date: "$_id",
        delivered: 1,
        inTransit: 1,
        other: 1
      }
    },
    { $sort: { date: 1 } }
  ]);

  // Dashboard summary stats
  const totalPOs = await VidaPO.countDocuments();

  const statusCounts = await VidaPO.aggregate([
    { $unwind: "$customerPO" },
    { $unwind: "$customerPO.shipping" },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        delivered: {
          $sum: { $cond: [{ $eq: ["$customerPO.shipping.status", "Delivered"] }, 1, 0] }
        },
        inTransit: {
          $sum: {
            $cond: [
              { $in: ["$customerPO.shipping.status", ["In Transit", "IN_TRANSIT", "On Water"]] },
              1, 0
            ]
          }
        },
        pending: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ["$customerPO.shipping.status", "Delivered"] },
                  { $not: { $in: ["$customerPO.shipping.status", ["In Transit", "IN_TRANSIT", "On Water"]] } }
                ]
              },
              1, 0
            ]
          }
        }
      }
    }
  ]);

  const stats = statusCounts[0] || { total: 0, delivered: 0, inTransit: 0, pending: 0 };

  // Fetch locations for map
  const activeShipments = await VidaPO.find(
    { "customerPO.shipping.shippingTrackingRecords": { $exists: true, $not: { $size: 0 } } },
    { "customerPO.shipping": 1, "vbpoNo": 1 }
  ).lean();

  const mapLocations: any[] = [];
  activeShipments.forEach((po: any) => {
    if (po.customerPO) {
      po.customerPO.forEach((cpo: any) => {
        if (cpo.shipping) {
          cpo.shipping.forEach((ship: any) => {
            if (ship.status !== "IN_TRANSIT" && ship.status !== "In Transit") return;
            if (mapLocations.some(loc => loc.containerNo === ship.containerNo)) return;

            const records = ship.shippingTrackingRecords;
            if (records && records.length > 0) {
              const lastRecord = records[records.length - 1];
              if (lastRecord.latlong) {
                const parts = lastRecord.latlong.split(',');
                if (parts.length === 2) {
                  const lat = parseFloat(parts[0].trim());
                  const lng = parseFloat(parts[1].trim());
                  if (!isNaN(lat) && !isNaN(lng)) {
                    mapLocations.push({
                      lat,
                      lng,
                      title: lastRecord.last_event_location || ship.vessellTrip || "Unknown Location",
                      containerNo: ship.containerNo,
                      vbid: po.vbpoNo,
                      status: ship.status,
                      origin: lastRecord.pol_name || ship.fromPort?.name || "N/A",
                      destination: lastRecord.pod_name || ship.toPort?.name || "N/A",
                      eta: lastRecord.pod_predictive_eta || ship.eta || null,
                      departure: lastRecord.pol_date || ship.etd || null,
                      updatedAt: lastRecord.updated_at || null,
                      vessel: lastRecord.vessel_names || ship.vesselName || null,
                      type: lastRecord.container_size_type || ""
                    });
                  }
                }
              }
            }
          });
        }
      });
    }
  });

  const sidebarCountResult = await VidaPO.aggregate([
    { $unwind: "$customerPO" },
    { $unwind: "$customerPO.shipping" },
    {
      $match: {
        "customerPO.shipping.containerNo": { $exists: true, $ne: "" },
        "customerPO.shipping.status": { $in: ["IN_TRANSIT", "In Transit"] }
      }
    },
    { $group: { _id: "$customerPO.shipping.containerNo" } },
    { $count: "count" }
  ]);
  const totalInTransit = sidebarCountResult[0]?.count || 0;

  const statCards = [
    { label: "Purchase Orders", value: totalPOs, icon: Package, color: "text-violet-500", bg: "bg-violet-500/10" },
    { label: "Total Shipments", value: stats.total, icon: Ship, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "In Transit", value: stats.inTransit, icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Delivered", value: stats.delivered, icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/10" },
  ];

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
