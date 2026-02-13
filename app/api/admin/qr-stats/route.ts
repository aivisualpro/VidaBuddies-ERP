import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import QrScan from '@/lib/models/QrScan';

export async function GET() {
  try {
    await connectToDatabase();

    const totalScans = await QrScan.countDocuments();

    // Get scans in the last 24 hours
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const scansToday = await QrScan.countDocuments({ scannedAt: { $gte: last24h } });

    // Get scans in the last 7 days
    const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const scansThisWeek = await QrScan.countDocuments({ scannedAt: { $gte: last7d } });

    // Get scans in the last 30 days
    const last30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const scansThisMonth = await QrScan.countDocuments({ scannedAt: { $gte: last30d } });

    // Get daily scans for the last 7 days for the chart
    const dailyScans = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      dayStart.setDate(dayStart.getDate() - i);
      
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const count = await QrScan.countDocuments({
        scannedAt: { $gte: dayStart, $lt: dayEnd }
      });

      dailyScans.push({
        date: dayStart.toISOString().split('T')[0],
        scans: count,
      });
    }

    // Get the most recent scans
    const recentScans = await QrScan.find()
      .sort({ scannedAt: -1 })
      .limit(10)
      .lean();

    return NextResponse.json({
      totalScans,
      scansToday,
      scansThisWeek,
      scansThisMonth,
      dailyScans,
      recentScans,
    });
  } catch (error) {
    console.error('Failed to fetch QR stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
