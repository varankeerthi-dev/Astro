// GET /api/search?q=… — public full-text search over KB articles
// (Postgres FTS via the generated search_tsv column).
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../lib/supabase/admin';
import { json } from '../../lib/cms/helpers';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const q = (url.searchParams.get('q') ?? '').trim();
  if (q.length < 2) return json({ rows: [] });

  const { data, error } = await supabaseAdmin
    .from('kb_articles')
    .select('title, summary, page:pages(slug)')
    .eq('status', 'published')
    .is('deleted_at', null)
    .textSearch('search_tsv', q, { type: 'websearch' })
    .limit(10);
  if (error) return json({ error: error.message }, 500);

  return json({
    rows: (data ?? []).map((r) => ({
      title: r.title,
      summary: r.summary,
      url: (r.page as { slug?: string } | null)?.slug ?? '/help',
    })),
  });
};
