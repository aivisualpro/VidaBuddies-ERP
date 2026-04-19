import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IVidaMessage extends Document {
  conversationId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  text: string;
  isRead: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const VidaMessageSchema: Schema = new Schema({
  conversationId: { type: Schema.Types.ObjectId, ref: 'VidaConversation', required: true, index: true },
  senderId: { type: Schema.Types.ObjectId, ref: 'VidaUser', required: true },
  text: { type: String, required: true },
  isRead: { type: Boolean, default: false },
}, { timestamps: true });

const VidaMessage: Model<IVidaMessage> = mongoose.models.VidaMessage || mongoose.model<IVidaMessage>('VidaMessage', VidaMessageSchema);

export default VidaMessage;
