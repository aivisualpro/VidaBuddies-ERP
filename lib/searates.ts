
interface SeaRatesResponse {
  status?: string;
  message?: string;
  data?: {
    metadata?: {
      type?: string;
      number?: string;
      sealine?: string;
      sealine_name?: string;
      status?: string;
      updated_at?: string;
    };
    locations?: Array<{
      id: string;
      name?: string;
      country?: string;
      locode?: string;
      lat?: number;
      lng?: number;
    }>;
    facilities?: Array<{
      id: string;
      name?: string;
      locode?: string;
      lat?: number;
      lng?: number;
    }>;
    vessels?: Array<{
      id: string;
      name?: string;
      imo?: string;
      ais?: {
        latitude?: number;
        longitude?: number;
      };
    }>;
    containers?: Array<{
      iso_code?: string;
      size_type?: string;
      events?: Array<{
        type?: string;
        date?: string;
        location?: string;
        facility?: string;
        vessel?: string;
        event_code?: string;
        status?: string;
        voyage?: string;
      }>;
    }>;
    route?: {
      pol?: { location?: string; date?: string; actual?: boolean };
      pod?: { location?: string; date?: string; actual?: boolean; predictive_eta?: string };
    };
    route_data?: {
      ais?: {
        data?: {
          last_vessel_position?: { lat: number; lng: number };
        };
      };
      pin?: [number, number];
      route?: Array<{
        path?: Array<[number, number]>;
      }>;
    };
  };
}

const SR = {
  API_KEY: process.env.SEARATES_API_KEY || '',
  BASE: 'https://tracking.searates.com/tracking',
};

export async function getSeaRatesTracking(containerNumber: string) {
  const num = String(containerNumber || '').trim();
  if (!num) throw new Error('Container number is required');

  if (!SR.API_KEY) {
    throw new Error('SEARATES_API_KEY is not configured. Add it to your .env file.');
  }

  const url = `${SR.BASE}?api_key=${encodeURIComponent(SR.API_KEY)}&number=${encodeURIComponent(num)}&route=true&ais=true`;

  const res = await fetch(url);
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SeaRates HTTP ${res.status}: ${text.slice(0, 400)}`);
  }

  const payload: SeaRatesResponse = await res.json();

  // Detect SeaRates-specific errors before mapping
  if (payload.status === 'error') {
    const msg = payload.message || 'Unknown SeaRates error';
    if (msg === 'API_KEY_LIMIT_REACHED') {
      throw new Error('SeaRates API key limit reached. Please upgrade your plan or wait for quota reset.');
    }
    throw new Error(`SeaRates error: ${msg}`);
  }

  return mapSeaRatesToRow(payload);
}

function mapSeaRatesToRow(json: SeaRatesResponse) {
  const d = (json && json.data) ? json.data : {};
  const md = d.metadata || {};
  const locs = Array.isArray(d.locations) ? d.locations : [];
  const facs = Array.isArray(d.facilities) ? d.facilities : [];
  const vessels = Array.isArray(d.vessels) ? d.vessels : [];
  const cont = (Array.isArray(d.containers) && d.containers[0]) ? d.containers[0] : {};
  const route = d.route || {};
  const routeData = d.route_data || {};

  // helpers
  const byId = (arr: any[], id: string) => arr.find(x => x && x.id === id) || null;
  const locName = (l: any) => l ? [l.name || '', l.country || ''].filter(Boolean).join(', ') + (l.locode ? ` (${l.locode})` : '') : '';
  const vesselNames = vessels.map(v => v && v.name ? v.name : '').filter(Boolean).join(', ');
  const vesselImos  = vessels.map(v => v && v.imo  ? v.imo  : '').filter(Boolean).join(', ');

  // route (pol/pod)
  const polLoc = route.pol?.location ? byId(locs, route.pol.location) : null;
  const podLoc = route.pod?.location ? byId(locs, route.pod.location) : null;

  // from/to inferred from locations list
  const fromLoc = locs[0] || null;
  const toLoc   = locs.length ? locs[locs.length - 1] : null;

  // latest container event
  const events = (cont.events || []).slice().sort((a,b) => new Date(b.date||0).getTime() - new Date(a.date||0).getTime());
  const ev = events[0] || {};
  const evLoc = ev.location ? byId(locs, ev.location) : null;
  const evFac = ev.facility ? byId(facs, ev.facility) : null;
  const evVessel = ev.vessel ? (vessels.find(v => v.id === ev.vessel) || {}) : {};

  // -------- CURRENT POSITION PRIORITY --------
  // 1) AIS live position (freshest & authoritative)
  let latlong = '';
  const aisPos = routeData && routeData.ais && routeData.ais.data && routeData.ais.data.last_vessel_position;
  if (aisPos && isFinite(aisPos.lat) && isFinite(aisPos.lng)) {
    latlong = `${Number(aisPos.lat)}, ${Number(aisPos.lng)}`;
  }

  // 2) SeaRates "pin" (their current pointer)
  if (!latlong && routeData && Array.isArray(routeData.pin) && routeData.pin.length >= 2) {
    const [pinLat, pinLng] = routeData.pin!;
    if (isFinite(pinLat) && isFinite(pinLng)) {
      latlong = `${Number(pinLat)}, ${Number(pinLng)}`;
    }
  }

  // 3) Last coordinate of the most recent route segment path
  if (!latlong) {
    const pt = getLatestRoutePathPoint(routeData);
    if (pt) latlong = `${pt[0]}, ${pt[1]}`;
  }

  // 4) Vessel-level AIS (if exposed on vessels[])
  if (!latlong) {
    let currentVessel: any = null;
    const latestSeaEvent = events.find(e => e && e.type === 'sea' && e.vessel);
    if (latestSeaEvent) currentVessel = vessels.find(v => v && v.id === latestSeaEvent.vessel) || null;
    if (!currentVessel) currentVessel = vessels.find(v => v && v.ais && v.ais.latitude != null && v.ais.longitude != null) || null;
    if (currentVessel && currentVessel.ais) {
      const { latitude, longitude } = currentVessel.ais;
      if (isFinite(latitude!) && isFinite(longitude!)) latlong = `${Number(latitude)}, ${Number(longitude)}`;
    }
  }

  // 5) Last event facility/location (final fallback)
  if (!latlong) {
    if (evFac && isFinite(evFac.lat!) && isFinite(evFac.lng!)) latlong = `${evFac.lat}, ${evFac.lng}`;
    else if (evLoc && isFinite(evLoc.lat!) && isFinite(evLoc.lng!)) latlong = `${evLoc.lat}, ${evLoc.lng}`;
  }

  // format updated_at as M/D/YYYY HH:mm:ss
  function fmtMDY(dateStr: string) {
    if (!dateStr) return '';
    const parts = dateStr.split(/[\s:-]/);
    if (parts.length < 6) return dateStr;
    const y = +parts[0], m = +parts[1], d2 = +parts[2];
    const hh = parts[3], mm = parts[4], ss = parts[5];
    return `${m}/${d2}/${y} ${hh}:${mm}:${ss}`;
  }

  return {
    // meta
    type: md.type || '',
    number: md.number || '',
    sealine: md.sealine || '',
    sealine_name: md.sealine_name || '',
    status: md.status || (json.status === 'error' ? 'ERROR' : ''),
    updated_at: fmtMDY(md.updated_at || ''),

    // from/to
    from_port_name: fromLoc ? fromLoc.name || '' : '',
    from_port_country: fromLoc ? fromLoc.country || '' : '',
    from_port_locode: fromLoc ? fromLoc.locode || '' : '',

    to_port_name: toLoc ? toLoc.name || '' : '',
    to_port_country: toLoc ? toLoc.country || '' : '',
    to_port_locode: toLoc ? toLoc.locode || '' : '',

    // route (pol/pod)
    pol_name: polLoc ? polLoc.name || '' : '',
    pol_date: (route.pol && route.pol.date) ? route.pol.date : '',
    pol_actual: (route.pol && typeof route.pol.actual === 'boolean') ? route.pol.actual : '',

    pod_name: podLoc ? podLoc.name || '' : '',
    pod_date: (route.pod && route.pod.date) ? route.pod.date : '',
    pod_actual: (route.pod && typeof route.pod.actual === 'boolean') ? route.pod.actual : '',
    pod_predictive_eta: (route.pod && route.pod.predictive_eta) ? route.pod.predictive_eta : '',

    // container basics
    container_iso_code: cont.iso_code || '',
    container_size_type: cont.size_type || '',

    // vessels
    vessel_names: vesselNames,
    vessel_imos: vesselImos,

    // last event
    last_event_code: ev.event_code || '',
    last_event_status: ev.status || '',
    last_event_date: ev.date || '',
    last_event_location: evLoc ? locName(evLoc) : '',
    last_event_facility: evFac ? [evFac.name || '', evFac.locode || ''].filter(Boolean).join(' ') : '',
    last_event_vessel: (evVessel as any).name || '',
    last_event_voyage: ev.voyage || '',

    // coordinates (current)
    latlong,

    // raw payload for trace/debugging
    raw_json: JSON.stringify(json),
  };
}

function getLatestRoutePathPoint(routeData: any) {
  try {
    const routes = Array.isArray(routeData.route) ? routeData.route : [];
    for (let i = routes.length - 1; i >= 0; i--) {
      const path = Array.isArray(routes[i] && routes[i].path) ? routes[i].path : [];
      for (let j = path.length - 1; j >= 0; j--) {
        const p = path[j];
        if (Array.isArray(p) && p.length >= 2 && isFinite(p[0]) && isFinite(p[1])) {
          return [Number(p[0]), Number(p[1])];
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}
