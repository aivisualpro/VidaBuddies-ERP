import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IVidaCarrier extends Document {
  name: string;
  createdAt: Date;
}

const VidaCarrierSchema: Schema = new Schema({
  name: { type: String, required: true, unique: true, trim: true },
  createdAt: { type: Date, default: Date.now }
});

const VidaCarrier: Model<IVidaCarrier> = mongoose.models.VidaCarrier || mongoose.model<IVidaCarrier>('VidaCarrier', VidaCarrierSchema);

export default VidaCarrier;
