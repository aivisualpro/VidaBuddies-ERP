require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');

const EmailAttachmentSchema = new mongoose.Schema({
  fileId: { type: String },
  name: { type: String },
  mimeType: { type: String },
  size: { type: String },
}, { _id: false });

const EmailRecordSchema = new mongoose.Schema({
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
  direction: { type: String, enum: ['inbound', 'outbound'], default: 'outbound' },
  error: { type: String },
  sentAt: { type: Date, default: Date.now },
  type: { type: String, default: 'Invoice' },
  reference: { type: String, default: '' },
});

const EmailRecord = mongoose.models.EmailRecord || mongoose.model('EmailRecord', EmailRecordSchema);

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const emails = await EmailRecord.find({ vbpoNo: 'VB259-17' }).sort({ sentAt: -1 }).limit(3);
  emails.forEach(e => {
    console.log(`Type: ${e.type}, Reference: "${e.reference}"`);
  });
  
  await mongoose.disconnect();
}

run().catch(console.error);
