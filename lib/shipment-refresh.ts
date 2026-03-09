
import { getSeaRatesTracking } from '@/lib/searates';
import connectToDatabase from '@/lib/db';
import VidaPO from '@/lib/models/VidaPO';
import VidaNotification from '@/lib/models/VidaNotification';

/**
 * Maps raw SeaRates tracking status to the app's standardized shipping statuses.
 * App statuses: Pending, Planned, In Transit, Delivered
 */
function mapTrackingStatusToAppStatus(rawStatus: string): string {
  const s = (rawStatus || '').toLowerCase().trim();
  if (s === 'arrived' || s === 'delivered') return 'Delivered';
  if (s === 'planned' || s === 'booking confirmed') return 'Planned';
  if (s === 'on water' || s === 'in_transit' || s === 'in transit') return 'In Transit';
  // For unknown/empty statuses, don't change — return empty to skip update
  return '';
}

export async function refreshContainerTracking(container: string) {
  if (!container) {
    throw new Error('Container number is required');
  }

  // 0. Connect to DB first and check if this shipment is already Delivered.
  //    Once delivered, the container number can be reused by other businesses,
  //    so we MUST NOT track it anymore to avoid returning someone else's data.
  await connectToDatabase();

  const pos = await VidaPO.find({
    "customerPO.shipping.containerNo": container
  }).lean();

  if (!pos || pos.length === 0) {
    throw new Error(`No shipment found for container ${container}`);
  }

  // Check if ANY matching shipping record is already Delivered
  for (const po of pos) {
    if (po.customerPO) {
      // @ts-ignore
      for (const cpo of po.customerPO) {
        if (cpo.shipping) {
          for (const ship of cpo.shipping) {
            if (ship.containerNo === container) {
              const status = (ship.status || '').toLowerCase().trim();
              if (status === 'delivered' || status === 'arrived') {
                // DISCONNECTED: This shipment is delivered — do not call SeaRates
                return {
                  _disconnected: true,
                  message: `Container ${container} is marked Delivered. Live tracking has been disconnected.`,
                  status: 'Delivered',
                  container
                };
              }
            }
          }
        }
      }
    }
  }

  // 1. Fetch live data from SeaRates (only for non-delivered shipments)
  const data = await getSeaRatesTracking(container);

  if (pos.length > 0) {
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

          // Map the raw SeaRates status to one of the app's standardized statuses
          const mappedStatus = mapTrackingStatusToAppStatus(data.status);

          // Build update: always push the tracking record
          const updateOps: any = {
            $push: { "customerPO.$[cpo].shipping.$[ship].shippingTrackingRecords": newRecord },
          };

          // Only update the shipping status if we got a valid mapped status
          if (mappedStatus) {
            updateOps.$set = { "customerPO.$[cpo].shipping.$[ship].status": mappedStatus };
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

          // Create a notification (but NOT for delivered — those are disconnected above)
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
