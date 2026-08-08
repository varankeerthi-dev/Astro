// Preview cookie: HMAC-signed path + expiry so a stale cookie can never be
// replayed beyond its window. PREVIEW_SECRET lives server-side only.
import { createHmac, timingSafeEqual } from 'node:crypto';

const SECRET = import.meta.env.PREVIEW_SECRET as string | undefined;
const TTL_MS = 15 * 60 * 1000;

function hmac(payload: string): string {
  return createHmac('sha256', SECRET ?? '').update(payload).digest('hex');
}

/** Mint a preview token for a path (valid 15 minutes). Returns null when PREVIEW_SECRET is unset. */
export function signPreview(path: string): string | null {
  if (!SECRET) return null;
  const exp = Date.now() + TTL_MS;
  const payload = `${exp}|${path}`;
  return `${Buffer.from(payload).toString('base64url')}.${hmac(payload)}`;
}

/** Verify a preview token. Returns the signed path, or null when invalid/expired. */
export function verifyPreview(token: string): string | null {
  if (!SECRET) return null;
  const dot = token.indexOf('.');
  if (dot === -1) return null;
  const raw = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  let payload: string;
  try {
    payload = Buffer.from(raw, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  const expected = hmac(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const sep = payload.indexOf('|');
  const exp = parseInt(payload.slice(0, sep), 10);
  if (!Number.isFinite(exp) || exp < Date.now()) return null;
  return payload.slice(sep + 1);
}
