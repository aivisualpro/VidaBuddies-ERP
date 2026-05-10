import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IVidaUser extends Document {
  name: string;
  email: string;
  password?: string;
  phone?: string;
  address?: string;
  AppRole: string;
  designation?: string;
  bioDescription?: string;
  isOnWebsite?: boolean;
  profilePicture?: string;
  isActive: boolean;
  serialNo?: string;
  signature?: string;
  isTwoFactorRequired?: boolean;
  lastSeen?: Date;
  chatSettings?: {
    notifyOn: 'all' | 'mentions' | 'none';
    soundOn: boolean;
    emailOn: boolean;
  };
}

const VidaUserSchema: Schema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  phone: { type: String },
  address: { type: String },
  serialNo: { type: String },
  signature: { type: String },
  isTwoFactorRequired: { type: Boolean, default: false },
  lastSeen: { type: Date },
  chatSettings: {
    notifyOn: { type: String, enum: ['all', 'mentions', 'none'], default: 'all' },
    soundOn: { type: Boolean, default: true },
    emailOn: { type: Boolean, default: true },
  },
  AppRole: { 
    type: String, 
    required: true,
    default: 'Manager'
  },
  designation: { type: String },
  bioDescription: { type: String },
  isOnWebsite: { type: Boolean, default: false },
  profilePicture: { type: String },
  isActive: { type: Boolean, default: true },
});

const VidaUser: Model<IVidaUser> = mongoose.models.VidaUser || mongoose.model<IVidaUser>('VidaUser', VidaUserSchema);

export default VidaUser;
