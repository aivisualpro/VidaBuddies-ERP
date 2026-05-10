"use client";

import { useState, useEffect, useMemo } from "react";
import { X, Ship, Anchor, MapPin, Calendar, Clock, Navigation, ChevronRight, Loader2, AlertTriangle, Container, Globe, Compass } from "lucide-react";
import { cn } from "@/lib/utils";

interface ShipmentTrackingPanelProps {
  open: boolean;
  onClose: () => void;
  containerNo: string;
  cachedRawJson?: any;
}

export function ShipmentTrackingPanel({ open, onClose, containerNo, cachedRawJson }: ShipmentTrackingPanelProps) {
  const [rawData, setRawData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !containerNo) return;
    setError(null);
    setRawData(null);

    // If parent already provided cached data, use it instantly
    if (cachedRawJson) {
      setRawData(cachedRawJson);
      return;
    }

    // Step 1: Try DB cache first (fast — just reads from MongoDB)
    setLoading(true);
    fetch(`/api/admin/vb-shipping/tracking?container=${encodeURIComponent(containerNo)}`)
      .then(r => r.json())
      .then(cacheResult => {
        if (cacheResult.cached && cacheResult.data) {
          // Found cached raw_json in MongoDB — instant!
          setRawData(cacheResult.data);
          setLoading(false);
          return;
        }
        // Step 2: No cache — fetch live from SeaRates API
        return fetch(`/api/admin/searates-raw?container=${encodeURIComponent(containerNo)}`)
          .then(r => r.json())
          .then(json => {
            if (json.error) { setError(json.error); return; }
            if (json.status === 'error') { setError(json.message || 'SeaRates error'); return; }
            setRawData(json);
          });
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [open, containerNo, cachedRawJson]);

  // Parse data
  const d = rawData?.data || {};
  const md = d.metadata || {};
  const locations = d.locations || [];
  const facilities = d.facilities || [];
  const vessels = d.vessels || [];
  const cont = d.containers?.[0] || {};
  const events = cont.events || [];
  const route = d.route || {};
  const routeData = d.route_data || {};
  const routeSegments = routeData.route || [];

  const byId = (arr: any[], id: string) => arr.find((x: any) => x?.id === id);
  const polLoc = route.pol?.location ? byId(locations, route.pol.location) : null;
  const podLoc = route.pod?.location ? byId(locations, route.pod.location) : null;

  // Current position
  const pin = routeData.pin;
  const aisPos = routeData.ais?.data?.last_vessel_position;
  const currentPos = aisPos?.lat ? aisPos : (pin ? { lat: pin[0], lng: pin[1] } : null);

  // AIS data
  const aisData = routeData.ais?.data || {};

  // Sort events by date
  const sortedEvents = useMemo(() => {
    return [...events].sort((a: any, b: any) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());
  }, [events]);

  // Map URL with route polyline
  const mapUrl = useMemo(() => {
    if (!routeSegments.length && !currentPos) return null;
    // Build all path points for the route
    const allPoints: [number, number][] = [];
    routeSegments.forEach((seg: any) => {
      (seg.path || []).forEach((p: [number, number]) => allPoints.push(p));
    });
    if (allPoints.length === 0 && currentPos) {
      allPoints.push([currentPos.lat, currentPos.lng]);
    }
    // Use OpenStreetMap static map or Leaflet embed
    return true; // We'll use leaflet inline
  }, [routeSegments, currentPos]);

  const fmtDate = (s: string) => {
    if (!s) return '—';
    const d = new Date(s.replace(' ', 'T'));
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };
  const fmtDateTime = (s: string) => {
    if (!s) return '—';
    const d = new Date(s.replace(' ', 'T'));
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // Days between two dates
  const daysBetween = (a: string, b: string) => {
    if (!a || !b) return null;
    const d1 = new Date(a.replace(' ', 'T')), d2 = new Date(b.replace(' ', 'T'));
    return Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
  };

  // ETA days remaining
  const etaDays = useMemo(() => {
    const eta = aisData.discharge_port?.date || route.pod?.date;
    if (!eta) return null;
    return daysBetween(new Date().toISOString(), eta);
  }, [aisData, route]);

  // Status color
  const statusColor = (status: string) => {
    const s = (status || '').toUpperCase();
    if (s.includes('DELIVER') || s.includes('ARRIV')) return 'text-emerald-400';
    if (s.includes('TRANSIT') || s.includes('LOAD')) return 'text-blue-400';
    if (s.includes('DEPART')) return 'text-cyan-400';
    return 'text-amber-400';
  };

  // Build leaflet map HTML
  const leafletHtml = useMemo(() => {
    const allPoints: [number, number][] = [];
    const segments: { points: [number, number][]; vessel?: string; from?: string; to?: string }[] = [];
    routeSegments.forEach((seg: any) => {
      const pts = (seg.path || []).map((p: [number, number]) => [p[0], p[1]] as [number, number]);
      if (pts.length) {
        segments.push({ points: pts, vessel: seg.vessel?.name, from: seg.from?.name, to: seg.to?.name });
        pts.forEach((p: [number, number]) => allPoints.push(p));
      }
    });

    const vesselPos = currentPos ? `[${currentPos.lat}, ${currentPos.lng}]` : null;
    const portMarkers = routeSegments.map((seg: any) => {
      const markers: string[] = [];
      if (seg.from?.lat && seg.from?.lng) {
        markers.push(`L.circleMarker([${seg.from.lat}, ${seg.from.lng}], {radius:6,color:'#3b82f6',fillColor:'#3b82f6',fillOpacity:1,weight:2}).addTo(map).bindPopup('<b>${(seg.from.name||'').replace(/'/g,"\\'")}${seg.from.country ? ', '+seg.from.country : ''}</b>');`);
      }
      if (seg.to?.lat && seg.to?.lng) {
        markers.push(`L.circleMarker([${seg.to.lat}, ${seg.to.lng}], {radius:6,color:'#10b981',fillColor:'#10b981',fillOpacity:1,weight:2}).addTo(map).bindPopup('<b>${(seg.to.name||'').replace(/'/g,"\\'")}${seg.to.country ? ', '+seg.to.country : ''}</b>');`);
      }
      return markers.join('\n');
    }).join('\n');

    const segLines = segments.map((seg, i) => {
      const coords = seg.points.map(p => `[${p[0]},${p[1]}]`).join(',');
      const colors = ['#3b82f6', '#6366f1', '#8b5cf6', '#06b6d4'];
      const color = colors[i % colors.length];
      return `L.polyline([${coords}],{color:'${color}',weight:3,opacity:0.8,dashArray:${i > 0 ? "'8,4'" : 'null'}}).addTo(map);`;
    }).join('\n');

    const bounds = allPoints.length > 1
      ? `map.fitBounds([${allPoints.map(p => `[${p[0]},${p[1]}]`).join(',')}], {padding:[40,40]});`
      : vesselPos ? `map.setView(${vesselPos}, 5);` : `map.setView([20,0], 2);`;

    return `<!DOCTYPE html><html><head>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{margin:0;padding:0;width:100%;height:100%;background:#0f172a;}
.leaflet-container{background:#0f172a!important;}
.vessel-icon{background:none;border:none;}
.pulse-dot{width:14px;height:14px;background:#ef4444;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 0 rgba(239,68,68,0.7);animation:pulse 2s infinite;}
@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(239,68,68,0.7)}70%{box-shadow:0 0 0 14px rgba(239,68,68,0)}100%{box-shadow:0 0 0 0 rgba(239,68,68,0)}}
</style></head><body><div id="map"></div><script>
var map=L.map('map',{zoomControl:false,attributionControl:false});
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{maxZoom:18}).addTo(map);
L.control.zoom({position:'bottomright'}).addTo(map);
${segLines}
${portMarkers}
${vesselPos ? `
var vesselIcon=L.divIcon({className:'vessel-icon',html:'<div class="pulse-dot"></div>',iconSize:[14,14],iconAnchor:[7,7]});
L.marker(${vesselPos},{icon:vesselIcon}).addTo(map).bindPopup('<b>🚢 Current Position</b><br>Lat: ${currentPos?.lat?.toFixed(4)}, Lng: ${currentPos?.lng?.toFixed(4)}');
` : ''}
${bounds}
</script></body></html>`;
  }, [routeSegments, currentPos]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          "fixed top-0 right-0 z-50 h-full w-[80vw] bg-zinc-950 border-l border-zinc-800 shadow-2xl transition-transform duration-500 ease-out flex flex-col",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="shrink-0 px-6 py-4 border-b border-zinc-800/80 bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                <Container className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight font-mono">{containerNo}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  {md.sealine_name && <span className="text-xs text-zinc-400">{md.sealine_name}</span>}
                  {md.status && (
                    <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border", statusColor(md.status),
                      md.status?.includes('TRANSIT') ? 'bg-blue-500/10 border-blue-500/30' :
                      md.status?.includes('ARRIV') ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'
                    )}>
                      {md.status?.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="h-8 w-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Quick stats bar */}
          {!loading && rawData && (
            <div className="flex items-center gap-4 mt-4">
              {polLoc && (
                <div className="flex items-center gap-1.5 text-xs">
                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                  <span className="text-zinc-500">From</span>
                  <span className="text-zinc-200 font-medium">{polLoc.name}, {polLoc.country}</span>
                </div>
              )}
              {polLoc && podLoc && <ChevronRight className="h-3 w-3 text-zinc-600" />}
              {podLoc && (
                <div className="flex items-center gap-1.5 text-xs">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-zinc-500">To</span>
                  <span className="text-zinc-200 font-medium">{podLoc.name}, {podLoc.country}</span>
                </div>
              )}
              {etaDays != null && etaDays > 0 && (
                <div className="ml-auto flex items-center gap-1.5 text-xs bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1">
                  <Clock className="h-3 w-3 text-amber-400" />
                  <span className="text-amber-300 font-bold">{etaDays} days</span>
                  <span className="text-amber-400/60">to arrival</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-3" />
                <p className="text-sm text-zinc-400">Fetching live tracking data...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-3" />
                <p className="text-sm text-zinc-400">{error}</p>
              </div>
            </div>
          ) : rawData ? (
            <div className="flex-1 flex overflow-hidden">
              {/* LEFT COLUMN — Details + Timeline */}
              <div className="w-[45%] shrink-0 overflow-y-auto border-r border-zinc-800">
                {/* Info cards */}
                <div className="p-4 grid grid-cols-2 gap-3">
                  <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 uppercase tracking-wider mb-2">
                      <Anchor className="h-3 w-3" /> Departure
                    </div>
                    <p className="text-sm font-bold text-white">{polLoc?.name || aisData.departure_port?.code || '—'}</p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">{polLoc?.country || ''}</p>
                    <p className="text-[10px] text-zinc-500 mt-1 font-mono">{fmtDate(route.pol?.date || aisData.departure_port?.date)}</p>
                    {route.pol?.actual && <span className="text-[9px] text-emerald-400 font-bold">ACTUAL</span>}
                  </div>
                  <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 uppercase tracking-wider mb-2">
                      <MapPin className="h-3 w-3" /> Arrival
                    </div>
                    <p className="text-sm font-bold text-white">{podLoc?.name || aisData.discharge_port?.name || '—'}</p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">{podLoc?.country || ''}</p>
                    <p className="text-[10px] text-zinc-500 mt-1 font-mono">{fmtDate(route.pod?.date || aisData.discharge_port?.date)}</p>
                    {route.pod?.predictive_eta && (
                      <p className="text-[9px] text-cyan-400 font-bold mt-0.5">AI ETA: {fmtDate(route.pod.predictive_eta)}</p>
                    )}
                  </div>
                  <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 uppercase tracking-wider mb-2">
                      <Container className="h-3 w-3" /> Container
                    </div>
                    <p className="text-sm font-bold text-white font-mono">{containerNo}</p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">{cont.size_type || cont.iso_code || '—'}</p>
                    <p className="text-[10px] text-zinc-500 mt-1">{md.sealine_name || md.sealine || '—'}</p>
                  </div>
                  {aisData.vessel?.name && (
                    <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-3">
                      <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 uppercase tracking-wider mb-2">
                        <Ship className="h-3 w-3" /> Vessel
                      </div>
                      <p className="text-sm font-bold text-white">{aisData.vessel.name}</p>
                      {aisData.vessel.imo && <p className="text-[10px] text-zinc-400 mt-0.5">IMO: {aisData.vessel.imo}</p>}
                      {aisData.vessel.flag && <p className="text-[10px] text-zinc-500 mt-0.5">Flag: {aisData.vessel.flag}</p>}
                    </div>
                  )}
                </div>

                {/* Route segments */}
                {routeSegments.length > 0 && (
                  <div className="px-4 pb-3">
                    <h3 className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold mb-2 px-1">Route Segments</h3>
                    <div className="flex flex-col gap-2">
                      {routeSegments.map((seg: any, i: number) => (
                        <div key={i} className="bg-zinc-900/60 border border-zinc-800 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                            <Ship className="h-3 w-3 text-blue-400" />
                            <span className="font-semibold text-zinc-200 truncate">{seg.vessel?.name || 'Unknown'}</span>
                          </div>
                          <div className="flex items-center gap-1 mt-1.5 text-[10px]">
                            <span className="text-blue-400 font-medium truncate">{seg.from?.name || '?'}</span>
                            <ChevronRight className="h-2.5 w-2.5 text-zinc-600 shrink-0" />
                            <span className="text-emerald-400 font-medium truncate">{seg.to?.name || '?'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Timeline */}
                <div className="px-4 pb-6">
                  <h3 className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold mb-3 px-1">Event Timeline</h3>
                  <div className="relative pl-6">
                    <div className="absolute left-[9px] top-2 bottom-2 w-px bg-gradient-to-b from-blue-500 via-zinc-700 to-zinc-800" />
                    {sortedEvents.map((ev: any, i: number) => {
                      const evLoc = ev.location ? byId(locations, ev.location) : null;
                      const evVessel = ev.vessel ? byId(vessels, ev.vessel) : null;
                      const isActual = ev.actual === true;
                      return (
                        <div key={i} className="relative mb-3 last:mb-0">
                          <div className={cn(
                            "absolute -left-6 top-1 h-[18px] w-[18px] rounded-full border-2 flex items-center justify-center",
                            isActual ? "bg-blue-500 border-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.5)]" : "bg-zinc-800 border-zinc-600"
                          )}>
                            {ev.type === 'sea' ? <Ship className="h-2.5 w-2.5 text-white" /> : <MapPin className="h-2.5 w-2.5 text-white" />}
                          </div>
                          <div className={cn("bg-zinc-900/50 border rounded-lg p-3 transition-all hover:bg-zinc-900",
                            isActual ? "border-zinc-700" : "border-zinc-800/50 border-dashed opacity-70"
                          )}>
                            <div className="flex items-center justify-between">
                              <span className={cn("text-xs font-bold", isActual ? "text-white" : "text-zinc-500")}>
                                {ev.description || ev.status || ev.event_code || 'Event'}
                              </span>
                              <span className={cn("text-[10px] font-mono", isActual ? "text-zinc-300" : "text-zinc-600")}>
                                {fmtDateTime(ev.date)}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                              {evLoc && <span className="text-[10px] text-zinc-400 flex items-center gap-1"><MapPin className="h-2.5 w-2.5" /> {evLoc.name}{evLoc.country ? `, ${evLoc.country}` : ''}</span>}
                              {evVessel && <span className="text-[10px] text-zinc-400 flex items-center gap-1"><Ship className="h-2.5 w-2.5" /> {evVessel.name}</span>}
                              {ev.voyage && <span className="text-[10px] text-zinc-500 flex items-center gap-1"><Compass className="h-2.5 w-2.5" /> {ev.voyage}</span>}
                              {!isActual && <span className="text-[9px] text-amber-500/80 font-bold uppercase">Estimated</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {sortedEvents.length === 0 && <p className="text-xs text-zinc-500 py-4">No events available</p>}
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN — Map (full height) */}
              <div className="flex-1 relative">
                <iframe
                  srcDoc={leafletHtml}
                  className="w-full h-full border-0"
                  sandbox="allow-scripts"
                  title="Tracking Map"
                />
                {currentPos && (
                  <div className="absolute bottom-3 left-3 bg-zinc-900/90 backdrop-blur-sm border border-zinc-700 rounded-lg px-3 py-2 text-[10px]">
                    <div className="flex items-center gap-1.5 text-zinc-300">
                      <Navigation className="h-3 w-3 text-red-400" />
                      <span className="font-mono">{currentPos.lat?.toFixed(4)}°, {currentPos.lng?.toFixed(4)}°</span>
                    </div>
                    {aisPos?.updated_at && <p className="text-zinc-500 mt-0.5">Updated: {fmtDateTime(aisPos.updated_at)}</p>}
                  </div>
                )}
                {aisData.vessel?.name && (
                  <div className="absolute top-3 right-3 bg-zinc-900/90 backdrop-blur-sm border border-zinc-700 rounded-lg px-3 py-2 text-[10px]">
                    <div className="flex items-center gap-1.5 text-zinc-300">
                      <Ship className="h-3 w-3 text-blue-400" />
                      <span className="font-semibold">{aisData.vessel.name}</span>
                    </div>
                    {aisData.vessel.imo && <p className="text-zinc-500 mt-0.5">IMO: {aisData.vessel.imo}</p>}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
