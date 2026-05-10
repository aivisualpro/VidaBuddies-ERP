import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import VBshipping from '@/lib/models/VBshipping';
import { getSeaRatesTracking } from '@/lib/searates';

/**
 * GET /api/admin/searates-raw?container=XXXX
 * Fetches live data from SeaRates, saves it to VBshipping.shippingTrackingRecords,
 * and returns the raw JSON for the tracking panel.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const container = searchParams.get('container');

  if (!container) {
    return NextResponse.json({ error: 'Container number is required' }, { status: 400 });
  }

  const apiKey = process.env.SEARATES_API_KEY || '';
  if (!apiKey) {
    return NextResponse.json({ error: 'SEARATES_API_KEY not configured' }, { status: 500 });
  }

  try {
    // 1. Fetch live from SeaRates
    const url = `https://tracking.searates.com/tracking?api_key=${encodeURIComponent(apiKey)}&number=${encodeURIComponent(container)}&route=true&ais=true`;
    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `SeaRates HTTP ${res.status}: ${text.slice(0, 400)}` }, { status: 502 });
    }
    const rawJson = await res.json();

    if (rawJson.status === 'error') {
      return NextResponse.json(rawJson);
    }

    // 2. Also get the mapped record for storing structured fields
    let mappedData: any = {};
    try {
      mappedData = await getSeaRatesTracking(container);
    } catch {
      // If mapping fails, we still have the raw JSON
    }

    // 3. Save to VBshipping.shippingTrackingRecords in MongoDB
    try {
      await connectToDatabase();
      const trackingRecord = {
        ...mappedData,
        raw_json: JSON.stringify(rawJson),
        timestamp: new Date(),
      };

      const updateOps: any = {
        $push: { shippingTrackingRecords: trackingRecord },
      };

      // Also update top-level status and ETA if available
      const setFields: any = {};
      const appStatus = mapStatus(mappedData.status);
      if (appStatus) setFields.status = appStatus;
      if (mappedData.pod_predictive_eta) {
        setFields.updatedETA = new Date(mappedData.pod_predictive_eta);
      }
      if (Object.keys(setFields).length > 0) {
        updateOps.$set = setFields;
      }

      await VBshipping.updateOne(
        { containerNo: container },
        updateOps
      );
    } catch (saveErr) {
      // Don't fail the response — saving is best-effort
      console.error('Failed to save tracking record to VBshipping:', saveErr);
    }

    // 4. Return raw JSON to the frontend
    return NextResponse.json(rawJson);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch' }, { status: 500 });
  }
}

/** Map SeaRates status to app status */
function mapStatus(raw: string): string {
  const s = (raw || '').toLowerCase().trim();
  if (s === 'arrived' || s === 'delivered') return 'Delivered';
  if (s === 'on water' || s === 'in_transit' || s === 'in transit') return 'In Transit';
  if (s === 'planned' || s === 'booking confirmed') return 'Planned';
  return '';
}
