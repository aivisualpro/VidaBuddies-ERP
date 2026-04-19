
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

  // Gracefully handle placeholders like TBD, TBA, or very short strings
  const c = container.toUpperCase().trim();
  if (c.startsWith('TBD') || c.startsWith('TBA') || c.length < 5) {
    return {
      _disconnected: true, // Reuse the disconnected logic to skip further processing
      message: `Container ${container} is a placeholder. Skipping live tracking.`,
      status: 'Pending',
      container
    };
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

        let hasChanged = false;

        if (!lastRecord) {
            hasChanged = true;
        } else {
            // Force a new footprint if the DB is missing the new raw_json structure!
            if (!lastRecord.raw_json || lastRecord.status !== data.status || lastRecord.last_event_code !== data.last_event_code || lastRecord.latlong !== data.latlong || lastRecord.pod_predictive_eta !== data.pod_predictive_eta) {
                hasChanged = true;
            }
        }

        const mappedStatus = mapTrackingStatusToAppStatus(data.status);
        const newUpdatedETAStr = data.pod_predictive_eta || data.pod_date || null;
        const newUpdatedETA = newUpdatedETAStr ? new Date(newUpdatedETAStr) : null;

        // Determine if we need to sync top-level fields
        const currentShippingStatus = shippingRecord.status;
        const currentUpdatedETA = shippingRecord.updatedETA ? new Date(shippingRecord.updatedETA).getTime() : null;
        
        let needsTopLevelUpdate = false;
        if (mappedStatus && mappedStatus !== currentShippingStatus) {
            needsTopLevelUpdate = true;
        }
        if (newUpdatedETA && newUpdatedETA.getTime() !== currentUpdatedETA) {
            needsTopLevelUpdate = true;
        }

        // Also check if initial ETA is empty
        const currentETA = shippingRecord.ETA;
        if (!currentETA && newUpdatedETAStr) {
            needsTopLevelUpdate = true;
        }

        if (hasChanged || needsTopLevelUpdate) {
          const updateOps: any = { $set: {} };

          if (hasChanged) {
            const newRecord = { ...data, timestamp: new Date() };
            updateOps.$push = { "customerPO.$[cpo].shipping.$[ship].shippingTrackingRecords": newRecord };
          }

          if (mappedStatus) {
            updateOps.$set["customerPO.$[cpo].shipping.$[ship].status"] = mappedStatus;
          }

          if (newUpdatedETAStr) {
            updateOps.$set["customerPO.$[cpo].shipping.$[ship].updatedETA"] = newUpdatedETA;
            if (!currentETA) {
                // Populate the base ETA field once if it's currently completely blank!
                updateOps.$set["customerPO.$[cpo].shipping.$[ship].ETA"] = newUpdatedETA;
            }
          }

          // Cleanup $set if empty
          if (Object.keys(updateOps.$set).length === 0) {
              delete updateOps.$set;
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

          if (hasChanged) {
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
  }
  return data;
}
