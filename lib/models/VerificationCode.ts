import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IVerificationCode extends Document {
  userId: mongoose.Types.ObjectId;
  code: string;
  email: string;
  expiresAt: Date;
  attempts: number;
  createdAt: Date;
}

const VerificationCodeSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'VidaUser', required: true },
  code: { type: String, required: true },
  email: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  attempts: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

// Auto-delete expired codes
VerificationCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// One active code per user
VerificationCodeSchema.index({ userId: 1 });

const VerificationCode: Model<IVerificationCode> = 
  mongoose.models.VerificationCode || 
  mongoose.model<IVerificationCode>('VerificationCode', VerificationCodeSchema);

export default VerificationCode;
