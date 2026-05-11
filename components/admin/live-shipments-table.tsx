
"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { IconMapPin, IconRefresh, IconShip, IconCircleCheck, IconCircleX, IconCalendar, IconCode } from "@tabler/icons-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import { ShipmentTrackingPanel } from "@/components/admin/shipment-tracking-panel";
import { ShipmentDetailPanel } from "@/components/admin/shipment-detail-panel";
import Link from "next/link";


interface ContainerInfo {
  id: string;
  shippingId: string;
  containerNo: string;
  vbid: string;
  poNo: string;
  svbid: string;
  customerName: string;
  status: string;
  updatedETA?: string;
  rawShipData?: any;
  initialData?: TrackingData;
}

interface TrackingData {
  type: string;
  number: string;
  sealine: string;
  sealine_name: string;
  status: string;
  updated_at: string;
  from_port_name: string;
  from_port_country: string;
  from_port_locode: string;
  to_port_name: string;
  to_port_country: string;
  to_port_locode: string;
  pol_name: string;
  pol_date: string;
  pol_actual: boolean | string;
  pod_name: string;
  pod_date: string;
  pod_actual: boolean | string;
  pod_predictive_eta: string;
  container_iso_code: string;
  container_size_type: string;
  vessel_names: string;
  vessel_imos: string;
  last_event_code: string;
  last_event_status: string;
  last_event_date: string;
  last_event_location: string;
  last_event_facility: string;
  last_event_vessel: string;
  last_event_voyage: string;
  latlong: string;
  raw_json?: string;
}

export function LiveShipmentsTable({ containers }: { containers: ContainerInfo[] }) {
  const [trackingData, setTrackingData] = useState<Record<string, TrackingData>>(() => {
    const initial: Record<string, TrackingData> = {};
    containers.forEach(c => {
      if (c.initialData) {
        initial[c.containerNo] = c.initialData;
      }
    });
    return initial;
  });

  // Auto-detect the best default tab based on app status
  const [filterMode, setFilterMode] = useState<"live" | "delivered" | "planned" | "pending">(() => {
    let hasLive = false;
    let hasPlanned = false;
    let hasDelivered = false;
    let hasPending = false;
    containers.forEach(c => {
      const status = (c.status || '').toLowerCase();
      if (status === 'delivered') hasDelivered = true;
      else if (status === 'planned') hasPlanned = true;
      else if (status === 'in transit') hasLive = true;
      else hasPending = true;
    });
    if (hasLive) return "live";
    if (hasPending) return "pending";
    if (hasPlanned) return "planned";
    if (hasDelivered) return "delivered";
    return "live";
  });

  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const { setActions } = useHeaderActions();
  const [searchQuery, setSearchQuery] = useState("");
  const [now, setNow] = useState<number | null>(null);
  const [rawJsonData, setRawJsonData] = useState<{ containerNo: string, json: string } | null>(null);
  const [trackingContainer, setTrackingContainer] = useState<string | null>(null);
  const [trackingCachedJson, setTrackingCachedJson] = useState<any>(null);
  const [detailShipData, setDetailShipData] = useState<any>(null);

  useEffect(() => {
    setNow(Date.now());
  }, []);

  const trackContainer = async (containerNo: string) => {
    if (!containerNo) return;

    setLoading(prev => ({ ...prev, [containerNo]: true }));
    try {
      const res = await fetch(`/api/searates?container=${encodeURIComponent(containerNo)}`);
      const data = await res.json();

      if (!res.ok) {
        toast.error(`Failed to track ${containerNo}`, { description: data.error || "Unknown error" });
        return;
      }

      // Check if shipment is disconnected (delivered)
      if (data._disconnected) {
        toast.info(`${containerNo} — Tracking Disconnected`, {
          description: "This shipment is delivered. Live tracking has been permanently disconnected."
        });
        return;
      }

      setTrackingData(prev => ({ ...prev, [containerNo]: data }));
      toast.success(`Updated tracking for ${containerNo}`);
    } catch (error: any) {
      toast.error(`Failed to track ${containerNo}`, { description: "Network error" });
    } finally {
      setLoading(prev => ({ ...prev, [containerNo]: false }));
    }
  };

  const trackAll = () => {
    containers.forEach(c => {
      // Skip delivered shipments — they are disconnected from live tracking
      const isDelivered = (c.status || '').toLowerCase() === 'delivered';
      if (c.containerNo && !isDelivered) {
        trackContainer(c.containerNo);
      }
    });
  }

  useEffect(() => {
    setActions(
      <div className="flex items-center gap-4">
        <div className="relative">
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 w-[200px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
        <ToggleGroup
          type="single"
          value={filterMode}
          onValueChange={(v) => v && setFilterMode(v as any)}
          className="bg-zinc-100 dark:bg-zinc-900 p-0.5 rounded-lg border h-8"
        >
          <ToggleGroupItem value="pending" className="h-7 px-3 rounded-md data-[state=on]:bg-white dark:data-[state=on]:bg-zinc-800 data-[state=on]:shadow-sm">
            <IconCalendar className="h-3.5 w-3.5 mr-2" />
            <span className="text-xs font-medium">Pending</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="planned" className="h-7 px-3 rounded-md data-[state=on]:bg-white dark:data-[state=on]:bg-zinc-800 data-[state=on]:shadow-sm">
            <IconCalendar className="h-3.5 w-3.5 mr-2" />
            <span className="text-xs font-medium">Planned</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="live" className="h-7 px-3 rounded-md data-[state=on]:bg-white dark:data-[state=on]:bg-zinc-800 data-[state=on]:shadow-sm">
            <IconShip className="h-3.5 w-3.5 mr-2" />
            <span className="text-xs font-medium">In Transit</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="delivered" className="h-7 px-3 rounded-md data-[state=on]:bg-white dark:data-[state=on]:bg-zinc-800 data-[state=on]:shadow-sm">
            <IconCircleCheck className="h-3.5 w-3.5 mr-2" />
            <span className="text-xs font-medium">Delivered</span>
          </ToggleGroupItem>
        </ToggleGroup>
        <Button onClick={trackAll} disabled={isPending} variant="outline" size="sm">
          <IconRefresh className={`mr-2 h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
          Refresh All
        </Button>
      </div>
    );

    return () => setActions(null);
  }, [isPending, containers, filterMode, searchQuery]);

  const filteredContainers = containers.filter(container => {
    const data = trackingData[container.containerNo];

    // Use the app's standardized status field
    const appStatus = (container.status || 'Pending').toLowerCase();

    // Mode filter using app status
    let matchesMode = false;
    if (filterMode === "pending") {
      matchesMode = appStatus === 'pending';
    } else if (filterMode === "planned") {
      matchesMode = appStatus === 'planned';
    } else if (filterMode === "live") {
      matchesMode = appStatus === 'in transit';
    } else {
      matchesMode = appStatus === 'delivered';
    }

    if (!matchesMode) return false;

    // Search filter
    if (!searchQuery) return true;

    const query = searchQuery.toLowerCase();

    // Search in container basic info
    if (
      container.containerNo.toLowerCase().includes(query) ||
      container.vbid.toLowerCase().includes(query) ||
      container.poNo.toLowerCase().includes(query) ||
      container.svbid.toLowerCase().includes(query) ||
      container.customerName.toLowerCase().includes(query)
    ) {
      return true;
    }

    // Search in tracking data
    if (data) {
      const dataValues = Object.values(data);
      for (const val of dataValues) {
        if (typeof val === 'string' && val.toLowerCase().includes(query)) {
          return true;
        }
      }
    }

    return false;
  });

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="rounded-md border flex-1 overflow-hidden flex flex-col">
        <div className="overflow-auto h-full relative">
          <table className="w-full text-[10px] caption-bottom text-sm">
            <TableHeader className="bg-muted sticky top-0 z-10 shadow-sm">
              <TableRow className="h-8">
                <TableHead className="p-1 h-8 min-w-[100px]">Shipment #</TableHead>
                <TableHead className="p-1 h-8 min-w-[100px]">Cont. No</TableHead>
                <TableHead className="p-1 h-8 min-w-[100px]">Progress</TableHead>
                <TableHead className="p-1 h-8 min-w-[80px]">From Port</TableHead>
                <TableHead className="p-1 h-8 min-w-[80px]">To Port</TableHead>
                <TableHead className="p-1 h-8 min-w-[80px]">Updated ETA</TableHead>
                <TableHead className="p-1 h-8 min-w-[50px] text-center">Raw</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContainers.map((container, idx) => {
                const data = trackingData[container.containerNo];
                const isLoading = loading[container.containerNo];

                return (
                  <TableRow key={idx} className="h-auto">
                    <TableCell className="p-1 align-middle whitespace-normal break-words">
                      <button
                        onClick={() => container.rawShipData && setDetailShipData(container.rawShipData)}
                        className="text-primary hover:text-primary/80 font-bold text-xs underline underline-offset-2 decoration-primary/30 hover:decoration-primary transition-colors"
                      >
                        {container.svbid || '-'}
                      </button>
                    </TableCell>
                    <TableCell className="p-1 align-middle whitespace-normal break-words font-medium">
                      {container.containerNo ? (
                        <button
                          onClick={() => {
                            const records = container.initialData;
                            const rawStr = records?.raw_json;
                            if (rawStr) {
                              try { setTrackingCachedJson(JSON.parse(rawStr)); } catch { setTrackingCachedJson(null); }
                            } else {
                              setTrackingCachedJson(null);
                            }
                            setTrackingContainer(container.containerNo);
                          }}
                          className="text-blue-500 hover:text-blue-400 font-mono text-xs font-bold underline underline-offset-2 decoration-blue-500/30 hover:decoration-blue-400 transition-colors"
                        >
                          {container.containerNo}
                        </button>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="p-1 align-middle">
                      {(() => {
                        if (!data) return <span className="text-muted-foreground">-</span>;
                        let progress = 0;
                        const status = data.status?.toLowerCase() || "";

                        if (status === 'delivered' || status === 'arrived') {
                          progress = 100;
                        } else if (data.pol_date && (data.pod_predictive_eta || data.pod_date) && now) {
                          const start = new Date(data.pol_date).getTime();
                          const end = new Date(data.pod_predictive_eta || data.pod_date).getTime();

                          if (end > start && now > start) {
                            progress = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
                          } else if (now >= end) {
                            progress = 99;
                          }
                        }

                        return (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <div className="h-1.5 w-12 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden border border-zinc-200 dark:border-zinc-700">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${progress >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="text-[9px] text-muted-foreground font-mono">{Math.round(progress)}%</span>
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="p-1 align-middle whitespace-normal break-words">{data?.from_port_name || "-"}</TableCell>
                    <TableCell className="p-1 align-middle whitespace-normal break-words">{data?.to_port_name || "-"}</TableCell>
                    <TableCell className="p-1 align-middle whitespace-normal break-words">
                      {container.updatedETA ? new Date(container.updatedETA).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : "-"}
                    </TableCell>
                    <TableCell className="p-1 align-middle text-center">
                      {(data?.raw_json) ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-primary hover:bg-primary/20"
                          onClick={() => setRawJsonData({ containerNo: container.containerNo, json: data.raw_json! })}
                          title="View Raw SeaRates JSON"
                        >
                          <IconCode className="h-4 w-4" />
                        </Button>
                      ) : "-"}
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredContainers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-sm p-4">
                    No active shipments found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </table>
        </div>
      </div>

      <Dialog open={!!rawJsonData} onOpenChange={(open) => !open && setRawJsonData(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 overflow-hidden border-border bg-zinc-950 dark:bg-zinc-950/90 shadow-2xl">
          <DialogHeader className="px-6 py-4 border-b border-white/10 shrink-0 bg-background/50 backdrop-blur-md">
            <DialogTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-[#E3FF34]">
              <IconCode className="h-4 w-4" />
              Raw Tracking Data <span className="text-muted-foreground/50 opacity-50 px-2 font-normal text-xs lowercase">searates json</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Container <span className="text-white font-bold">{rawJsonData?.containerNo}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto w-full bg-[#0d0d0d] font-mono text-[11px] leading-relaxed p-4 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
            <pre className="text-green-400/90 pb-8">
              {rawJsonData?.json ? (() => {
                try {
                  return JSON.stringify(JSON.parse(rawJsonData.json), null, 2);
                } catch(e) {
                  return rawJsonData.json;
                }
              })() : ''}
            </pre>
          </div>
        </DialogContent>
      </Dialog>

      <ShipmentTrackingPanel
        open={!!trackingContainer}
        onClose={() => { setTrackingContainer(null); setTrackingCachedJson(null); }}
        containerNo={trackingContainer || ''}
        cachedRawJson={trackingCachedJson}
      />

      <ShipmentDetailPanel
        open={!!detailShipData}
        onClose={() => setDetailShipData(null)}
        shipmentId={null}
        shipmentData={detailShipData}
        onTrack={(cn) => {
          setDetailShipData(null);
          setTrackingCachedJson(null);
          setTrackingContainer(cn);
        }}
      />
    </div>
  );
}
