const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env' });

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log("No MONGODB_URI found");
    return;
  }
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    const emails = await db.collection('emailrecords').find({ vbpoNo: 'VB259-17' }).toArray();
    console.log("Emails found:", emails.length);
    emails.forEach(e => {
      console.log(`Type: "${e.type}", FolderPath: "${e.folderPath}", Subject: "${e.subject}"`);
    });
  } finally {
    await client.close();
  }
}
run().catch(console.error);
