import VidaPO from "@/lib/models/VidaPO";
import VBcustomerPO from "@/lib/models/VBcustomerPO";
import VBshipping from "@/lib/models/VBshipping";

export interface LookupMaps {
  poMap: Record<string, string>;
  cpoMap: Record<string, string>;
  shipMap: Record<string, string>;
}

/**
 * Build ID → display-name lookup maps for VidaTimeline enrichment.
 * Shared between the timeline API and the reminders API.
 */
export async function buildLookups(): Promise<LookupMaps> {
  const [pos, cpos, ships] = await Promise.all([
    VidaPO.find({}, { _id: 1, vbpoNo: 1, VBNumber: 1 }).lean(),
    VBcustomerPO.find({}, { _id: 1, VBSerialNumber: 1, poNo: 1 }).lean(),
    VBshipping.find({}, { _id: 1, VBShipmentNumber: 1, svbid: 1 }).lean(),
  ]);

  const poMap: Record<string, string> = {};
  pos.forEach((p: any) => {
    poMap[p._id.toString()] = p.vbpoNo || p.VBNumber || p._id.toString();
  });

  const cpoMap: Record<string, string> = {};
  cpos.forEach((c: any) => {
    cpoMap[c._id.toString()] = c.VBSerialNumber || c.poNo || c._id.toString();
  });

  const shipMap: Record<string, string> = {};
  ships.forEach((s: any) => {
    shipMap[s._id.toString()] =
      s.VBShipmentNumber || s.svbid || s._id.toString();
  });

  return { poMap, cpoMap, shipMap };
}

/**
 * Enrich a single timeline entry with resolved display names.
 */
export function enrichTimelineEntry(
  item: any,
  { poMap, cpoMap, shipMap }: LookupMaps
) {
  return {
    ...item,
    _VBNumberDisplay: item.VBNumber
      ? poMap[item.VBNumber] || item.VBNumber
      : "",
    _VBSerialNumberDisplay: item.VBSerialNumber
      ? cpoMap[item.VBSerialNumber] || item.VBSerialNumber
      : "",
    _VBShipmentNumberDisplay: item.VBShipmentNumber
      ? shipMap[item.VBShipmentNumber] || item.VBShipmentNumber
      : "",
  };
}
