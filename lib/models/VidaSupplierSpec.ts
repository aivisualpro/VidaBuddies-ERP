import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IVidaSupplierSpec extends Document {
  supplierId: mongoose.Types.ObjectId;
  name: string;
  products: mongoose.Types.ObjectId[];
  pdfUrl?: string;
  pdfFileId?: string;
  fileName?: string;
  extractedData: { key: string; value: string }[];
  uploadedAt: Date;
}

const VidaSupplierSpecSchema: Schema = new Schema({
  supplierId: { type: Schema.Types.ObjectId, ref: 'VidaSupplier', required: true },
  name: { type: String, required: true },
  products: [{ type: Schema.Types.ObjectId, ref: 'VidaProduct' }],
  pdfUrl: { type: String },
  pdfFileId: { type: String },
  fileName: { type: String },
  extractedData: [{
    _id: false,
    key: { type: String, required: true },
    value: { type: String, required: true }
  }],
  uploadedAt: { type: Date, default: Date.now }
});

const VidaSupplierSpec: Model<IVidaSupplierSpec> = mongoose.models.VidaSupplierSpec || mongoose.model<IVidaSupplierSpec>('VidaSupplierSpec', VidaSupplierSpecSchema);

export default VidaSupplierSpec;
