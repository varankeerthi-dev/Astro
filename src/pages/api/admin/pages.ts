import type { APIRoute } from 'astro';
import { query, queryOne, dbReady } from '../../../lib/db';
import { json, requireCapability } from '../../../lib/cms/helpers';

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const denied = requireCapability(ctx.locals.profile, 'content.edit');
  if (denied) return denied;
  if (!dbReady) return json({ error: 'database_not_configured' }, 503);

  const url = new URL(ctx.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const perPage = 50;

  const where = ['p.deleted_at is null'];
  const params: unknown[] = [];
  if (q) {
    params.push(`%${q}%`);
    where.push(`(p.slug ilike $1 or p.title ilike $1)`);
  }
  const whereSql = where.join(' and ');

  try {
    const countRow = await queryOne<{ n: string }>(
      `select count(*) as n from public.pages p where ${whereSql}`,
      params,
    );
    const total = Number(countRow?.n ?? 0);

    params.push(perPage, (page - 1) * perPage);
    const data = await query(
      `select p.id, p.slug, p.title, p.page_type, p.status, p.updated_at,
              (select to_jsonb(seo) from public.page_seo seo where seo.page_id = p.id) as page_seo
         from public.pages p
        where ${whereSql}
        order by p.slug
        limit $${params.length - 1} offset $${params.length}`,
      params,
    );

    // Duplicate-title detection (soft warning, computed on the fly)
    const allSeo = await query<{ page_id: string; seo_title: string }>(
      `select page_id, seo_title from public.page_seo where seo_title is not null`,
    );
    const byTitle = new Map<string, string[]>();
    for (const s of allSeo) {
      const t = String(s.seo_title).trim().toLowerCase();
      if (!t) continue;
      byTitle.set(t, [...(byTitle.get(t) ?? []), String(s.page_id)]);
    }
    const duplicates = [...byTitle.entries()]
      .filter(([, ids]) => ids.length > 1)
      .map(([title, ids]) => ({ title, pageIds: ids }));

    return json({ rows: data, total, page, duplicates });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
};
