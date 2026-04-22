require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const EmailRecord = mongoose.models.EmailRecord || mongoose.model('EmailRecord', new mongoose.Schema({
    vbpoNo: String,
    reference: String,
    type: String,
    subject: String
  }, { strict: false }));
  
  const emails = await EmailRecord.find({ vbpoNo: 'VB259-17' }).sort({ sentAt: -1 }).limit(1).lean();
  console.log(emails);
  await mongoose.disconnect();
}
run();
