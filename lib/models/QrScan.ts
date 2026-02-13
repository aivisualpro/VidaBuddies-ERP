import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IQrScan extends Document {
  scannedAt: Date;
  ip?: string;
  userAgent?: string;
  referer?: string;
}

const QrScanSchema: Schema = new Schema({
  scannedAt: { type: Date, default: Date.now },
  ip: { type: String },
  userAgent: { type: String },
  referer: { type: String },
});

const QrScan: Model<IQrScan> = mongoose.models.QrScan || mongoose.model<IQrScan>('QrScan', QrScanSchema);

export default QrScan;
