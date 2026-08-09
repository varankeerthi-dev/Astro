// Session helpers for the standalone /admin auth (Neon replaces Supabase Auth).
// The bf-access cookie holds a random 32-byte token; the sessions table maps
// it to a user with an expiry. No JWT, no Supabase Auth.
import type { AstroCookies } from 'astro';
import { execute, queryOne, dbReady } from '../db';
import { newToken } from './passwords';
import type { Role } from './permissions';

export const ACCESS_COOKIE = 'bf-access';
export const PREVIEW_COOKIE = 'bf-preview';

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface SessionProfile {
  id: string;
  email: string;
  full_name: string;
  role: Role;
}

/** Validate the session cookie and load the caller's profile (role from users). */
export async function getSessionProfile(cookies: AstroCookies): Promise<SessionProfile | null> {
  const token = cookies.get(ACCESS_COOKIE)?.value;
  if (!token || !dbReady) return null;
  try {
    const row = await queryOne<{ id: string; email: string; full_name: string; role: string }>(
      `select u.id, u.email, u.full_name, u.role
         from public.sessions s
         join public.users u on u.id = s.user_id
        where s.token = $1 and s.expires_at > now()`,
      [token],
    );
    if (!row) return null;
    return { id: row.id, email: row.email, full_name: row.full_name, role: row.role as Role };
  } catch {
    return null;
  }
}

/** Create a session row + set the cookie (login). */
export async function startSession(cookies: AstroCookies, userId: string): Promise<void> {
  const token = newToken();
  const expires = new Date(Date.now() + SESSION_TTL_MS);
  await execute(
    `insert into public.sessions (token, user_id, expires_at) values ($1, $2, $3)`,
    [token, userId, expires.toISOString()],
  );
  cookies.set(ACCESS_COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

/** Delete the session row + clear the cookie (logout). */
export async function endSession(cookies: AstroCookies): Promise<void> {
  const token = cookies.get(ACCESS_COOKIE)?.value;
  if (token) {
    try {
      await execute(`delete from public.sessions where token = $1`, [token]);
    } catch {
      /* best-effort */
    }
  }
  cookies.delete(ACCESS_COOKIE, { path: '/' });
  cookies.delete(PREVIEW_COOKIE, { path: '/' });
}
