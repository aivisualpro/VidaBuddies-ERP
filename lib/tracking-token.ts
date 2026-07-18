import crypto from "crypto";

/**
 * Public tracking links — stateless, signed access for external people.
 *
 * Each container gets an unguessable token: HMAC-SHA256(containerNo, secret).
 * The email CTA links to  {PUBLIC_APP_URL}/track/{containerNo}?t={token}
 * and the /track page verifies the token before showing anything.
 *
 * - No login required for clients — the token IS the credential.
 * - Read-only: the page only exposes tracking data for that one container.
 * - Revocable globally by rotating TRACKING_TOKEN_SECRET.
 *
 * Env:
 *   PUBLIC_APP_URL         — public origin used in emails/links
 *                            (default https://app.vidabuddies.com)
 *   TRACKING_TOKEN_SECRET  — HMAC secret (falls back to CRON_SECRET)
 */

const secret = () =>
  process.env.TRACKING_TOKEN_SECRET || process.env.CRON_SECRET || "vb-tracking-dev-secret";

/** Public origin for links sent to external people (never localhost). */
export function publicAppUrl(): string {
  const url = process.env.PUBLIC_APP_URL || "https://app.vidabuddies.com";
  return url.replace(/\/+$/, "");
}

/** Normalize so tokens are stable regardless of input casing/whitespace */
const norm = (containerNo: string) => String(containerNo || "").trim().toUpperCase();

export function signTrackingToken(containerNo: string): string {
  return crypto
    .createHmac("sha256", secret())
    .update(`vb-track:${norm(containerNo)}`)
    .digest("hex")
    .slice(0, 32);
}

export function verifyTrackingToken(containerNo: string, token: string): boolean {
  if (!token || typeof token !== "string") return false;
  const expected = signTrackingToken(containerNo);
  const a = Buffer.from(expected);
  const b = Buffer.from(token.trim());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Full shareable tracking URL for a container */
export function buildTrackingUrl(containerNo: string): string {
  const c = norm(containerNo);
  return `${publicAppUrl()}/track/${encodeURIComponent(c)}?t=${signTrackingToken(c)}`;
}
