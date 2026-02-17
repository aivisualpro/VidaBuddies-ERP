import mongoose, { Schema, Model } from 'mongoose';

export interface IFileVisibility {
  driveFileId: string;
  visibility: 'internal' | 'external';
  updatedAt: Date;
}

const FileVisibilitySchema: Schema = new Schema({
  driveFileId: { type: String, required: true, unique: true, index: true },
  visibility: { type: String, enum: ['internal', 'external'], default: 'internal' },
  updatedAt: { type: Date, default: Date.now },
});

const FileVisibility: Model<IFileVisibility> =
  mongoose.models.FileVisibility ||
  mongoose.model<IFileVisibility>('FileVisibility', FileVisibilitySchema);

export default FileVisibility;
