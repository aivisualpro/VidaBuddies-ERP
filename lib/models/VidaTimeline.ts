import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IVidaTimeline extends Document {
    vbpoNo?: string;
    poNo?: string;
    svbid?: string;
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
    vbpoNo: { type: String },
    poNo: { type: String },
    svbid: { type: String },
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
VidaTimelineSchema.index({ vbpoNo: 1, timestamp: -1 });
VidaTimelineSchema.index({ poNo: 1, timestamp: -1 });
VidaTimelineSchema.index({ svbid: 1, timestamp: -1 });

const VidaTimeline: Model<IVidaTimeline> = mongoose.models.VidaTimeline || mongoose.model<IVidaTimeline>('VidaTimeline', VidaTimelineSchema);

export default VidaTimeline;
