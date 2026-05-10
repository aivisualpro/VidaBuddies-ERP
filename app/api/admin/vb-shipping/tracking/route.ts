import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import VBshipping from '@/lib/models/VBshipping';

/**
 * GET /api/admin/vb-shipping/tracking?container=XXXX
 * Returns only the latest raw_json from shippingTrackingRecords for a container.
 * If no cached data, returns { cached: false } so the frontend can do a live fetch.
 */
export async function GET(req: Request) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const container = searchParams.get('container');

    if (!container) {
      return NextResponse.json({ error: 'Container number is required' }, { status: 400 });
    }

    // Find the shipping record with this container
    const record = await VBshipping.findOne(
      { containerNo: container },
      { shippingTrackingRecords: { $slice: -1 } }
    ).lean();

    if (!record) {
      return NextResponse.json({ cached: false, message: 'No shipping record found' });
    }

    const trackingRecords = (record as any).shippingTrackingRecords || [];
    const latest = trackingRecords[0];

    if (!latest?.raw_json) {
      return NextResponse.json({ cached: false, message: 'No cached tracking data' });
    }

    try {
      const parsed = JSON.parse(latest.raw_json);
      return NextResponse.json({ cached: true, data: parsed, timestamp: latest.timestamp });
    } catch {
      return NextResponse.json({ cached: false, message: 'Corrupted cached data' });
    }
  } catch (error) {
    console.error('Failed to fetch tracking cache:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}
