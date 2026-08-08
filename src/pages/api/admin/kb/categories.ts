import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabase/admin';
import { json, requireCapability } from '../../../../lib/cms/helpers';
import { slugify } from '../../../../lib/utils/slug';

export const prerender = false;

export const GET: APIRoute = async () => {
  const { data, error } = await supabaseAdmin
    .from('kb_categories')
    .select('id, name, slug, kind, module, palette_key, display_order')
    .order('display_order');
  if (error) return json({ error: error.message }, 500);
  return json(data ?? []);
};

export const POST: APIRoute = async (ctx) => {
  const denied = requireCapability(ctx.locals.profile, 'content.create');
  if (denied) return denied;
  const body = await ctx.request.json().catch(() => null);
  const name = String(body?.name ?? '').trim();
  if (!name) return json({ error: 'name_required' }, 400);
  const { data, error } = await supabaseAdmin.from('kb_categories').insert({
    name,
    slug: slugify(name),
    kind: body?.kind ?? 'user_guide',
    module: body?.module ? String(body.module) : null,
    palette_key: body?.palette_key ?? 'blue',
    display_order: parseInt(body?.display_order ?? '0', 10) || 0,
  }).select().single();
  if (error) return json({ error: error.message }, 400);
  return json(data, 201);
};
