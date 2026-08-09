// Password hashing for the standalone /admin auth (Neon replaces Supabase Auth).
// Node's built-in scrypt — no new dependencies.
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const KEYLEN = 64;

/** Hash a password → `scrypt$<salt>$<hash>` (hex). */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, KEYLEN).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

/** Constant-time verify. Returns false for any malformed/legacy hash. */
export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, hash] = parts;
  const candidate = scryptSync(password, salt, KEYLEN);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

/** Random 32-byte session token (hex). */
export function newToken(): string {
  return randomBytes(32).toString('hex');
}
