import imaps from 'imap-simple';
import { simpleParser, AddressObject } from 'mailparser';
import EmailRecord from '@/lib/models/EmailRecord';
import connectToDatabase from '@/lib/db';

export async function syncInboundEmails() {
  await connectToDatabase();

  if (!process.env.IMAP_USER || !process.env.IMAP_PASS || !process.env.IMAP_HOST) {
    throw new Error('IMAP credentials not configured in environment. Please add IMAP_USER, IMAP_PASS, IMAP_HOST, IMAP_PORT.');
  }

  const config: imaps.ImapSimpleOptions = {
    imap: {
      user: process.env.IMAP_USER,
      password: process.env.IMAP_PASS,
      host: process.env.IMAP_HOST,
      port: parseInt(process.env.IMAP_PORT || '993', 10),
      tls: true,
      authTimeout: 10000,
      tlsOptions: { rejectUnauthorized: false } // Required for some Office 365 / Exchange setups
    }
  };

  try {
    console.log('[IMAP] Connecting to inbox...');
    const connection = await imaps.connect(config);
    await connection.openBox('INBOX');

    // Fetch unseen emails
    const searchCriteria = ['UNSEEN'];
    const fetchOptions = { bodies: [''], markSeen: true };
    const messages = await connection.search(searchCriteria, fetchOptions);
    
    console.log(`[IMAP] Found ${messages.length} unseen emails.`);

    let processedCount = 0;

    for (const msg of messages) {
       // get the raw email
       const allPart = msg.parts.find((part) => part.which === '');
       if (!allPart || !allPart.body) continue;

       // parse the raw body
       const parsed = await simpleParser(allPart.body);
       
       const subject = parsed.subject || '(No Subject)';
       const textBody = parsed.text || parsed.html || '';
       
       // Handle parsing 'from' safely
       const fromText = parsed.from ? parsed.from.text : '';
       
       // Handle parsing 'to' safely array mapping
       let toArray: string[] = [];
       if (Array.isArray(parsed.to)) {
           toArray = parsed.to.map(t => t.text);
       } else if (parsed.to && typeof parsed.to === 'object') {
           toArray = [parsed.to.text];
       }

       // Handle parsing 'cc' safely
       let ccArray: string[] = [];
       if (Array.isArray(parsed.cc)) {
           ccArray = parsed.cc.map(c => c.text);
       } else if (parsed.cc && typeof parsed.cc === 'object') {
           ccArray = [parsed.cc.text];
       }

       // Try to extract PO Number. e.g. "Release Request - PO# PO-02888"
       // Modify this Regex to capture standard PO formats your platform uses
       const poMatch = subject.match(/PO-[0-9A-Z]+/i);
       const poNo = poMatch ? poMatch[0].toUpperCase() : null;

       // If it is related to a PO, log it in the CRM Email Records!
       if (poNo) {
           await EmailRecord.create({
             vbpoNo: poNo,
             from: fromText,
             to: toArray,
             cc: ccArray,
             subject: subject,
             body: textBody,
             attachments: [], // Inbound attachments can be processed by uploading streams to S3/CloudStorage later if needed
             status: 'sent',  // Schema enforcement
             direction: 'inbound',
             sentAt: parsed.date || new Date(),
           });
           processedCount++;
           console.log(`[IMAP] Synced reply for PO: ${poNo}`);
       }
    }
    
    connection.end();
    return { success: true, count: processedCount, totalUnseen: messages.length };
  } catch (error: any) {
     console.error('[IMAP] Sync Error:', error);
     throw new Error(error.message || 'Failed to sync inbound emails');
  }
}
