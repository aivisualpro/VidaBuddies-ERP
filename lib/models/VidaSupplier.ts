import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IVidaSupplierLocation {
  vbId: string;
  locationName?: string;
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  zip?: string;
  fullAddress?: string;
  website?: string;
  fdaReg?: string;
}

export interface IVidaSupplierDocumentLog {
  action: string;
  by: string;
  date: Date;
}

export interface IVidaSupplierDocument {
  name: string; // The exact name from REQUIRED_DOCS
  fileId?: string; // Google Drive file ID
  fileLink?: string; // Google Drive webViewLink
  expiryDate?: Date;
  supplierNotes?: string;
  adminNotes?: string;
  isVerified?: boolean;
  logs: IVidaSupplierDocumentLog[];
}

export interface IVidaSupplier extends Document {
  vbId: string;
  name: string;
  portalEmail?: string;
  portalPassword?: string;
  location: IVidaSupplierLocation[];
  documents?: IVidaSupplierDocument[];
}

const VidaSupplierLocationSchema: Schema = new Schema({
  vbId: { type: String },
  locationName: { type: String },
  street: { type: String },
  city: { type: String },
  state: { type: String },
  country: { type: String },
  zip: { type: String },
  fullAddress: { type: String },
  website: { type: String },
  fdaReg: { type: String },
});

const VidaSupplierDocumentLogSchema: Schema = new Schema({
  action: { type: String, required: true },
  by: { type: String, required: true },
  date: { type: Date, default: Date.now }
});

const VidaSupplierDocumentSchema: Schema = new Schema({
  name: { type: String, required: true },
  fileId: { type: String },
  fileLink: { type: String },
  expiryDate: { type: Date },
  supplierNotes: { type: String },
  adminNotes: { type: String },
  isVerified: { type: Boolean, default: false },
  logs: [VidaSupplierDocumentLogSchema]
});

const VidaSupplierSchema: Schema = new Schema({
  vbId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  portalEmail: { type: String, required: false },
  portalPassword: { type: String, default: null },
  location: [VidaSupplierLocationSchema],
  documents: { type: [VidaSupplierDocumentSchema], default: [] }
});

const VidaSupplier: Model<IVidaSupplier> = mongoose.models.VidaSupplier || mongoose.model<IVidaSupplier>('VidaSupplier', VidaSupplierSchema);

export default VidaSupplier;
