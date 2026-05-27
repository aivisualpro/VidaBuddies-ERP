import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IVidaTransferOrder extends Document {
  vbShipmentNumber: mongoose.Types.ObjectId;
  warehouse: mongoose.Types.ObjectId;
  product: mongoose.Types.ObjectId;
  supplier: mongoose.Types.ObjectId;
  serialNumber: string;
  qty: number;
  batchNumber: string;
  uom: string;
  weight: number;
  receivedDate: Date;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const VidaTransferOrderSchema: Schema = new Schema({
  vbShipmentNumber: { type: Schema.Types.ObjectId, ref: 'VBshipping' },
  warehouse: { type: Schema.Types.ObjectId, ref: 'VidaWarehouse' },
  product: { type: Schema.Types.ObjectId, ref: 'VidaProduct' },
  supplier: { type: Schema.Types.ObjectId, ref: 'VidaSupplier' },
  serialNumber: { type: String },
  qty: { type: Number },
  batchNumber: { type: String },
  uom: { type: String },
  weight: { type: Number },
  receivedDate: { type: Date },
  createdBy: { type: Schema.Types.ObjectId, ref: 'VidaUser' },
  createdAt: { type: Date, default: Date.now },
});

// Index for the main listing query which sorts by createdAt descending
VidaTransferOrderSchema.index({ createdAt: -1 });

const VidaTransferOrder: Model<IVidaTransferOrder> = mongoose.models.VidaTransferOrder || mongoose.model<IVidaTransferOrder>('VidaTransferOrder', VidaTransferOrderSchema, 'vidaTransferOrders');

export default VidaTransferOrder;
