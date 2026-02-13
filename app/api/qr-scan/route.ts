import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import QrScan from '@/lib/models/QrScan';

// GET: When the QR code is scanned, record the scan and redirect to the website
export async function GET(request: Request) {
  try {
    await connectToDatabase();

    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const referer = request.headers.get('referer') || '';

    // Record the scan
    await QrScan.create({
      scannedAt: new Date(),
      ip,
      userAgent,
      referer,
    });

    // Redirect to the main website
    return NextResponse.redirect('https://www.vidabuddies.com', { status: 302 });
  } catch (error) {
    console.error('QR scan tracking error:', error);
    // Even if tracking fails, still redirect
    return NextResponse.redirect('https://www.vidabuddies.com', { status: 302 });
  }
}
