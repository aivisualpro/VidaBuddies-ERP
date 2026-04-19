import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IVidaQuote extends Document {
  // 1. Quote Info
  quoteNumber: string;
  revisionNumber: number;
  salesRep: string;
  branch: string;
  customer: mongoose.Types.ObjectId | string;
  incoterm: string;
  currency: string;
  effectiveDate?: Date;
  date?: Date;

  // 2. Commercial
  products: string[]; // VBIDs or ObjectIds
  supplier: string;
  origin: string;
  quantity: number;
  uom: string;
  supplierCost: number;
  additionalCharges: number;
  targetSalePrice: number;
  margin: number;

  // 3. Logistics
  pickupLocation: string;
  deliveryLocation: string;
  warehouse: string;
  appointmentNotes: string;
  palletCount: number;
  weight: number;
  requiredEquipment: string;
  temperature: string;
  customsRequired: boolean;

  // 4. Freight
  carrierRequestStatus: string; // e.g., Pending, Requested, Received
  carrierResponses: string; // can be generalized string or array
  selectedCarrier: string;
  bookedFreightValue: number;
  inlandFreight: number;
  surchargeCapture: number;

  // System
  createdAt?: Date;
  updatedAt?: Date;
}

const VidaQuoteSchema: Schema = new Schema({
  quoteNumber: { type: String, required: true, unique: true },
  revisionNumber: { type: Number, default: 0 },
  salesRep: { type: String },
  branch: { type: String },
  customer: { type: String }, // references VidaCustomer or string
  incoterm: { type: String },
  currency: { type: String, default: 'USD' },
  effectiveDate: { type: Date },
  date: { type: Date, default: Date.now },

  products: [{ type: String }],
  supplier: { type: String },
  origin: { type: String },
  quantity: { type: Number },
  uom: { type: String },
  supplierCost: { type: Number },
  additionalCharges: { type: Number },
  targetSalePrice: { type: Number },
  margin: { type: Number },

  pickupLocation: { type: String },
  deliveryLocation: { type: String },
  warehouse: { type: String },
  appointmentNotes: { type: String },
  palletCount: { type: Number },
  weight: { type: Number },
  requiredEquipment: { type: String },
  temperature: { type: String },
  customsRequired: { type: Boolean, default: false },

  carrierRequestStatus: { type: String, default: 'None' },
  carrierResponses: { type: String },
  selectedCarrier: { type: String },
  bookedFreightValue: { type: Number },
  inlandFreight: { type: Number },
  surchargeCapture: { type: Number },
}, { timestamps: true });

const VidaQuote: Model<IVidaQuote> = mongoose.models.VidaQuote || mongoose.model<IVidaQuote>('VidaQuote', VidaQuoteSchema);

export default VidaQuote;
