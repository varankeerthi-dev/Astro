import type { APIRoute } from 'astro';
import { query, queryOne, dbReady } from '../../../lib/db';
import { json, requireCapability } from '../../../lib/cms/helpers';

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const denied = requireCapability(ctx.locals.profile, 'audit.view');
  if (denied) return denied;
  if (!dbReady) return json({ error: 'database_not_configured' }, 503);

  const url = new URL(ctx.url);
  const entity = url.searchParams.get('entity') ?? '';
  const action = url.searchParams.get('action') ?? '';
  const q = (url.searchParams.get('q') ?? '').trim();
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const perPage = 50;

  const where: string[] = [];
  const params: unknown[] = [];
  if (entity) {
    params.push(entity);
    where.push(`a.entity = $${params.length}`);
  }
  if (action) {
    params.push(action);
    where.push(`a.action = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    where.push(`a.summary ilike $${params.length}`);
  }
  const whereSql = where.length ? `where ${where.join(' and ')}` : '';

  try {
    const countRow = await queryOne<{ n: string }>(
      `select count(*) as n from public.audit_log a ${whereSql}`,
      params,
    );
    const total = Number(countRow?.n ?? 0);

    params.push(perPage, (page - 1) * perPage);
    const rows = await query(
      `select a.id, a.action, a.entity, a.summary, a.diff, a.created_at,
              jsonb_build_object('full_name', p.full_name) as actor
         from public.audit_log a
         left join public.profiles p on p.id = a.actor_id
         ${whereSql}
         order by a.created_at desc
         limit $${params.length - 1} offset $${params.length}`,
      params,
    );
    return json({ rows, total, page });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
};
