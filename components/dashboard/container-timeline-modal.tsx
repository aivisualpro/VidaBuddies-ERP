"use client";

import { useMemo } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { MapContainer, TileLayer, Marker, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { IconShip, IconMapPin } from "@tabler/icons-react";

// Fix for default marker icons
const DefaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

export function ContainerTimelineModal({
  isOpen,
  onClose,
  containerNo,
  rawJson
}: {
  isOpen: boolean;
  onClose: () => void;
  containerNo: string;
  rawJson: string | null;
}) {
  const data = useMemo(() => {
    if (!rawJson) {
      return { _error: "raw_json is empty or null from the server. Check if Mongoose passed it into Zustand correctly." };
    }
    try {
      const parsed = typeof rawJson === "string" ? JSON.parse(rawJson) : rawJson;
      const finalData = parsed?.data ? parsed.data : parsed;
      return finalData;
    } catch(e) {
      return { _error: "Failed to parse rawJson string: " + String(e), _rawSub: typeof rawJson === 'string' ? rawJson.substring(0, 100) : "not-string" };
    }
  }, [rawJson]);

  // Prevent map from rendering on server
  if (typeof window === "undefined") return null;
  if (!isOpen) return null;

  const events = data?.containers?.[0]?.events || [];
  const routeData = data?.route_data;
  const metadata = data?.metadata;
  
  // Parse segments for polyline drawing
  const paths: { positions: [number, number][], isSea: boolean }[] = [];
  
  if (routeData && Array.isArray(routeData.route)) {
    routeData.route.forEach((segment: any) => {
      if (Array.isArray(segment.path)) {
        const positions = segment.path.map((p: any) => [p[0], p[1]] as [number, number]);
        paths.push({
          positions,
          isSea: segment.type === "SEA"
        });
      }
    });
  }

  // Calculate Map center bounds dynamically if coordinates exist
  let mapBounds: L.LatLngBounds | undefined = undefined;
  if (paths.length > 0) {
    const latlngs = paths.flatMap(p => p.positions);
    if (latlngs.length > 0) {
       mapBounds = L.latLngBounds(latlngs);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[90vw] w-[1400px] h-[90vh] p-0 flex flex-col overflow-hidden bg-slate-50 gap-0 z-[9999] rounded-xl shadow-2xl">
         {/* Top Header */ }
         <div className="flex items-center justify-between p-4 bg-white border-b shrink-0 h-[64px] shadow-sm relative z-10">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-blue-50 text-blue-600 shadow-inner">
                  <IconShip size={20} />
              </div>
              <div>
                  <DialogTitle className="text-xl font-black text-zinc-900 tracking-tight leading-none">
                    {containerNo} <span className="opacity-60 font-medium text-xs ml-2 tracking-normal lowercase bg-zinc-100 px-2 py-0.5 rounded-full">SeaRates native hook</span>
                  </DialogTitle>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] font-bold mt-1">
                      {metadata?.sealine_name || metadata?.sealine || "Direct Carrier"} • {data?.containers?.[0]?.size_type || "Container"}
                  </p>
              </div>
            </div>
            <div className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest ${metadata?.status === 'IN_TRANSIT' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                {metadata?.status?.replace(/_/g, " ") || "LIVE TRACKING"}
            </div>
         </div>

         {/* Content Split */ }
         <div className="flex flex-1 w-full overflow-hidden bg-white relative">
            
            {/* Left Sidebar Timeline */}
            <div className="w-[440px] bg-white border-r shadow-[4px_0_24px_rgba(0,0,0,0.03)] flex flex-col relative z-10 h-full">
                {/* Route Header summary */}
                <div className="p-6 border-b bg-gradient-to-br from-zinc-50 to-white/50 pb-8">
                    <div className="flex items-center justify-between gap-4 w-full">
                        <div className="flex-1">
                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Port of Loading</p>
                            <p className="text-[15px] font-black text-zinc-800 leading-tight">
                                {data?.locations?.find((l:any) => l.id === data?.route?.pol?.location)?.name || "Origin Port"}
                            </p>
                        </div>
                        <div className="w-16 border-b-2 border-dashed border-blue-200 relative flex justify-center items-center h-4">
                            <IconShip size={14} className="absolute text-blue-500 bg-zinc-50 rounded-full p-0.5 shadow-sm" />
                        </div>
                        <div className="flex-1 text-right">
                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Discharge Port</p>
                            <p className="text-[15px] font-black text-zinc-800 leading-tight">
                                {data?.locations?.find((l:any) => l.id === data?.route?.pod?.location)?.name || "Dest Port"}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Timeline Events */}
                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-zinc-200 scrollbar-track-transparent">
                    <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                      <IconMapPin size={12} className="text-zinc-400" />
                      Live Route Events
                    </h3>
                    
                    <div className="relative border-l-[3px] border-zinc-100 ml-3 space-y-6 pb-12">
                        {events.map((ev: any, idx: number) => {
                            const isActual = ev.actual;
                            const isLast = idx === events.length - 1;
                            
                            // Find location name
                            const locName = data?.locations?.find((l:any) => l.id === ev.location)?.name || ev.location || "Unknown Facility";
                            const fDate = new Date(ev.date).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' }).replace(',', '');
                            const vName = ev.vessel ? data?.vessels?.find((v:any) => v.id === ev.vessel)?.name : null;

                            return (
                                <div key={idx} className="relative pl-6 group">
                                    {/* Timeline dot */}
                                    <div className={`absolute -left-[10px] top-1 h-[17px] w-[17px] rounded-full border-[3px] bg-white flex items-center justify-center transition-colors 
                                        ${isActual ? 'border-blue-500' : 'border-zinc-200'} 
                                        ${isLast && isActual ? 'ring-4 ring-blue-100 shadow-sm' : ''}`}>
                                        <div className={`h-[5px] w-[5px] rounded-full ${isActual ? 'bg-blue-500' : 'bg-transparent'}`} />
                                    </div>

                                    {/* Location & Time */}
                                    <div className="flex justify-between items-start mb-1.5">
                                        <p className={`text-sm font-black ${isActual ? 'text-zinc-800' : 'text-zinc-400'}`}>{locName}</p>
                                        <p className="text-[10px] font-mono font-medium text-zinc-400 whitespace-nowrap ml-2 mt-0.5 bg-zinc-50 px-1.5 py-0.5 rounded">{fDate}</p>
                                    </div>

                                    {/* Card Block */}
                                    <div className={`rounded-lg p-3 mt-2 border text-xs transition-colors shrink-0 
                                      ${isActual ? 'bg-[#f4f7fa] border-blue-100/50 hover:border-blue-200' : 'bg-zinc-50/50 border-zinc-100 text-zinc-500'}`}>
                                        <p className={`font-semibold ${isActual ? 'text-[#1e293b]' : 'text-zinc-500'}`}>
                                            {ev.description}
                                        </p>
                                        
                                        {/* Meta Tags */}
                                        <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-2.5 text-[10px] font-bold">
                                            {ev.transport_type && (
                                                <div className="flex items-center gap-1">
                                                  <span className="text-zinc-400 uppercase tracking-wider">{ev.transport_type}</span>
                                                </div>
                                            )}
                                            {vName && (
                                                <div className="flex items-center gap-1 bg-white border shadow-sm px-1.5 py-0.5 rounded-sm">
                                                  <IconShip size={10} className="text-blue-500" />
                                                  <span className="text-zinc-700 font-mono tracking-tight">{vName}</span>
                                                </div>
                                            )}
                                            {ev.voyage && (
                                                <div className="flex items-center gap-1 px-1 py-0.5">
                                                  <span className="text-zinc-400">VOY:</span> 
                                                  <span className="font-mono text-zinc-600 bg-white border px-1 rounded-sm shadow-sm">{ev.voyage}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Right Map */}
            <div className="flex-1 relative h-full bg-[#e8eaed]">
                {!data || data._error ? (
                    <div className="absolute inset-0 flex flex-col p-6 items-center justify-center text-zinc-500 font-medium bg-red-50/50">
                      <p className="text-red-500 text-sm font-bold text-center">Missing Source Data</p>
                      <p className="mt-2 text-xs text-center max-w-sm">{data?._error || "Please fetch live data using the Refresh button. No SeaRates cache exists for this shipment yet."}</p>
                      {data?._rawSub && <pre className="mt-4 p-2 bg-black/5 text-black text-[10px] break-all border border-black/10 rounded w-full max-w-md">{data._rawSub}</pre>}
                    </div>
                ) : (
                    <MapContainer 
                        center={[20, 0]} 
                        zoom={2} 
                        scrollWheelZoom={true} 
                        style={{ height: "100%", width: "100%", zIndex: 0 }}
                        bounds={mapBounds}
                        boundsOptions={{ padding: [50, 50] }}
                    >
                        <TileLayer
                            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                        />
                        
                        {/* Render all path segments */}
                        {paths.map((route, i) => (
                            <Polyline
                                key={i}
                                positions={route.positions}
                                color={route.isSea ? "#0066ff" : "#9ca3af"}
                                weight={route.isSea ? 3 : 2}
                                dashArray={route.isSea ? "" : "5, 5"}
                                opacity={0.8}
                            />
                        ))}

                        {/* Render Departure/Origin Pins */}
                        {data?.locations?.map((l:any) => (
                            <Marker key={l.id} position={[l.lat, l.lng]} />
                        ))}

                        {/* Render Current Position Live Marker (AIS Tracker) */}
                        {routeData?.ais?.data?.last_vessel_position && (
                            <Marker 
                                position={[routeData.ais.data.last_vessel_position.lat, routeData.ais.data.last_vessel_position.lng]}
                                zIndexOffset={1000}
                                icon={L.divIcon({
                                  html: `<div style="background-color: #ef4444; width: 14px; height: 14px; border-radius: 50%; box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.3), 0 4px 6px -1px rgba(0, 0, 0, 0.5); border: 2px solid white;"></div>`,
                                  className: '',
                                  iconSize: [20, 20],
                                  iconAnchor: [10, 10]
                                })}
                            />
                        )}
                    </MapContainer>
                )}
            </div>
         </div>
      </DialogContent>
    </Dialog>
  );
}
