"use client";

import { MapContainer, TileLayer, Marker, Polyline, CircleMarker, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { IconShip, IconMapPin } from "@tabler/icons-react";
import { useState, useEffect, useMemo } from "react";
import { useTheme } from "next-themes";
import { ShipmentTrackingPanel } from "@/components/admin/shipment-tracking-panel";

export interface MapLocation {
    lat: number;
    lng: number;
    title: string;
    containerNo: string;
    vbid?: string;
    status?: string;
    origin?: string;
    destination?: string;
    eta?: string;
    departure?: string;
    updatedAt?: string;
    vessel?: string;
    type?: string;
    rawJson?: string;
    originLat?: number;
    originLng?: number;
    destLat?: number;
    destLng?: number;
}

function formatDate(dateString?: string) {
    if (!dateString) return "N/A";
    try {
        return new Date(dateString).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return dateString || "N/A";
    }
}

function getPortCode(name?: string) {
    if (!name) return "UNK";
    return name.substring(0, 3).toUpperCase();
}

// Generate curved arc points between two coords (great circle approximation)
function generateArcPoints(from: [number, number], to: [number, number], numPoints = 50): [number, number][] {
    const points: [number, number][] = [];
    for (let i = 0; i <= numPoints; i++) {
        const t = i / numPoints;
        const lat = from[0] + (to[0] - from[0]) * t;
        let lng;
        // Handle date line crossing
        let dLng = to[1] - from[1];
        if (Math.abs(dLng) > 180) {
            dLng = dLng > 0 ? dLng - 360 : dLng + 360;
        }
        lng = from[1] + dLng * t;
        // Add arc curvature
        const arc = Math.sin(t * Math.PI) * (Math.abs(to[0] - from[0]) * 0.15 + 5);
        points.push([lat + arc, lng]);
    }
    return points;
}

// Custom ship icon using DivIcon
function createShipIcon(isSelected: boolean) {
    return L.divIcon({
        html: `<div style="
            width: ${isSelected ? 40 : 32}px;
            height: ${isSelected ? 40 : 32}px;
            background: ${isSelected ? 'linear-gradient(135deg, #3b82f6, #06b6d4)' : 'linear-gradient(135deg, #1e40af, #3b82f6)'};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 0 ${isSelected ? 20 : 12}px ${isSelected ? 'rgba(59,130,246,0.8)' : 'rgba(59,130,246,0.5)'}, 0 0 ${isSelected ? 40 : 0}px rgba(6,182,212,0.3);
            border: 2px solid ${isSelected ? '#67e8f9' : 'rgba(255,255,255,0.3)'};
            transition: all 0.3s ease;
            animation: ${isSelected ? 'none' : 'pulse-glow 3s ease-in-out infinite'};
        ">
            <svg width="${isSelected ? 22 : 18}" height="${isSelected ? 22 : 18}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
                <path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/>
                <path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/>
                <path d="M12 10v-4"/>
                <path d="M12 2v4"/>
            </svg>
        </div>`,
        className: 'ship-marker-icon',
        iconSize: [isSelected ? 40 : 32, isSelected ? 40 : 32],
        iconAnchor: [isSelected ? 20 : 16, isSelected ? 20 : 16],
    });
}

// Destination port icon
function createDestIcon() {
    return L.divIcon({
        html: `<div style="
            width: 14px; height: 14px;
            background: linear-gradient(135deg, #f59e0b, #ef4444);
            border-radius: 50%;
            border: 2px solid rgba(255,255,255,0.6);
            box-shadow: 0 0 8px rgba(245,158,11,0.6);
        "></div>`,
        className: 'dest-marker-icon',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
    });
}

// Origin port icon
function createOriginIcon() {
    return L.divIcon({
        html: `<div style="
            width: 10px; height: 10px;
            background: linear-gradient(135deg, #22c55e, #10b981);
            border-radius: 50%;
            border: 2px solid rgba(255,255,255,0.5);
            box-shadow: 0 0 6px rgba(34,197,94,0.5);
        "></div>`,
        className: 'origin-marker-icon',
        iconSize: [10, 10],
        iconAnchor: [5, 5],
    });
}

// Animated route component
function AnimatedRoute({ from, to, progress, isSelected }: {
    from: [number, number];
    to: [number, number];
    progress: number;
    isSelected: boolean;
}) {
    const arcPoints = useMemo(() => generateArcPoints(from, to), [from, to]);
    const splitIdx = Math.max(1, Math.floor(arcPoints.length * (progress / 100)));
    const travelledPoints = arcPoints.slice(0, splitIdx);
    const remainingPoints = arcPoints.slice(splitIdx - 1);

    return (
        <>
            {/* Full route - faded */}
            <Polyline
                positions={arcPoints}
                pathOptions={{
                    color: isSelected ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.08)',
                    weight: isSelected ? 3 : 2,
                    dashArray: '6 8',
                }}
            />
            {/* Travelled portion - solid */}
            {travelledPoints.length > 1 && (
                <Polyline
                    positions={travelledPoints}
                    pathOptions={{
                        color: isSelected ? '#3b82f6' : '#1d4ed8',
                        weight: isSelected ? 3.5 : 2.5,
                        opacity: isSelected ? 0.9 : 0.6,
                    }}
                />
            )}
            {/* Remaining portion - dashed */}
            {remainingPoints.length > 1 && (
                <Polyline
                    positions={remainingPoints}
                    pathOptions={{
                        color: isSelected ? '#67e8f9' : '#60a5fa',
                        weight: isSelected ? 2 : 1.5,
                        dashArray: '4 6',
                        opacity: isSelected ? 0.6 : 0.3,
                    }}
                />
            )}
        </>
    );
}

// Compute progress percentage
function computeProgress(departure?: string, eta?: string): number {
    if (!departure || !eta) return 50;
    const start = new Date(departure).getTime();
    const end = new Date(eta).getTime();
    const now = Date.now();
    if (end <= start) return 0;
    return Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
}

export default function ShipmentMap({ locations }: { locations: MapLocation[] }) {
    const center: [number, number] = [20, 0];
    const [hoverInfo, setHoverInfo] = useState<{ loc: MapLocation } | null>(null);
    const [selectedContainer, setSelectedContainer] = useState<MapLocation | null>(null);
    const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme === "dark";
    const tileUrl = isDark
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

    return (
        <div className="h-[500px] w-full rounded-md border bg-background shadow-sm relative z-0 group overflow-hidden">
            <style>{`
                @keyframes pulse-glow {
                    0%, 100% { box-shadow: 0 0 12px rgba(59,130,246,0.5); }
                    50% { box-shadow: 0 0 24px rgba(59,130,246,0.8), 0 0 40px rgba(6,182,212,0.3); }
                }
                .ship-marker-icon, .dest-marker-icon, .origin-marker-icon {
                    background: none !important;
                    border: none !important;
                }
            `}</style>

            <MapContainer center={center} zoom={2} scrollWheelZoom={true} style={{ height: "100%", width: "100%", zIndex: 0 }}>
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
                    url={tileUrl}
                    key={tileUrl}
                />

                {/* Render routes + markers for each location */}
                {locations.map((loc, idx) => {
                    const isSelected = selectedIdx === idx;
                    const hasOrigin = loc.originLat != null && loc.originLng != null;
                    const hasDest = loc.destLat != null && loc.destLng != null;
                    const progress = computeProgress(loc.departure, loc.eta);

                    return (
                        <span key={idx}>
                            {/* Route: origin → current position (if origin available) */}
                            {hasOrigin && (
                                <>
                                    <AnimatedRoute
                                        from={[loc.originLat!, loc.originLng!]}
                                        to={[loc.lat, loc.lng]}
                                        progress={100}
                                        isSelected={isSelected}
                                    />
                                    <Marker
                                        position={[loc.originLat!, loc.originLng!]}
                                        icon={createOriginIcon()}
                                    />
                                </>
                            )}

                            {/* Route: current position → destination (if dest available) */}
                            {hasDest && (
                                <>
                                    <AnimatedRoute
                                        from={[loc.lat, loc.lng]}
                                        to={[loc.destLat!, loc.destLng!]}
                                        progress={0}
                                        isSelected={isSelected}
                                    />
                                    <Marker
                                        position={[loc.destLat!, loc.destLng!]}
                                        icon={createDestIcon()}
                                    />
                                </>
                            )}

                            {/* Full route if both origin and dest */}
                            {hasOrigin && hasDest && (
                                <AnimatedRoute
                                    from={[loc.originLat!, loc.originLng!]}
                                    to={[loc.destLat!, loc.destLng!]}
                                    progress={progress}
                                    isSelected={isSelected}
                                />
                            )}

                            {/* Ship marker at current position */}
                            <Marker
                                position={[loc.lat, loc.lng]}
                                icon={createShipIcon(isSelected)}
                                eventHandlers={{
                                    mouseover: () => setHoverInfo({ loc }),
                                    mouseout: () => setHoverInfo(null),
                                    click: () => {
                                        setSelectedIdx(isSelected ? null : idx);
                                        if (loc.containerNo) setSelectedContainer(loc);
                                    },
                                }}
                            />

                            {/* Pulsing ring around ship */}
                            <CircleMarker
                                center={[loc.lat, loc.lng]}
                                radius={isSelected ? 20 : 12}
                                pathOptions={{
                                    color: 'rgba(59,130,246,0.3)',
                                    fillColor: 'rgba(59,130,246,0.05)',
                                    fillOpacity: 1,
                                    weight: 1,
                                }}
                            />
                        </span>
                    );
                })}
            </MapContainer>

            {/* Hover Card */}
            {hoverInfo && (
                <div
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[1000] pointer-events-none transition-opacity duration-200"
                    style={{ filter: 'drop-shadow(0 10px 15px rgba(0,0,0,0.5))' }}
                >
                    <div className="w-[320px] bg-zinc-950 text-white rounded-xl overflow-hidden font-sans border border-zinc-800">
                        {/* Map Header */}
                        <div className="h-[140px] w-full relative bg-zinc-900 bg-gradient-to-b from-blue-900/20 to-zinc-900">
                            <img
                                src={`https://static-maps.yandex.ru/1.x/?lang=en_US&ll=${hoverInfo.loc.lng},${hoverInfo.loc.lat}&z=10&l=map&size=320,140`}
                                alt="Location Map"
                                className="w-full h-full object-cover opacity-80"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="relative">
                                    <div className="absolute -inset-2 bg-blue-500/30 rounded-full animate-ping"></div>
                                    <IconMapPin className="text-red-500 fill-current h-8 w-8 drop-shadow-lg relative z-10" />
                                </div>
                            </div>
                            <div className={`absolute top-2 right-2 px-2 py-1 rounded text-[10px] font-medium border uppercase tracking-wider backdrop-blur-md
                                ${['on water', 'in_transit', 'in transit'].includes(hoverInfo.loc.status?.toLowerCase() || '') ? 'bg-blue-500/80 text-white border-blue-400/30' :
                                  ['arrived', 'delivered'].includes(hoverInfo.loc.status?.toLowerCase() || '') ? 'bg-green-500/80 text-white border-green-400/30' :
                                  'bg-black/60 text-white border-white/10'}`}>
                                {hoverInfo.loc.status || "IN_TRANSIT"}
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-4 space-y-4">
                            <div>
                                <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                                    <span>{formatDate(hoverInfo.loc.updatedAt)}</span>
                                    <span className="truncate max-w-[120px]">{hoverInfo.loc.vessel || "Unknown Vessel"}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="text-center min-w-[50px]">
                                        <div className="text-3xl font-bold tracking-tight">{getPortCode(hoverInfo.loc.origin)}</div>
                                        <div className="text-[10px] text-zinc-400 truncate max-w-[80px] mx-auto" title={hoverInfo.loc.origin}>{hoverInfo.loc.origin}</div>
                                    </div>
                                    <div className="flex-1 flex flex-col items-center px-2 relative">
                                        <div className="h-1 w-full bg-zinc-800 rounded-full mt-4 mb-2 relative">
                                            <div
                                                className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-1000"
                                                style={{
                                                    width: `${computeProgress(hoverInfo.loc.departure, hoverInfo.loc.eta)}%`
                                                }}
                                            />
                                            <div
                                                className="absolute top-1/2 -translate-y-1/2 -ml-2.5 transition-all duration-1000 z-10"
                                                style={{
                                                    left: `${computeProgress(hoverInfo.loc.departure, hoverInfo.loc.eta)}%`
                                                }}
                                            >
                                                <div className="bg-blue-500 text-white p-1 rounded-full shadow-lg shadow-blue-900/50">
                                                    <IconShip className="h-4 w-4 fill-current" />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-[10px] text-zinc-500 mt-1 whitespace-nowrap">
                                            {hoverInfo.loc.eta ? `${Math.max(0, Math.ceil((new Date(hoverInfo.loc.eta).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} Days left` : "ETA N/A"}
                                        </div>
                                    </div>
                                    <div className="text-center min-w-[50px]">
                                        <div className="text-3xl font-bold tracking-tight">{getPortCode(hoverInfo.loc.destination)}</div>
                                        <div className="text-[10px] text-zinc-400 truncate max-w-[80px] mx-auto" title={hoverInfo.loc.destination}>{hoverInfo.loc.destination}</div>
                                    </div>
                                </div>
                            </div>
                            <div className="h-px bg-zinc-800 w-full" />
                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div>
                                    <div className="text-[10px] text-zinc-500 uppercase">VBID</div>
                                    <div className="font-semibold text-sm truncate" title={hoverInfo.loc.vbid}>{hoverInfo.loc.vbid || "-"}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] text-zinc-500 uppercase">Container</div>
                                    <div className="font-semibold text-sm truncate" title={hoverInfo.loc.containerNo}>{hoverInfo.loc.containerNo}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] text-zinc-500 uppercase">Type</div>
                                    <div className="font-semibold text-sm truncate" title={hoverInfo.loc.type}>{hoverInfo.loc.type?.replace("General Purpose", "GP") || "-"}</div>
                                </div>
                            </div>
                            <div className="pt-2 border-t border-zinc-800">
                                <div className="flex justify-between items-end">
                                    <div className="w-full">
                                        <div className="text-[10px] text-zinc-500 uppercase">Current Location</div>
                                        <div className="font-semibold text-xs text-zinc-300 truncate w-full" title={hoverInfo.loc.title}>{hoverInfo.loc.title}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Legend */}
            <div className="absolute bottom-3 left-3 z-[1000] flex gap-3 text-[10px]">
                <div className="flex items-center gap-1.5 bg-background/80 backdrop-blur-sm px-2.5 py-1.5 rounded-lg border border-border/50">
                    <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-green-500 to-emerald-400" />
                    <span className="text-muted-foreground font-medium">Origin</span>
                </div>
                <div className="flex items-center gap-1.5 bg-background/80 backdrop-blur-sm px-2.5 py-1.5 rounded-lg border border-border/50">
                    <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 border border-white/30" />
                    <span className="text-muted-foreground font-medium">Ship</span>
                </div>
                <div className="flex items-center gap-1.5 bg-background/80 backdrop-blur-sm px-2.5 py-1.5 rounded-lg border border-border/50">
                    <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-amber-500 to-red-500" />
                    <span className="text-muted-foreground font-medium">Destination</span>
                </div>
            </div>

            {/* Tracking Panel */}
            <ShipmentTrackingPanel
                open={!!selectedContainer}
                onClose={() => { setSelectedContainer(null); setSelectedIdx(null); }}
                containerNo={selectedContainer?.containerNo || ""}
                cachedRawJson={selectedContainer?.rawJson ? (() => { try { return JSON.parse(selectedContainer.rawJson!); } catch { return null; } })() : null}
            />
        </div>
    );
}
