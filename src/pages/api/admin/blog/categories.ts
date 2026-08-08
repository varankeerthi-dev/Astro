import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabase/admin';
import { json, requireCapability } from '../../../../lib/cms/helpers';

export const prerender = false;

export const GET: APIRoute = async () => {
  const { data, error } = await supabaseAdmin
    .from('blog_categories')
    .select('id, name, slug, description')
    .order('name');
  if (error) return json({ error: error.message }, 500);
  return json(data ?? []);
};

export const POST: APIRoute = async (ctx) => {
  const denied = requireCapability(ctx.locals.profile, 'content.create');
  if (denied) return denied;
  const body = await ctx.request.json().catch(() => null);
  if (!body || !body.name) return json({ error: 'name_required' }, 400);
  const { data, error } = await supabaseAdmin.from('blog_categories').insert({
    name: String(body.name).trim(),
    slug: String(body.slug ?? '').trim() || undefined,
    description: body.description ? String(body.description) : null,
  }).select().single();
  if (error) return json({ error: error.message }, 400);
  return json(data, 201);
};
