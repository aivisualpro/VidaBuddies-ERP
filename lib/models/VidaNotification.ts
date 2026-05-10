import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IVidaNotification extends Document {
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: Date;
  relatedId?: string; // e.g. Container Number
  link?: string; // e.g. /admin/live-shipments
  // — New fields for bell notification system —
  kind?: 'reminder' | 'shipment' | 'system';
  userEmail?: string;       // target user (enables per-user notifications)
  sourceId?: string;        // related VidaTimeline._id for traceability
  dedupKey?: string;        // e.g. "reminder:<timelineId>:<YYYY-MM-DD>" — prevents duplicates
}

const VidaNotificationSchema: Schema = new Schema({
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, enum: ['info', 'success', 'warning', 'error'], default: 'info' },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  relatedId: { type: String },
  link: { type: String },
  // — New fields (all optional for backwards compat) —
  kind: { type: String, enum: ['reminder', 'shipment', 'system'] },
  userEmail: { type: String },
  sourceId: { type: String },
  dedupKey: { type: String },
});

// Index for fast per-user queries
VidaNotificationSchema.index({ userEmail: 1, createdAt: -1 });
// Unique sparse index — only enforced when dedupKey is present, prevents same-day duplicate reminders
VidaNotificationSchema.index({ dedupKey: 1 }, { unique: true, sparse: true });

const VidaNotification: Model<IVidaNotification> = mongoose.models.VidaNotification || mongoose.model<IVidaNotification>('VidaNotification', VidaNotificationSchema);

export default VidaNotification;
