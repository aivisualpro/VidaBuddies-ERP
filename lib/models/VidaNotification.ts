import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IVidaNotification extends Document {
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: Date;
  relatedId?: string; // e.g. Container Number
  link?: string; // e.g. /admin/live-shipments
}

const VidaNotificationSchema: Schema = new Schema({
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, enum: ['info', 'success', 'warning', 'error'], default: 'info' },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  relatedId: { type: String },
  link: { type: String }
});

const VidaNotification: Model<IVidaNotification> = mongoose.models.VidaNotification || mongoose.model<IVidaNotification>('VidaNotification', VidaNotificationSchema);

export default VidaNotification;
