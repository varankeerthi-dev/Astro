import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase/admin';
import { json, requireCapability } from '../../../lib/cms/helpers';

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const denied = requireCapability(ctx.locals.profile, 'audit.view');
  if (denied) return denied;

  const url = new URL(ctx.url);
  const entity = url.searchParams.get('entity') ?? '';
  const action = url.searchParams.get('action') ?? '';
  const q = (url.searchParams.get('q') ?? '').trim();
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const perPage = 50;

  let query = supabaseAdmin
    .from('audit_log')
    .select('id, action, entity, summary, diff, created_at, actor:profiles(full_name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);
  if (entity) query = query.eq('entity', entity);
  if (action) query = query.eq('action', action);
  if (q) query = query.ilike('summary', `%${q}%`);

  const { data, error, count } = await query;
  if (error) return json({ error: error.message }, 500);
  return json({ rows: data ?? [], total: count ?? 0, page });
};
