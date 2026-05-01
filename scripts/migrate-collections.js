/**
 * Standalone migration script — run with: node scripts/migrate-collections.js
 * Copies nested customerPO[] and shipping[] from vidapos into VBcustomerPO and VBshipping.
 * Idempotent: safe to re-run.
 */
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Read MONGODB_URI from .env manually
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const match = envContent.match(/MONGODB_URI="?([^"\n]+)"?/);
if (!match) { console.error('No MONGODB_URI found in .env'); process.exit(1); }
const MONGODB_URI = match[1];

const Schema = mongoose.Schema;

// ── VBcustomerPO ──
const VBcustomerPOSchema = new Schema({
  vidaPOId: { type: Schema.Types.ObjectId, ref: 'VidaPO', default: null },
  vbpoNo: { type: String, default: '' },
  poNo: String, customer: String, customerLocation: String, customerPONo: String,
  customerPODate: Date, requestedDeliveryDate: Date, qtyOrdered: Number,
  qtyReceived: Number, UOM: String, warehouse: String, _originalCpoId: String,
}, { timestamps: true });
VBcustomerPOSchema.index({ vidaPOId: 1 });
VBcustomerPOSchema.index({ poNo: 1 });

// ── VBshipping ──
const VBshippingSchema = new Schema({
  customerPOId: { type: Schema.Types.ObjectId, ref: 'VBcustomerPO', default: null },
  poNo: { type: String, default: '' },
  spoNo: String, svbid: String, supplier: String, supplierLocation: String,
  supplierPO: String, supplierPoDate: Date, carrier: String, carrierBookingRef: String,
  BOLNumber: String, containerNo: String, vessellTrip: String, portOfLading: String,
  portOfEntryShipTo: String, dateOfLanding: Date, ETA: Date, product: String,
  products: [String], drums: Number, pallets: Number, gallons: Number, invValue: Number,
  estTrumpDuties: Number, netWeightKG: Number, grossWeightKG: Number, ticoVB: String,
  updatedETA: Date, arrivalNotice: String, isGensetRequired: Boolean, gensetInv: String,
  gensetEmailed: Boolean, isCollectFeesPaid: Boolean, feesAmount: Number, estimatedDuties: Number,
  isDOCreated: Boolean, status: String, updateShipmentTracking: String, quickNote: String,
  isSupplierInvoice: Boolean, isManufacturerSecurityISF: Boolean, isVidaBuddiesISFFiling: Boolean,
  isPackingList: Boolean, isCertificateOfAnalysis: Boolean, isCertificateOfOrigin: Boolean,
  IsBillOfLading: Boolean, isAllDocumentsProvidedToCustomsBroker: Boolean, isCustomsStatus: Boolean,
  IsDrayageAssigned: Boolean, truckerNotifiedDate: Date, isTruckerReceivedDeliveryOrder: Boolean,
  itemNo: String, description: String, lotSerial: String, qty: Number, type: String,
  inventoryDate: Date, _originalShipId: String,
  shippingTrackingRecords: [{
    type: { type: String }, number: String, sealine: String, sealine_name: String,
    status: String, updated_at: String, from_port_name: String, from_port_country: String,
    from_port_locode: String, to_port_name: String, to_port_country: String,
    to_port_locode: String, pol_name: String, pol_date: String,
    pol_actual: Schema.Types.Mixed, pod_name: String, pod_date: String,
    pod_actual: Schema.Types.Mixed, pod_predictive_eta: String,
    container_iso_code: String, container_size_type: String, vessel_names: String,
    vessel_imos: String, last_event_code: String, last_event_status: String,
    last_event_date: String, last_event_location: String, last_event_facility: String,
    last_event_vessel: String, last_event_voyage: String, latlong: String, raw_json: String,
    timestamp: { type: Date, default: Date.now }
  }],
}, { timestamps: true });
VBshippingSchema.index({ customerPOId: 1 });
VBshippingSchema.index({ containerNo: 1 });
VBshippingSchema.index({ svbid: 1 });

async function main() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected!\n');

  const VBcustomerPO = mongoose.model('VBcustomerPO', VBcustomerPOSchema);
  const VBshipping = mongoose.model('VBshipping', VBshippingSchema);

  const db = mongoose.connection.db;
  const allPOs = await db.collection('vidapos').find({}).toArray();
  console.log(`Found ${allPOs.length} vidapos documents.\n`);

  let cpoCreated = 0, cpoSkipped = 0, shipCreated = 0, shipSkipped = 0;

  for (const po of allPOs) {
    if (!po.customerPO || po.customerPO.length === 0) continue;

    for (const cpo of po.customerPO) {
      const cpoIdStr = cpo._id?.toString();
      if (!cpoIdStr) continue;

      const existing = await VBcustomerPO.findOne({ _originalCpoId: cpoIdStr });
      let newCpoId;

      if (existing) {
        cpoSkipped++;
        newCpoId = existing._id.toString();
      } else {
        const newCpo = await VBcustomerPO.create({
          vidaPOId: po._id,
          vbpoNo: po.vbpoNo || '',
          poNo: cpo.poNo,
          customer: cpo.customer,
          customerLocation: cpo.customerLocation,
          customerPONo: cpo.customerPONo,
          customerPODate: cpo.customerPODate,
          requestedDeliveryDate: cpo.requestedDeliveryDate,
          qtyOrdered: cpo.qtyOrdered,
          qtyReceived: cpo.qtyReceived,
          UOM: cpo.UOM,
          warehouse: cpo.warehouse,
          _originalCpoId: cpoIdStr,
        });
        newCpoId = newCpo._id.toString();
        cpoCreated++;
      }

      const shippings = cpo.shipping || [];
      for (const ship of shippings) {
        const shipIdStr = ship._id?.toString();
        if (!shipIdStr) continue;

        const existingShip = await VBshipping.findOne({ _originalShipId: shipIdStr });
        if (existingShip) { shipSkipped++; continue; }

        const shipData = { ...ship };
        delete shipData._id;
        await VBshipping.create({
          ...shipData,
          customerPOId: newCpoId,
          poNo: cpo.poNo || '',
          _originalShipId: shipIdStr,
        });
        shipCreated++;
      }
    }
  }

  console.log('═══════════════════════════════════════');
  console.log('  Migration Complete!');
  console.log('═══════════════════════════════════════');
  console.log(`  Total POs scanned:    ${allPOs.length}`);
  console.log(`  CustomerPOs created:  ${cpoCreated}`);
  console.log(`  CustomerPOs skipped:  ${cpoSkipped}`);
  console.log(`  Shippings created:    ${shipCreated}`);
  console.log(`  Shippings skipped:    ${shipSkipped}`);
  console.log('═══════════════════════════════════════\n');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
