// POST /api/admin/logout — clear the session + preview cookies.
import type { APIRoute } from 'astro';
import { ACCESS_COOKIE, PREVIEW_COOKIE } from '../../../lib/auth/session';

export const prerender = false;

export const POST: APIRoute = async ({ cookies, redirect }) => {
  cookies.delete(ACCESS_COOKIE, { path: '/' });
  cookies.delete(PREVIEW_COOKIE, { path: '/' });
  return redirect('/admin/login');
};
