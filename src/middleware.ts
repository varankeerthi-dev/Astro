// Astro middleware: auth guard for /admin + /api/admin, preview-mode flag,
// and the CMS redirect map as a 404 fallback (legacy perfecterp.com URLs).
import { defineMiddleware } from 'astro:middleware';
import { getSessionProfile, PREVIEW_COOKIE } from './lib/auth/session';
import { queryOne, dbReady } from './lib/db';

const ADMIN_PREFIX = '/admin';
const ADMIN_API_PREFIX = '/api/admin';
const PUBLIC_ADMIN_PATHS = new Set(['/admin/login']);
const PUBLIC_ADMIN_API = new Set(['/api/admin/logout']); // logout must work even with an expired token

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  // ── Auth guard ────────────────────────────────────────────────────────────
  const isAdminPage = pathname.startsWith(ADMIN_PREFIX) && !PUBLIC_ADMIN_PATHS.has(pathname);
  const isAdminApi = pathname.startsWith(ADMIN_API_PREFIX) && !PUBLIC_ADMIN_API.has(pathname);
  if (isAdminPage || isAdminApi) {
    const profile = await getSessionProfile(context.cookies);
    if (!profile) {
      if (isAdminApi) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return context.redirect('/admin/login?next=' + encodeURIComponent(pathname));
    }
    context.locals.profile = profile;
  }

  // ── Preview mode (signed-in staff only; set by /api/admin/preview) ────────
  if (!context.isPrerendered && context.cookies.get(PREVIEW_COOKIE)?.value && context.locals.profile) {
    context.locals.preview = true;
  }

  const response = await next();

  // ── CMS redirect map as a 404 fallback ────────────────────────────────────
  if (response.status === 404 && !pathname.startsWith('/api/') && dbReady) {
    try {
      const row = await queryOne<{ to_path: string; status_code: number }>(
        `select to_path, status_code from public.redirects
          where from_path = $1 and is_active = true`,
        [pathname],
      );
      if (row) return context.redirect(row.to_path, row.status_code === 302 ? 302 : 301);
    } catch {
      // redirects table not reachable — fall through to the plain 404
    }
  }

  return response;
});
