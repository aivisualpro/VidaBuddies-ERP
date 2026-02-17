import mongoose, { Schema, Model } from 'mongoose';

export interface IEmailAttachment {
  fileId: string;
  name: string;
  mimeType: string;
  size: string;
}

export interface IEmailRecord {
  vbpoNo: string;
  folderPath: string;
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  body: string;
  attachments: IEmailAttachment[];
  resendEmailId?: string;
  status: 'sent' | 'failed';
  error?: string;
  sentAt: Date;
}

const EmailAttachmentSchema = new Schema({
  fileId: { type: String },
  name: { type: String },
  mimeType: { type: String },
  size: { type: String },
}, { _id: false });

const EmailRecordSchema: Schema = new Schema({
  vbpoNo: { type: String, required: true, index: true },
  folderPath: { type: String, default: '' },
  from: { type: String, default: '' },
  to: [{ type: String }],
  cc: [{ type: String }],
  subject: { type: String, default: '' },
  body: { type: String, default: '' },
  attachments: [EmailAttachmentSchema],
  resendEmailId: { type: String },
  status: { type: String, enum: ['sent', 'failed'], default: 'sent' },
  error: { type: String },
  sentAt: { type: Date, default: Date.now },
});

const EmailRecord: Model<IEmailRecord> =
  mongoose.models.EmailRecord ||
  mongoose.model<IEmailRecord>('EmailRecord', EmailRecordSchema);

export default EmailRecord;
