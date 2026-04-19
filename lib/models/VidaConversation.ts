import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IVidaConversation extends Document {
  participants: mongoose.Types.ObjectId[];
  lastMessage?: string;
  lastMessageAt?: Date;
  lastSender?: mongoose.Types.ObjectId;
}

const VidaConversationSchema: Schema = new Schema({
  participants: [{ type: Schema.Types.ObjectId, ref: 'VidaUser' }],
  lastMessage: { type: String },
  lastSender: { type: Schema.Types.ObjectId, ref: 'VidaUser' },
  lastMessageAt: { type: Date, default: Date.now },
}, { timestamps: true });

// Prevent duplicate models during hot-reloads
const VidaConversation: Model<IVidaConversation> = mongoose.models.VidaConversation || mongoose.model<IVidaConversation>('VidaConversation', VidaConversationSchema);

export default VidaConversation;
