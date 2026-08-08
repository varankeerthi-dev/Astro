// GET /api/admin/preview?path=/blog/my-draft — mints a 15-minute preview cookie
// and redirects. The middleware verifies the HMAC and lets public pages read
// drafts (locals.preview). Preview responses bypass the CDN cache.
import type { APIRoute } from 'astro';
import { PREVIEW_COOKIE } from '../../../lib/auth/session';
import { signPreview } from '../../../lib/cms/preview';
import { json } from '../../../lib/cms/helpers';

export const prerender = false;

export const GET: APIRoute = async ({ url, cookies, redirect, locals }) => {
  if (!locals.profile) return json({ error: 'unauthorized' }, 401);
  const path = url.searchParams.get('path') ?? '/';
  if (!path.startsWith('/') || path.startsWith('//')) return json({ error: 'invalid_path' }, 400);

  const token = signPreview(path);
  if (!token) return json({ error: 'preview_not_configured', message: 'Set PREVIEW_SECRET to enable preview mode.' }, 503);

  cookies.set(PREVIEW_COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    maxAge: 15 * 60,
  });
  return redirect(path);
};
