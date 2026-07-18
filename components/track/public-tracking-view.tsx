"use client";

import { useMemo } from "react";
import {
  Ship, Anchor, MapPin, Clock, Navigation, Container, Compass, CheckCircle2,
  CircleDashed, Sparkles, Waves,
} from "lucide-react";

/**
 * PUBLIC light-mode tracking view — what external clients see when they open
 * the secure link from a shipment email. Read-only, no login, one container.
 */

export interface PublicTrackingData {
  containerNo: string;
  carrier?: string;
  status?: string;
  fromName?: string;
  fromCountry?: string;
  toName?: string;
  toCountry?: string;
  departureDate?: string;
  arrivalDate?: string;
  predictiveEta?: string;
  containerType?: string;
  vesselName?: string;
  vesselImo?: string;
  vesselFlag?: string;
  etaDays?: number | null;
  currentLat?: number;
  currentLng?: number;
  positionUpdatedAt?: string;
  segments: { vessel?: string; from?: string; to?: string }[];
  events: {
    description?: string;
    date?: string;
    location?: string;
    vessel?: string;
    voyage?: string;
    actual?: boolean;
  }[];
  delivered?: boolean;
  appUrl: string;
  mapSegments: {
    path: [number, number][];
    from: { name: string; country: string; lat: number; lng: number } | null;
    to: { name: string; country: string; lat: number; lng: number } | null;
    vessel: string;
  }[];
  dataUpdatedAt?: string;
}

const parseDate = (s?: string) => {
  if (!s) return null;
  const d = new Date(String(s).replace(" ", "T"));
  return isNaN(d.getTime()) ? null : d;
};
const fmtDate = (s?: string) => {
  const d = parseDate(s);
  return d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
};
const fmtDateTime = (s?: string) => {
  const d = parseDate(s);
  return d
    ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";
};

function journeyProgress(d: PublicTrackingData): number | null {
  if (d.delivered) return 100;
  const dep = parseDate(d.departureDate);
  const arr = parseDate(d.predictiveEta) || parseDate(d.arrivalDate);
  if (dep && arr && arr.getTime() > dep.getTime()) {
    const pct = ((Date.now() - dep.getTime()) / (arr.getTime() - dep.getTime())) * 100;
    return Math.max(2, Math.min(98, Math.round(pct)));
  }
  if (d.events.length > 0) {
    const done = d.events.filter((e) => e.actual !== false).length;
    return Math.max(2, Math.min(98, Math.round((done / d.events.length) * 100)));
  }
  return null;
}

export function PublicTrackingView({ data: d }: { data: PublicTrackingData }) {
  const delivered = !!d.delivered;
  const statusLabel = (d.status || "IN TRANSIT").replace(/_/g, " ").toUpperCase();
  const progress = journeyProgress(d);

  const milestone = useMemo(() => {
    if (delivered) return null;
    return (
      d.events
        .filter((e) => e.actual === false && parseDate(e.date))
        .sort((a, b) => parseDate(a.date)!.getTime() - parseDate(b.date)!.getTime())[0] || null
    );
  }, [d.events, delivered]);

  // ── Leaflet map (light tiles) rendered in a sandboxed iframe ──
  const leafletHtml = useMemo(() => {
    const hasPos = d.currentLat != null && d.currentLng != null;
    if (d.mapSegments.length === 0 && !hasPos) return null;
    // JSON-inject data; <-escape so "</script>" can never break out
    const payload = JSON.stringify({
      segments: d.mapSegments,
      pos: hasPos ? [d.currentLat, d.currentLng] : null,
      delivered,
    }).replace(/</g, "\\u003c");
    return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
html,body,#map{margin:0;padding:0;width:100%;height:100%;background:#e8edf3;}
.vb-pulse{width:16px;height:16px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 rgba(37,99,235,.45);animation:vbp 2s infinite;}
@keyframes vbp{0%{box-shadow:0 0 0 0 rgba(37,99,235,.45)}70%{box-shadow:0 0 0 16px rgba(37,99,235,0)}100%{box-shadow:0 0 0 0 rgba(37,99,235,0)}}
.leaflet-popup-content{font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:12px;}
</style></head><body><div id="map"></div><script>
var DATA=${payload};
var map=L.map('map',{zoomControl:false,attributionControl:true});
L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',{maxZoom:18,attribution:'&copy; OpenStreetMap &copy; CARTO'}).addTo(map);
L.control.zoom({position:'bottomright'}).addTo(map);
var all=[];
DATA.segments.forEach(function(seg,i){
  var pts=(seg.path||[]);
  pts.forEach(function(p){all.push(p);});
  if(pts.length>1){L.polyline(pts,{color:i===0?'#2563eb':'#0ea5e9',weight:3,opacity:.85,dashArray:i>0?'8,5':null}).addTo(map);}
  if(seg.from){L.circleMarker([seg.from.lat,seg.from.lng],{radius:6,color:'#2563eb',fillColor:'#2563eb',fillOpacity:1,weight:2}).addTo(map).bindPopup('<b>'+seg.from.name+(seg.from.country?', '+seg.from.country:'')+'</b>');}
  if(seg.to){L.circleMarker([seg.to.lat,seg.to.lng],{radius:6,color:'#059669',fillColor:'#059669',fillOpacity:1,weight:2}).addTo(map).bindPopup('<b>'+seg.to.name+(seg.to.country?', '+seg.to.country:'')+'</b>');}
});
if(DATA.pos){
  var icon=L.divIcon({className:'',html:'<div class="vb-pulse"></div>',iconSize:[16,16],iconAnchor:[8,8]});
  L.marker(DATA.pos,{icon:icon}).addTo(map).bindPopup('<b>🚢 Current Position</b><br>'+DATA.pos[0].toFixed(4)+', '+DATA.pos[1].toFixed(4));
  all.push(DATA.pos);
}
if(all.length>1){map.fitBounds(all,{padding:[45,45]});}
else if(all.length===1){map.setView(all[0],5);}
else{map.setView([20,0],2);}
</script></body></html>`;
  }, [d.mapSegments, d.currentLat, d.currentLng, delivered]);

  const chip = delivered
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : "bg-blue-50 text-blue-700 border-blue-200";

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800" style={{ colorScheme: "light" }}>
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Waves className="h-4 w-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-extrabold tracking-wide text-slate-900">
                VIDABUDDIES <span className="text-blue-600">ERP</span>
              </div>
              <div className="text-[9px] uppercase tracking-[0.2em] text-slate-400 -mt-0.5">Live Shipment Tracking</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!delivered && d.etaDays != null && d.etaDays > 0 && (
              <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
                <Clock className="h-3 w-3" /> {d.etaDays} day{d.etaDays === 1 ? "" : "s"} to arrival
              </span>
            )}
            <span className={`inline-flex items-center text-[10px] font-extrabold tracking-wider border rounded-full px-3 py-1 ${chip}`}>
              {statusLabel}
            </span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-gradient-to-b from-white to-slate-100 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center">
                  <Container className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-extrabold font-mono tracking-wide text-slate-900">{d.containerNo}</h1>
                  {d.carrier && <p className="text-xs text-slate-500">{d.carrier}</p>}
                </div>
              </div>
              <p className="mt-3 text-sm text-slate-600">
                <span className="text-blue-600">●</span> From <b className="text-slate-800">{d.fromName || "?"}{d.fromCountry ? `, ${d.fromCountry}` : ""}</b>
                <span className="text-slate-400 mx-2">›</span>
                <span className="text-emerald-600">●</span> To <b className="text-slate-800">{d.toName || "?"}{d.toCountry ? `, ${d.toCountry}` : ""}</b>
              </p>
            </div>

            {/* Progress */}
            {progress != null && (
              <div className="w-full sm:w-80">
                <div className="flex justify-between text-[11px] font-bold mb-1.5">
                  <span className="text-blue-600">{d.fromName || "Origin"}</span>
                  <span className={delivered ? "text-emerald-600" : "text-amber-600"}>
                    {delivered ? "DELIVERED" : `${progress}%`}
                  </span>
                  <span className="text-emerald-600">{d.toName || "Destination"}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${delivered ? "bg-emerald-500" : "bg-blue-600"} transition-all`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 grid gap-6 lg:grid-cols-[400px_1fr]">
        {/* LEFT column */}
        <div className="space-y-5 min-w-0">
          {delivered && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center">
              <div className="text-2xl">🎉</div>
              <div className="text-sm font-extrabold text-emerald-700 mt-1">Shipment Delivered</div>
              <div className="text-xs text-emerald-600/80 mt-1">This container has completed its journey.</div>
            </div>
          )}

          {milestone && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3.5">
              <div className="text-[9px] uppercase tracking-[0.15em] font-extrabold text-amber-600 flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" /> Next Milestone
              </div>
              <div className="text-sm font-bold text-amber-900 mt-1">{milestone.description || "Upcoming event"}</div>
              <div className="text-[11px] text-amber-700/80 mt-0.5">
                {milestone.location ? `${milestone.location} · ` : ""}Est. {fmtDateTime(milestone.date)}
              </div>
            </div>
          )}

          {/* Info cards */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: Anchor, label: "Departure", main: d.fromName || "—", sub1: d.fromCountry, sub2: fmtDate(d.departureDate) },
              { icon: MapPin, label: "Arrival", main: d.toName || "—", sub1: d.toCountry, sub2: fmtDate(d.arrivalDate) + (d.predictiveEta ? ` · AI ETA ${fmtDate(d.predictiveEta)}` : "") },
              { icon: Container, label: "Container", main: d.containerNo, sub1: d.containerType, sub2: d.carrier },
              { icon: Ship, label: "Vessel", main: d.vesselName || "—", sub1: d.vesselImo ? `IMO: ${d.vesselImo}` : undefined, sub2: d.vesselFlag ? `Flag: ${d.vesselFlag}` : undefined },
            ].map((c) => (
              <div key={c.label} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <div className="text-[9px] uppercase tracking-[0.15em] text-slate-400 font-bold flex items-center gap-1.5 mb-1.5">
                  <c.icon className="h-3 w-3" /> {c.label}
                </div>
                <div className="text-sm font-bold text-slate-900 break-words">{c.main}</div>
                {c.sub1 && <div className="text-[11px] text-slate-500 mt-0.5">{c.sub1}</div>}
                {c.sub2 && <div className="text-[11px] text-slate-400 mt-0.5 font-mono">{c.sub2}</div>}
              </div>
            ))}
          </div>

          {/* Route segments */}
          {d.segments.length > 0 && (
            <div>
              <h2 className="text-[10px] uppercase tracking-[0.15em] text-slate-400 font-extrabold mb-2">Route Segments</h2>
              <div className="space-y-2">
                {d.segments.map((s, i) => (
                  <div key={i} className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
                    <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Ship className="h-3 w-3 text-slate-400" /> {s.vessel || "Unknown Vessel"}
                    </div>
                    <div className="text-xs mt-1">
                      <span className="text-blue-600 font-semibold">{s.from || "?"}</span>
                      <span className="text-slate-300 mx-2">›</span>
                      <span className="text-emerald-600 font-semibold">{s.to || "?"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          {d.events.length > 0 && (
            <div>
              <h2 className="text-[10px] uppercase tracking-[0.15em] text-slate-400 font-extrabold mb-2">Event Timeline</h2>
              <div className="relative pl-5">
                <div className="absolute left-[5px] top-2 bottom-2 w-px bg-slate-200" />
                <div className="space-y-2.5">
                  {d.events.map((ev, i) => {
                    const est = ev.actual === false;
                    return (
                      <div key={i} className="relative">
                        <div className="absolute -left-5 top-3">
                          {est ? (
                            <CircleDashed className="h-3 w-3 text-amber-500 bg-slate-100 rounded-full" />
                          ) : (
                            <CheckCircle2 className="h-3 w-3 text-emerald-500 bg-slate-100 rounded-full" />
                          )}
                        </div>
                        <div className={`rounded-xl px-4 py-2.5 border shadow-sm ${est ? "bg-white/60 border-dashed border-slate-300" : "bg-white border-slate-200"}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className={`text-xs font-bold ${est ? "text-slate-500" : "text-slate-800"}`}>{ev.description || "Event"}</div>
                            <div className="text-[10px] text-slate-400 font-mono whitespace-nowrap pt-0.5">{fmtDateTime(ev.date)}</div>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-1 flex flex-wrap gap-x-3">
                            {ev.location && <span className="inline-flex items-center gap-1"><MapPin className="h-2.5 w-2.5" />{ev.location}</span>}
                            {ev.vessel && <span className="inline-flex items-center gap-1"><Ship className="h-2.5 w-2.5" />{ev.vessel}</span>}
                            {ev.voyage && <span className="inline-flex items-center gap-1"><Compass className="h-2.5 w-2.5" />{ev.voyage}</span>}
                            {est && <span className="text-amber-600 font-extrabold text-[9px] tracking-wider">ESTIMATED</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT column — map */}
        <div className="min-w-0">
          <div className="lg:sticky lg:top-20 space-y-3">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              {leafletHtml ? (
                <iframe
                  title="Live Tracking Map"
                  srcDoc={leafletHtml}
                  className="w-full h-[420px] lg:h-[calc(100vh-220px)] lg:min-h-[480px] border-0"
                  sandbox="allow-scripts allow-popups"
                />
              ) : (
                <div className="h-[420px] flex flex-col items-center justify-center text-slate-400 gap-2">
                  <Navigation className="h-6 w-6" />
                  <p className="text-xs">Route map will appear once tracking data is available</p>
                </div>
              )}
            </div>
            {d.currentLat != null && d.currentLng != null && (
              <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm flex items-center justify-between">
                <div className="text-xs text-slate-600 flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-60" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600" />
                  </span>
                  <b>Current Position:</b>
                  <span className="font-mono">{d.currentLat.toFixed(4)}°, {d.currentLng.toFixed(4)}°</span>
                </div>
                {d.positionUpdatedAt && (
                  <span className="text-[10px] text-slate-400">Updated {fmtDateTime(d.positionUpdatedAt)}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
          <span>
            Powered by <b className="text-slate-500">VidaBuddies ERP</b> — live vessel &amp; container intelligence
          </span>
          {d.dataUpdatedAt && <span>Data refreshed {fmtDateTime(d.dataUpdatedAt)}</span>}
        </div>
      </footer>
    </div>
  );
}
