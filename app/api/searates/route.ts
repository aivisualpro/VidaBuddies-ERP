
import { NextResponse } from 'next/server';
import { getSeaRatesTracking } from '@/lib/searates';
import connectToDatabase from '@/lib/db';
import VidaPO from '@/lib/models/VidaPO';
import VidaNotification from '@/lib/models/VidaNotification';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const container = searchParams.get('container');

  if (!container) {
    return NextResponse.json({ error: 'Container number is required' }, { status: 400 });
  }

  try {
    // 1. Fetch live data from SeaRates
    const data = await getSeaRatesTracking(container);

    // 2. Connect to DB and find the relevant PO containing this container
    await connectToDatabase();
    
    // Using $elemMatch to find the document is good, but we need to update a specific subdocument.
    // Since customerPO and shipping are arrays, we need to iterate to find the right one to update.
    // Using .lean() to avoid complete Mongoose document overhead and prevent versioning issues during read
    const pos = await VidaPO.find({
      "customerPO.shipping.containerNo": container
    }).lean();

    if (pos && pos.length > 0) {
        for (const po of pos) {
            let shippingRecord = null;
            let cpoIndex = -1;
            let shipIndex = -1;

            // Locate the specific shipping record (in plain object)
            // @ts-ignore
            if (po.customerPO) {
                // @ts-ignore
                for (let i = 0; i < po.customerPO.length; i++) {
                    const cpo = po.customerPO[i];
                    if (cpo.shipping) {
                        for (let j = 0; j < cpo.shipping.length; j++) {
                            if (cpo.shipping[j].containerNo === container) {
                                shippingRecord = cpo.shipping[j];
                                cpoIndex = i;
                                shipIndex = j;
                                break;
                            }
                        }
                    }
                    if (shippingRecord) break;
                }
            }

            if (shippingRecord) {
                // Check if we need to add a new history record
                // @ts-ignore
                const history = shippingRecord.shippingTrackingRecords || [];
                const lastRecord = history.length > 0 ? history[history.length - 1] : null;

                let hasChanged = true;
                if (lastRecord) {
                    // Compare relevant fields
                    const keysToCompare = [
                        'status', 'latlong', 'last_event_date', 'last_event_status', 
                        'last_event_location', 'pod_predictive_eta', 'pol_date', 'pod_date'
                    ];
                    
                    const isSame = keysToCompare.every(k => {
                       // @ts-ignore
                       return lastRecord[k] === data[k];
                    });

                    if (isSame) {
                        hasChanged = false;
                    }
                }

                if (hasChanged) {
                    // @ts-ignore
                    const newRecord = { ...data, timestamp: new Date() };

                    // Determine new status
                    let newStatus = data.status;
                    const statusUpper = newStatus ? newStatus.toUpperCase() : "";
                    if (statusUpper === 'UNKNOWN' || statusUpper === 'ERROR') {
                        newStatus = 'Delivered';
                    }

                    // Atomic update using arrayFilters to avoid VersionError
                    const updateResult = await VidaPO.updateOne(
                        // @ts-ignore
                        { _id: po._id, "customerPO.shipping.containerNo": container },
                        { 
                            $push: { "customerPO.$[cpo].shipping.$[ship].shippingTrackingRecords": newRecord },
                            $set: { "customerPO.$[cpo].shipping.$[ship].status": newStatus }
                        },
                        {
                            arrayFilters: [
                                { "cpo.shipping.containerNo": container },
                                { "ship.containerNo": container }
                            ]
                        }
                    );

                    // Create a notification for the update
                    await VidaNotification.create({
                        title: `Shipment Update: ${container}`,
                        message: `Status changed to ${newStatus}. Last event: ${data.last_event_status || 'N/A'} at ${data.last_event_location || 'unknown location'}.`,
                        type: 'info',
                        relatedId: container,
                        link: '/admin/live-shipments'
                    });

                    console.log(`Updated tracking history and status for container ${container} in PO ${po._id} (Atomic). Matched: ${updateResult.matchedCount}, Modified: ${updateResult.modifiedCount}`);
                }
            }
        }
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('SeaRates Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch tracking data' },
      { status: 500 }
    );
  }
}
