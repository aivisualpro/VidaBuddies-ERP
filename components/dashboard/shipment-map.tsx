"use client";

import { MapContainer, TileLayer, Marker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { IconShip, IconMapPin } from "@tabler/icons-react";
import { useState } from "react";

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

export default function ShipmentMap({ locations }: { locations: MapLocation[] }) {
    // Default center (World view)
    const center: [number, number] = [20, 0];
    const [hoverInfo, setHoverInfo] = useState<{ loc: MapLocation } | null>(null);

    return (
        <div className="h-[500px] w-full rounded-md border bg-background shadow-sm relative z-0 group">
             <MapContainer center={center} zoom={2} scrollWheelZoom={true} style={{ height: "100%", width: "100%", zIndex: 0 }}>
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                />
                {locations.map((loc, idx) => (
                    <Marker 
                        key={idx} 
                        position={[loc.lat, loc.lng]}
                        eventHandlers={{
                            mouseover: () => {
                                setHoverInfo({ loc });
                            },
                            mouseout: () => {
                                setHoverInfo(null);
                            },
                            // Update position if mouse moves within the marker logic (optional)
                            // Usually not needed for pin-centered tooltips
                        }}
                    />
                ))}
            </MapContainer>

            {/* Custom Overlay Card - Rendered outside MapContainer to avoid clipping/panning issues */}
            {hoverInfo && (
                <div 
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[1000] pointer-events-none transition-opacity duration-200"
                    style={{ 
                        filter: 'drop-shadow(0 10px 15px rgba(0,0,0,0.5))'
                    }}
                >
                    <div className="w-[320px] bg-zinc-950 text-white rounded-xl overflow-hidden font-sans border border-zinc-800">
                        {/* Map Header - Zoomed View */}
                        <div className="h-[140px] w-full relative bg-zinc-900 group bg-gradient-to-b from-blue-900/20 to-zinc-900">
                                {/* Static Map Image */}
                            <img 
                                src={`https://static-maps.yandex.ru/1.x/?lang=en_US&ll=${hoverInfo.loc.lng},${hoverInfo.loc.lat}&z=10&l=map&size=320,140`}
                                alt="Location Map"
                                className="w-full h-full object-cover opacity-80"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                }}
                            />
                            
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className="relative">
                                    <div className="absolute -inset-2 bg-blue-500/30 rounded-full animate-ping"></div>
                                    <IconMapPin className="text-red-500 fill-current h-8 w-8 drop-shadow-lg relative z-10" />
                                    </div>
                            </div>

                            {/* Status Badge */}
                            <div className={`absolute top-2 right-2 px-2 py-1 rounded text-[10px] font-medium border uppercase tracking-wider backdrop-blur-md
                                ${['on water', 'in_transit', 'in transit'].includes(hoverInfo.loc.status?.toLowerCase() || '') ? 'bg-blue-500/80 text-white border-blue-400/30' : 
                                  ['arrived', 'delivered'].includes(hoverInfo.loc.status?.toLowerCase() || '') ? 'bg-green-500/80 text-white border-green-400/30' : 
                                  'bg-black/60 text-white border-white/10'}`}>
                                {hoverInfo.loc.status || "IN_TRANSIT"}
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-4 space-y-4">
                                
                                {/* Route Info */}
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
                                        {/* Progress Track */}
                                        <div className="h-1 w-full bg-zinc-800 rounded-full mt-4 mb-2 relative">
                                            {/* Filled Progress */}
                                            <div 
                                                className="absolute left-0 top-0 h-full bg-blue-500 rounded-full transition-all duration-1000"
                                                style={{ 
                                                    width: (() => {
                                                        if (!hoverInfo.loc.departure || !hoverInfo.loc.eta) return '50%';
                                                        const start = new Date(hoverInfo.loc.departure).getTime();
                                                        const end = new Date(hoverInfo.loc.eta).getTime();
                                                        const now = Date.now();
                                                        if (end <= start) return '0%';
                                                        const pct = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
                                                        return `${pct}%`;
                                                    })()
                                                }}
                                            />
                                            {/* Moving Ship */}
                                            <div 
                                                className="absolute top-1/2 -translate-y-1/2 -ml-2.5 transition-all duration-1000 z-10"
                                                style={{ 
                                                    left: (() => {
                                                        if (!hoverInfo.loc.departure || !hoverInfo.loc.eta) return '50%';
                                                        const start = new Date(hoverInfo.loc.departure).getTime();
                                                        const end = new Date(hoverInfo.loc.eta).getTime();
                                                        const now = Date.now();
                                                        if (end <= start) return '0%';
                                                        const pct = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
                                                        return `${pct}%`;
                                                    })()
                                                }}
                                            >
                                                <div className="bg-blue-500 text-white p-1 rounded-full shadow-lg shadow-blue-900/50">
                                                     <IconShip className="h-4 w-4 fill-current" />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-[10px] text-zinc-500 mt-1 whitespace-nowrap">
                                                {hoverInfo.loc.eta ? `${Math.ceil((new Date(hoverInfo.loc.eta).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} Days left` : "ETA N/A"}
                                        </div>
                                    </div>

                                    <div className="text-center min-w-[50px]">
                                        <div className="text-3xl font-bold tracking-tight">{getPortCode(hoverInfo.loc.destination)}</div>
                                        <div className="text-[10px] text-zinc-400 truncate max-w-[80px] mx-auto" title={hoverInfo.loc.destination}>{hoverInfo.loc.destination}</div>
                                    </div>
                                </div>
                                </div>

                                {/* Divider */}
                                <div className="h-px bg-zinc-800 w-full" />

                                {/* Footer Details */}
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

                                {/* Last Location */}
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
        </div>
    );
}
