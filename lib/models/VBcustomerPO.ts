import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IVBcustomerPO extends Document {
  vidaPOId?: mongoose.Types.ObjectId; // ref to VidaPO
  vbpoNo?: string;                    // display field — same as parent VidaPO.vbpoNo
  VBNumber?: string;                  // vidapos._id as string (ref)
  poNo?: string;                      // legacy — same as VBSerialNumber
  VBSerialNumber?: string;            // new name for poNo (e.g. "VB1-1")
  customer?: string;
  customerLocation?: string;
  customerPONo?: string;
  customerPODate?: Date;
  requestedDeliveryDate?: Date;
  qtyOrdered?: number;
  qtyReceived?: number;
  UOM?: string;
  warehouse?: string;
  _originalCpoId?: string;           // traceability back to the nested sub-doc _id
  createdAt: Date;
  updatedAt: Date;
}

const VBcustomerPOSchema: Schema = new Schema(
  {
    vidaPOId: { type: Schema.Types.ObjectId, ref: 'VidaPO', default: null },
    vbpoNo: { type: String, default: '' },
    VBNumber: { type: String, default: '' },
    poNo: { type: String },
    VBSerialNumber: { type: String, default: '' },
    customer: { type: String },
    customerLocation: { type: String },
    customerPONo: { type: String },
    customerPODate: { type: Date },
    requestedDeliveryDate: { type: Date },
    qtyOrdered: { type: Number },
    qtyReceived: { type: Number },
    UOM: { type: String },
    warehouse: { type: String },
    _originalCpoId: { type: String },
  },
  { timestamps: true }
);

// Index for fast lookups
VBcustomerPOSchema.index({ vidaPOId: 1 });
VBcustomerPOSchema.index({ vbpoNo: 1 });
VBcustomerPOSchema.index({ poNo: 1 });
VBcustomerPOSchema.index({ VBNumber: 1 });
VBcustomerPOSchema.index({ VBSerialNumber: 1 });

const VBcustomerPO: Model<IVBcustomerPO> =
  mongoose.models.VBcustomerPO || mongoose.model<IVBcustomerPO>('VBcustomerPO', VBcustomerPOSchema);

export default VBcustomerPO;
