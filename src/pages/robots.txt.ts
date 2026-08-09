// Dynamic robots.txt — body comes from Website Settings (editable in /admin/settings),
// with a safe default when the CMS isn't configured. Sitemap line appended automatically.
import type { APIRoute } from 'astro';
import { queryOne, dbReady } from '../lib/db';

export const prerender = false;

const fallback = (base: string) => `User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`;

export const GET: APIRoute = async () => {
  const base = (import.meta.env.SITE ?? 'https://perfecterp.com').replace(/\/$/, '');
  let body = fallback(base);
  if (dbReady) {
    try {
      const data = await queryOne<{ robots_txt: string | null; sitemap_enabled: boolean }>(
        `select robots_txt, sitemap_enabled from public.site_settings where id = 1`,
      );
      if (data?.robots_txt?.trim()) {
        body = data.robots_txt.trim();
        if (data.sitemap_enabled !== false) body += `\n\nSitemap: ${base}/sitemap.xml\n`;
        else body += '\n';
      }
    } catch {
      // settings table not reachable — serve the fallback
    }
  }
  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
