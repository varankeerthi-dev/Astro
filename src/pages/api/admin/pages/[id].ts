import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabase/admin';
import { json, requireCapability, writeAudit } from '../../../../lib/cms/helpers';
import { purgeCacheTags } from '../../../../lib/cache';

export const prerender = false;

const SEO_FIELDS = [
  'seo_title', 'meta_description', 'canonical_url', 'robots',
  'focus_keyword', 'secondary_keywords', 'og_title', 'og_description',
  'twitter_card', 'breadcrumb_title',
];

export const GET: APIRoute = async (ctx) => {
  const denied = requireCapability(ctx.locals.profile, 'content.edit');
  if (denied) return denied;
  const { data, error } = await supabaseAdmin
    .from('pages')
    .select('*, page_seo(*)')
    .eq('id', ctx.params.id ?? '')
    .maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (!data) return json({ error: 'not_found' }, 404);
  return json(data);
};

export const PATCH: APIRoute = async (ctx) => {
  const denied = requireCapability(ctx.locals.profile, 'content.edit');
  if (denied) return denied;

  const body = await ctx.request.json().catch(() => null);
  if (!body) return json({ error: 'invalid_json' }, 400);
  const id = ctx.params.id ?? '';

  const { data: before } = await supabaseAdmin.from('pages').select('*').eq('id', id).maybeSingle();
  if (!before) return json({ error: 'not_found' }, 404);

  const pagePatch: Record<string, unknown> = {};
  if (body.title !== undefined) pagePatch.title = String(body.title).slice(0, 120);
  if (body.status !== undefined && ['draft', 'scheduled', 'published', 'archived'].includes(String(body.status))) {
    pagePatch.status = String(body.status);
  }
  pagePatch.updated_at = new Date().toISOString();

  const { data: updated, error: pageErr } = await supabaseAdmin.from('pages').update(pagePatch).eq('id', id).select().single();
  if (pageErr) return json({ error: pageErr.message }, 400);

  if (body.seo && typeof body.seo === 'object') {
    const seo = body.seo as Record<string, unknown>;
    const clean: Record<string, unknown> = {};
    for (const f of SEO_FIELDS) if (seo[f] !== undefined) clean[f] = seo[f];
    const { data: existing } = await supabaseAdmin.from('page_seo').select('page_id').eq('page_id', id).maybeSingle();
    const seoErr = existing
      ? await supabaseAdmin.from('page_seo').update(clean).eq('page_id', id)
      : await supabaseAdmin.from('page_seo').insert({ page_id: id, ...clean });
    if (seoErr.error) return json({ error: seoErr.error.message }, 400);
  }

  await writeAudit({
    actor_id: ctx.locals.profile?.id,
    action: 'update',
    entity: 'page',
    entity_id: id,
    summary: `Updated page ${before.slug}`,
    ip: ctx.clientAddress,
  });
  await purgeCacheTags(['page', String(before.slug)]);
  return json(updated);
};

export const DELETE: APIRoute = async (ctx) => {
  const denied = requireCapability(ctx.locals.profile, 'content.delete');
  if (denied) return denied;
  const id = ctx.params.id ?? '';
  const { data: before } = await supabaseAdmin.from('pages').select('slug').eq('id', id).maybeSingle();
  if (!before) return json({ error: 'not_found' }, 404);
  const { error } = await supabaseAdmin.from('pages').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) return json({ error: error.message }, 500);
  await writeAudit({
    actor_id: ctx.locals.profile?.id,
    action: 'delete',
    entity: 'page',
    entity_id: id,
    summary: `Deleted page ${before.slug}`,
    ip: ctx.clientAddress,
  });
  await purgeCacheTags(['page', String(before.slug)]);
  return json({ ok: true });
};
