import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IVBcustomerPO extends Document {
  VBNumber?: mongoose.Types.ObjectId; // ref to VidaPO._id (link to vidapos)
  VBSerialNumber?: string;            // e.g. "VB1-1"
  customer?: mongoose.Types.ObjectId;    // ref to VidaCustomer._id
  customerLocation?: mongoose.Types.ObjectId; // ref to VidaCustomer.location[]._id
  customerPONo?: string;
  customerPODate?: Date;
  requestedDeliveryDate?: Date;
  qtyOrdered?: number;
  qtyReceived?: number;
  UOM?: string;
  warehouse?: mongoose.Types.ObjectId;  // ref to VidaWarehouse._id
  _originalCpoId?: string;           // traceability back to the nested sub-doc _id
  createdAt: Date;
  updatedAt: Date;
}

const VBcustomerPOSchema: Schema = new Schema(
  {
    VBNumber: { type: Schema.Types.ObjectId, ref: 'VidaPO', default: null },
    VBSerialNumber: { type: String, default: '' },
    customer: { type: Schema.Types.ObjectId, ref: 'VidaCustomer', default: null },
    customerLocation: { type: Schema.Types.ObjectId, default: null },
    customerPONo: { type: String },
    customerPODate: { type: Date },
    requestedDeliveryDate: { type: Date },
    qtyOrdered: { type: Number },
    qtyReceived: { type: Number },
    UOM: { type: String },
    warehouse: { type: Schema.Types.ObjectId, ref: 'VidaWarehouse', default: null },
    _originalCpoId: { type: String },
    driveDocuments: [{ type: Schema.Types.Mixed }],
  },
  { timestamps: true }
);

// Index for fast lookups
VBcustomerPOSchema.index({ VBNumber: 1 });
VBcustomerPOSchema.index({ VBSerialNumber: 1 });

const VBcustomerPO: Model<IVBcustomerPO> =
  mongoose.models.VBcustomerPO || mongoose.model<IVBcustomerPO>('VBcustomerPO', VBcustomerPOSchema);

export default VBcustomerPO;
