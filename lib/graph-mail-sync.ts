import connectToDatabase from '@/lib/db';
import EmailRecord from '@/lib/models/EmailRecord';

/**
 * Microsoft Graph API - Inbound Email Sync
 * 
 * Uses OAuth2 client_credentials flow (daemon/service app) to read
 * the notifications@vidabuddies.com inbox without IMAP.
 * 
 * Required env vars:
 *   AZURE_TENANT_ID   – Your Microsoft 365 tenant ID
 *   AZURE_CLIENT_ID   – Azure AD App registration client ID
 *   AZURE_CLIENT_SECRET – Azure AD App registration client secret
 *   GRAPH_MAIL_USER   – The mailbox to read (notifications@vidabuddies.com)
 */

interface GraphMessage {
  id: string;
  subject: string;
  bodyPreview: string;
  body: { contentType: string; content: string };
  from: { emailAddress: { name: string; address: string } };
  toRecipients: { emailAddress: { name: string; address: string } }[];
  ccRecipients: { emailAddress: { name: string; address: string } }[];
  receivedDateTime: string;
  isRead: boolean;
}

async function getGraphToken(): Promise<string> {
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error(
      'Microsoft Graph credentials not configured. Please add AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET to your .env file.'
    );
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error('[Graph] Token error:', errorText);
    throw new Error(`Failed to get Graph API token: ${res.status}`);
  }

  const data = await res.json();
  return data.access_token;
}

export async function syncInboundEmails() {
  await connectToDatabase();

  const mailUser = process.env.GRAPH_MAIL_USER || process.env.SMTP_USER;
  if (!mailUser) {
    throw new Error('GRAPH_MAIL_USER or SMTP_USER not configured.');
  }

  const token = await getGraphToken();

  // Fetch unread emails from the inbox (last 50)
  const graphUrl = `https://graph.microsoft.com/v1.0/users/${mailUser}/mailFolders/inbox/messages?$filter=isRead eq false&$top=50&$select=id,subject,bodyPreview,body,from,toRecipients,ccRecipients,receivedDateTime,isRead&$orderby=receivedDateTime desc`;

  console.log('[Graph] Fetching unread emails...');
  const res = await fetch(graphUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error('[Graph] Fetch error:', errorText);
    throw new Error(`Failed to fetch emails from Graph API: ${res.status}`);
  }

  const data = await res.json();
  const messages: GraphMessage[] = data.value || [];

  console.log(`[Graph] Found ${messages.length} unread emails.`);

  let processedCount = 0;

  for (const msg of messages) {
    const subject = msg.subject || '(No Subject)';

    // Try to extract PO Number from subject. e.g. "Re: Release Request - PO# PO-02888"
    const poMatch = subject.match(/PO-[0-9A-Z]+/i);
    const poNo = poMatch ? poMatch[0].toUpperCase() : null;

    if (poNo) {
      // Check if we already synced this message (by subject + date combo)
      const existing = await EmailRecord.findOne({
        direction: 'inbound',
        subject: subject,
        sentAt: new Date(msg.receivedDateTime),
      });

      if (!existing) {
        const fromText = msg.from?.emailAddress
          ? `${msg.from.emailAddress.name} <${msg.from.emailAddress.address}>`
          : '';
        const toArray = msg.toRecipients?.map(
          (r) => `${r.emailAddress.name} <${r.emailAddress.address}>`
        ) || [];
        const ccArray = msg.ccRecipients?.map(
          (r) => `${r.emailAddress.name} <${r.emailAddress.address}>`
        ) || [];

        // Extract plain text from HTML body
        let bodyText = msg.bodyPreview || '';
        if (msg.body?.content) {
          bodyText = msg.body.content
            .replace(/<[^>]+>/g, '') // strip HTML tags
            .replace(/&nbsp;/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 5000); // cap at 5000 chars
        }

        await EmailRecord.create({
          vbpoNo: poNo,
          from: fromText,
          to: toArray,
          cc: ccArray,
          subject,
          body: bodyText,
          attachments: [],
          status: 'sent',
          direction: 'inbound',
          sentAt: new Date(msg.receivedDateTime),
        });

        processedCount++;
        console.log(`[Graph] Synced reply for PO: ${poNo} — "${subject}"`);
      }
    }

    // Mark as read in the mailbox
    try {
      await fetch(
        `https://graph.microsoft.com/v1.0/users/${mailUser}/messages/${msg.id}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ isRead: true }),
        }
      );
    } catch (e) {
      console.warn('[Graph] Failed to mark message as read:', msg.id);
    }
  }

  return { success: true, count: processedCount, totalUnread: messages.length };
}
