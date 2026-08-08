import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabase/admin';
import { json, requireCapability, writeAudit } from '../../../../lib/cms/helpers';

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const denied = requireCapability(ctx.locals.profile, 'kb.moderate');
  if (denied) return denied;
  const state = ctx.url.searchParams.get('state') ?? 'open';
  const { data, error } = await supabaseAdmin
    .from('kb_suggested_edits')
    .select('*, article:kb_articles(title, page:pages(slug))')
    .eq('state', state)
    .order('created_at', { ascending: false });
  if (error) return json({ error: error.message }, 500);
  return json(data ?? []);
};

export const POST: APIRoute = async (ctx) => {
  const denied = requireCapability(ctx.locals.profile, 'kb.moderate');
  if (denied) return denied;
  const body = await ctx.request.json().catch(() => null);
  if (!body || !body.id) return json({ error: 'id_required' }, 400);
  const state = String(body.state ?? '');
  if (!['open', 'accepted', 'rejected'].includes(state)) return json({ error: 'invalid_state' }, 400);

  const { data, error } = await supabaseAdmin
    .from('kb_suggested_edits')
    .update({ state, reviewed_by: ctx.locals.profile?.id ?? null, reviewed_at: new Date().toISOString() })
    .eq('id', body.id)
    .select()
    .single();
  if (error) return json({ error: error.message }, 400);

  await writeAudit({
    actor_id: ctx.locals.profile?.id,
    action: state === 'accepted' ? 'accept' : 'reject',
    entity: 'suggested edit',
    entity_id: String(body.id),
    summary: `Marked suggested edit ${state}`,
    ip: ctx.clientAddress,
  });
  return json(data);
};
