import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IVidaUser extends Document {
  name: string;
  email: string;
  password?: string;
  phone?: string;
  address?: string;
  AppRole: 'Super Admin' | 'Manager';
  designation?: string;
  bioDescription?: string;
  isOnWebsite?: boolean;
  profilePicture?: string;
  isActive: boolean;
  serialNo?: string;
  signature?: string;
}

const VidaUserSchema: Schema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  phone: { type: String },
  address: { type: String },
  serialNo: { type: String },
  signature: { type: String },
  AppRole: { 
    type: String, 
    enum: ['Super Admin', 'Manager'],
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
