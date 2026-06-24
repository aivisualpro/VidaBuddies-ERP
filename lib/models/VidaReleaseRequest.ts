import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IReleaseOrderProduct {
    product: mongoose.Types.ObjectId;
    qty: number;
    lotSerial: string;
}

export interface IVidaReleaseRequest extends Document {
  poNo: mongoose.Types.ObjectId; // Customer PO ref → VBcustomerPO._id
  transferOrder: mongoose.Types.ObjectId; // VBshipping ref — stores vbShipmentNumber from VidaTransferOrder (displayed as Shipment #)
  date: Date;
  warehouse: mongoose.Types.ObjectId;
  requestedBy: mongoose.Types.ObjectId; // User
  customer: mongoose.Types.ObjectId;
  contact: string; // Selected location
  
  releaseOrderProducts: IReleaseOrderProduct[];

  hasPickupInfo: boolean;
  pickedUp: boolean;
  carrier: string;
  requestedPickupTime: Date;
  scheduledPickupDate: Date;
  scheduledPickupTime: string;
  instructions: string;
  
  createdBy: string;
  createdAt: Date;
}

const ReleaseOrderProductSchema = new Schema({
    product: { type: Schema.Types.ObjectId, ref: 'VidaProduct', required: true },
    qty: { type: Number, required: true },
    lotSerial: { type: String }
});

const VidaReleaseRequestSchema: Schema = new Schema({
  poNo: { type: Schema.Types.Mixed, ref: 'VBcustomerPO', required: true },
  transferOrder: { type: Schema.Types.ObjectId, ref: 'VBshipping', default: null },
  date: { type: Date, default: Date.now },
  warehouse: { type: Schema.Types.ObjectId, ref: 'VidaWarehouse', required: true },
  requestedBy: { type: Schema.Types.ObjectId, ref: 'VidaUser' },
  customer: { type: Schema.Types.ObjectId, ref: 'VidaCustomer' },
  contact: { type: String },

  releaseOrderProducts: [ReleaseOrderProductSchema],

  hasPickupInfo: { type: Boolean, default: false },
  pickedUp: { type: Boolean, default: false },
  carrier: { type: String },
  requestedPickupTime: { type: Date },
  scheduledPickupDate: { type: Date },
  scheduledPickupTime: { type: String },
  instructions: { type: String },

  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
}, {});

// Index for the main listing query which sorts by createdAt descending
VidaReleaseRequestSchema.index({ createdAt: -1 });
// Compound index for pickedUp filter (the "waiting" filter in the list page)
VidaReleaseRequestSchema.index({ pickedUp: 1, createdAt: -1 });
// Index for common population lookups
VidaReleaseRequestSchema.index({ customer: 1 });
VidaReleaseRequestSchema.index({ warehouse: 1 });

const VidaReleaseRequest: Model<IVidaReleaseRequest> = mongoose.models.VidaReleaseRequest || mongoose.model<IVidaReleaseRequest>('VidaReleaseRequest', VidaReleaseRequestSchema);

export default VidaReleaseRequest;
