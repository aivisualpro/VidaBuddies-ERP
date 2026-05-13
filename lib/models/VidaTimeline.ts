import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IVidaTimeline extends Document {
    VBNumber?: string;
    VBSerialNumber?: string;
    VBShipmentNumber?: string;
    date?: Date;
    reminder?: Date;
    type: string; // Notes, Shipping, Action Required
    comments?: string;
    status?: string;
    category?: string;
    createdBy?: string;
    timestamp: Date;
}

const VidaTimelineSchema: Schema = new Schema({
    VBNumber: { type: Schema.Types.Mixed },
    VBSerialNumber: { type: Schema.Types.Mixed },
    VBShipmentNumber: { type: Schema.Types.Mixed },
    date: { type: Date },
    reminder: { type: Date },
    type: {
        type: String,
        required: true,
        enum: ['Notes', 'Shipping', 'Action Required'],
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
// Compound index for reminders query: status ∈ [Open, In Progress] + reminder ≤ date
VidaTimelineSchema.index({ status: 1, reminder: 1 });

const VidaTimeline: Model<IVidaTimeline> = mongoose.models.VidaTimeline || mongoose.model<IVidaTimeline>('VidaTimeline', VidaTimelineSchema);

export default VidaTimeline;
