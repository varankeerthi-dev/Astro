// Dynamic sitemap — built from the pages table so DB-driven routes (blog,
// locations, KB articles) are included automatically as modules ship.
import type { APIRoute } from 'astro';
import { query, dbReady } from '../lib/db';

export const prerender = false;

const PRIORITY: Record<string, string> = {
  static: '0.8',
  help: '0.6',
  blog: '0.6',
  location: '0.7',
  system: '0.3',
};

const esc = (s: string) =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

export const GET: APIRoute = async () => {
  const base = (import.meta.env.SITE ?? 'https://perfecterp.com').replace(/\/$/, '');

  let urls: { loc: string; lastmod?: string; priority: string }[] = [];
  if (dbReady) {
    try {
      const rows = await query<{ slug: string; page_type: string; updated_at: string | null }>(
        `select slug, page_type, updated_at from public.pages
          where status = 'published' and deleted_at is null
          order by slug`,
      );
      urls = rows.map((p) => ({
        loc: `${base}${p.slug === '/' ? '/' : p.slug.replace(/\/+$/, '') + '/'}`,
        lastmod: p.updated_at ? String(p.updated_at).slice(0, 10) : undefined,
        priority: PRIORITY[p.page_type] ?? '0.5',
      }));
    } catch {
      // fall through to the static minimum below
    }
  }
  if (urls.length === 0) {
    urls = ['/', '/pricing', '/help'].map((slug) => ({ loc: `${base}${slug}`, priority: '0.8' }));
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map(
        (u) =>
          `  <url><loc>${esc(u.loc)}</loc>` +
          (u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : '') +
          `<priority>${u.priority}</priority></url>`,
      )
      .join('\n') +
    `\n</urlset>\n`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
