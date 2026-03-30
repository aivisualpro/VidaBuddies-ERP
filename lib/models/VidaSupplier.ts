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
  isNA?: boolean;
  logs: IVidaSupplierDocumentLog[];
}

export interface IVidaSurveyResponse {
  templateId: string;
  status: 'draft' | 'submitted';
  answers: Record<string, any>;
  submittedAt?: Date;
  pdfLink?: string;
  pdfFileId?: string;
}

export interface IVidaSupplier extends Document {
  vbId: string;
  name: string;
  portalEmail?: string;
  portalPassword?: string;
  manufacturingAddress?: string;
  country?: string;
  primaryContactName?: string;
  communicationEmail?: string;
  phone?: string;
  productsSupplied?: string[];
  location: IVidaSupplierLocation[];
  documents?: IVidaSupplierDocument[];
  surveyResponses?: IVidaSurveyResponse[];
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
  isNA: { type: Boolean, default: false },
  logs: [VidaSupplierDocumentLogSchema]
});

const VidaSurveyResponseSchema: Schema = new Schema({
  templateId: { type: String, required: true },
  status: { type: String, enum: ['draft', 'submitted'], default: 'draft' },
  answers: { type: Schema.Types.Mixed, default: {} },
  submittedAt: { type: Date },
  pdfLink: { type: String },
  pdfFileId: { type: String },
});

const VidaSupplierSchema: Schema = new Schema({
  vbId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  portalEmail: { type: String, required: false },
  portalPassword: { type: String, default: null },
  manufacturingAddress: { type: String, default: '' },
  country: { type: String, default: '' },
  primaryContactName: { type: String, default: '' },
  communicationEmail: { type: String, default: '' },
  phone: { type: String, default: '' },
  productsSupplied: { type: [String], default: [] },
  location: [VidaSupplierLocationSchema],
  documents: { type: [VidaSupplierDocumentSchema], default: [] },
  surveyResponses: { type: [VidaSurveyResponseSchema], default: [] },
});

const VidaSupplier: Model<IVidaSupplier> = mongoose.models.VidaSupplier || mongoose.model<IVidaSupplier>('VidaSupplier', VidaSupplierSchema);

export default VidaSupplier;
