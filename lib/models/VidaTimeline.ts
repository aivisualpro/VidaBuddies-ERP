import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IVidaTimeline extends Document {
    VBNumber?: string;
    VBSerialNumber?: string;
    VBShipmentNumber?: string;
    date?: Date;
    reminder?: Date;
    type: string; // Notes, Shipping Status, Action Required
    comments?: string;
    status?: string;
    category?: string;
    createdBy?: string;
    timestamp: Date;
}

const VidaTimelineSchema: Schema = new Schema({
    VBNumber: { type: String },
    VBSerialNumber: { type: String },
    VBShipmentNumber: { type: String },
    date: { type: Date },
    reminder: { type: Date },
    type: {
        type: String,
        required: true,
        enum: ['Notes', 'Shipping Status', 'Action Required'],
        default: 'Notes'
    },
    comments: { type: String },
    status: { type: String, default: 'Open' },
    category: { type: String },
    createdBy: { type: String },
    timestamp: { type: Date, default: Date.now },
});

// Index for fast lookups
VidaTimelineSchema.index({ VBNumber: 1, timestamp: -1 });
VidaTimelineSchema.index({ VBSerialNumber: 1, timestamp: -1 });
VidaTimelineSchema.index({ VBShipmentNumber: 1, timestamp: -1 });

const VidaTimeline: Model<IVidaTimeline> = mongoose.models.VidaTimeline || mongoose.model<IVidaTimeline>('VidaTimeline', VidaTimelineSchema);

export default VidaTimeline;
