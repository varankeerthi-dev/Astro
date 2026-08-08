import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase/admin';
import { json, requireCapability } from '../../../lib/cms/helpers';

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const denied = requireCapability(ctx.locals.profile, 'content.edit');
  if (denied) return denied;

  const url = new URL(ctx.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const perPage = 50;

  let query = supabaseAdmin
    .from('pages')
    .select('id, slug, title, page_type, status, updated_at, page_seo(*)', { count: 'exact' })
    .is('deleted_at', null)
    .order('slug')
    .range((page - 1) * perPage, page * perPage - 1);
  if (q) query = query.or(`slug.ilike.%${q}%,title.ilike.%${q}%`);

  const { data, error, count } = await query;
  if (error) return json({ error: error.message }, 500);

  // Duplicate-title detection (soft warning, computed on the fly)
  const { data: allSeo } = await supabaseAdmin
    .from('page_seo')
    .select('page_id, seo_title')
    .not('seo_title', 'is', null);
  const byTitle = new Map<string, string[]>();
  for (const s of allSeo ?? []) {
    const t = String(s.seo_title).trim().toLowerCase();
    if (!t) continue;
    byTitle.set(t, [...(byTitle.get(t) ?? []), String(s.page_id)]);
  }
  const duplicates = [...byTitle.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([title, ids]) => ({ title, pageIds: ids }));

  return json({ rows: data ?? [], total: count ?? 0, page, duplicates });
};
