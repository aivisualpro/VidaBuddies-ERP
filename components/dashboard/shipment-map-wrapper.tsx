"use client";

import dynamic from "next/dynamic";
import { type MapLocation } from "./shipment-map";

const ShipmentMap = dynamic(() => import("./shipment-map"), {
  ssr: false,
  loading: () => <div className="h-[500px] w-full rounded-md border bg-muted animate-pulse flex items-center justify-center text-muted-foreground">Loading Map...</div>
});

export default function ShipmentMapWrapper({ locations }: { locations: MapLocation[] }) {
    return <ShipmentMap locations={locations} />;
}
