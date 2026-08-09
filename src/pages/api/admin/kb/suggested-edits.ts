import type { APIRoute } from 'astro';
import { query, queryOne, dbReady } from '../../../../lib/db';
import { json, requireCapability, writeAudit } from '../../../../lib/cms/helpers';

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const denied = requireCapability(ctx.locals.profile, 'kb.moderate');
  if (denied) return denied;
  if (!dbReady) return json({ error: 'database_not_configured' }, 503);

  const state = ctx.url.searchParams.get('state') ?? 'open';
  try {
    const rows = await query(
      `select se.*,
              jsonb_build_object('title', k.title, 'page', jsonb_build_object('slug', p.slug)) as article
         from public.kb_suggested_edits se
         left join public.kb_articles k on k.id = se.article_id
         left join public.pages p on p.id = k.page_id
        where se.state = $1
        order by se.created_at desc`,
      [state],
    );
    return json(rows);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
};

export const POST: APIRoute = async (ctx) => {
  const denied = requireCapability(ctx.locals.profile, 'kb.moderate');
  if (denied) return denied;
  const body = await ctx.request.json().catch(() => null);
  if (!body || !body.id) return json({ error: 'id_required' }, 400);
  const state = String(body.state ?? '');
  if (!['open', 'accepted', 'rejected'].includes(state)) return json({ error: 'invalid_state' }, 400);

  try {
    const rows = await query(
      `update public.kb_suggested_edits
          set state = $1, reviewed_by = $2, reviewed_at = $3
        where id = $4 returning *`,
      [state, ctx.locals.profile?.id ?? null, new Date().toISOString(), body.id],
    );
    if (!rows[0]) return json({ error: 'not_found' }, 404);

    await writeAudit({
      actor_id: ctx.locals.profile?.id,
      action: state === 'accepted' ? 'accept' : 'reject',
      entity: 'suggested edit',
      entity_id: String(body.id),
      summary: `Marked suggested edit ${state}`,
      ip: ctx.clientAddress,
    });
    return json(rows[0]);
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
};
