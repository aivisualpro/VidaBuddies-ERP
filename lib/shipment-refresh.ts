
import { getSeaRatesTracking } from '@/lib/searates';
import connectToDatabase from '@/lib/db';
import VidaPO from '@/lib/models/VidaPO';
import VidaNotification from '@/lib/models/VidaNotification';

export async function refreshContainerTracking(container: string) {
  if (!container) {
    throw new Error('Container number is required');
  }

  // 1. Fetch live data from SeaRates
  const data = await getSeaRatesTracking(container);

  // 2. Connect to DB and find the relevant PO containing this container
  await connectToDatabase();
  
  const pos = await VidaPO.find({
    "customerPO.shipping.containerNo": container
  }).lean();

  if (pos && pos.length > 0) {
    for (const po of pos) {
      let shippingRecord = null;

      // Locate the specific shipping record
      if (po.customerPO) {
        // @ts-ignore
        for (let i = 0; i < po.customerPO.length; i++) {
          const cpo = po.customerPO[i];
          if (cpo.shipping) {
            for (let j = 0; j < cpo.shipping.length; j++) {
              if (cpo.shipping[j].containerNo === container) {
                shippingRecord = cpo.shipping[j];
                break;
              }
            }
          }
          if (shippingRecord) break;
        }
      }

      if (shippingRecord) {
        // @ts-ignore
        const history = shippingRecord.shippingTrackingRecords || [];
        const lastRecord = history.length > 0 ? history[history.length - 1] : null;

        let hasChanged = true;
        if (lastRecord) {
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

          // Determine new status — only update if we got a valid response
          const statusUpper = (data.status || "").toUpperCase();
          const isError = statusUpper === 'UNKNOWN' || statusUpper === 'ERROR' || !data.status;

          // Build update: always push the tracking record
          const updateOps: any = {
            $push: { "customerPO.$[cpo].shipping.$[ship].shippingTrackingRecords": newRecord },
          };

          // Only update the shipping status if we got a valid (non-error) response
          if (!isError) {
            updateOps.$set = { "customerPO.$[cpo].shipping.$[ship].status": data.status };
          }

          // Atomic update
          await VidaPO.updateOne(
            // @ts-ignore
            { _id: po._id, "customerPO.shipping.containerNo": container },
            updateOps,
            {
              arrayFilters: [
                { "cpo.shipping.containerNo": container },
                { "ship.containerNo": container }
              ]
            }
          );

          // Create a notification
          await VidaNotification.create({
            title: `Shipment Update: ${container}`,
            message: `Status: ${data.status || 'Unknown'}. Last event: ${data.last_event_status || 'N/A'} at ${data.last_event_location || 'unknown location'}.`,
            type: 'info',
            relatedId: container,
            link: '/admin/live-shipments'
          });
        }
      }
    }
  }
  return data;
}
