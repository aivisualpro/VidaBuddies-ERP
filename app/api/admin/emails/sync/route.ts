import { NextResponse } from 'next/server';
import { syncInboundEmails } from '@/lib/graph-mail-sync';

// GET /api/admin/emails/sync
// Can be hit from a CRM button or a recurring background cron job.
export async function GET() {
  try {
    const result = await syncInboundEmails();
    return NextResponse.json({
      success: true,
      message: `Successfully synchronized ${result.count} PO-related emails (out of ${result.totalUnread} unread inbox emails).`,
      data: result
    });
  } catch (error: any) {
    console.error('[API] /api/admin/emails/sync error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to sync emails.' },
      { status: 500 }
    );
  }
}
