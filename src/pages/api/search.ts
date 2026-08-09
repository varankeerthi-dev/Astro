// GET /api/search?q=… — public full-text search over KB articles
// (Postgres FTS via the generated search_tsv column).
import type { APIRoute } from 'astro';
import { query, dbReady } from '../../lib/db';
import { json } from '../../lib/cms/helpers';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const q = (url.searchParams.get('q') ?? '').trim();
  if (q.length < 2) return json({ rows: [] });
  if (!dbReady) return json({ rows: [] });

  try {
    const rows = await query<{ title: string; summary: string | null; page: { slug: string } | null }>(
      `select a.title, a.summary,
              jsonb_build_object('slug', p.slug) as page
         from public.kb_articles a
         left join public.pages p on p.id = a.page_id
        where a.status = 'published' and a.deleted_at is null
          and a.search_tsv @@ websearch_to_tsquery('english', $1)
        order by ts_rank(a.search_tsv, websearch_to_tsquery('english', $1)) desc
        limit 10`,
      [q],
    );
    return json({
      rows: rows.map((r) => ({
        title: r.title,
        summary: r.summary,
        url: r.page?.slug ?? '/help',
      })),
    });
  } catch {
    return json({ rows: [] });
  }
};
