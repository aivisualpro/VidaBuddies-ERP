
import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import VBshipping from '@/lib/models/VBshipping';

export async function GET() {
  try {
    await connectToDatabase();

    const count = await VBshipping.countDocuments({
      status: { $in: ['In Transit', 'IN_TRANSIT', 'in transit', 'in_transit', 'On Water'] },
      containerNo: { $exists: true, $ne: '' },
    });

    return NextResponse.json({ count });
  } catch (error) {
    console.error("Failed to fetch live shipments count", error);
    return NextResponse.json({ count: 0 }, { status: 500 });
  }
}
