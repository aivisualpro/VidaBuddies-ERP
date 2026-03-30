import crypto from 'crypto';

// Use a fallback key for development, but in production this should be in .env
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'vidaBuddiesSuperSecretKey_32bytes!'.substring(0, 32); 
const ALGORITHM = 'aes-256-cbc';

// Ensure key is exactly 32 bytes
const KEY = crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest('base64').substring(0, 32);

export function encryptPassword(text: string): string {
  if (!text) return text;
  
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(KEY), iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  // Return IV along with the encrypted text, separated by a colon
  return `${iv.toString('hex')}:${encrypted}`;
}

export function decryptPassword(encryptedText: string): string {
  if (!encryptedText) return encryptedText;
  
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 2) return encryptedText; // Probably not encrypted
    
    const iv = Buffer.from(parts[0], 'hex');
    let encryptedTextBuffer = Buffer.from(parts[1], 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(KEY), iv);
    
    let decrypted = decipher.update(encryptedTextBuffer);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString('utf8');
  } catch (error) {
    console.error('Decryption failed:', error);
    return encryptedText; // Return original if failed
  }
}
