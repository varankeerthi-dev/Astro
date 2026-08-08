import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabase/admin';
import { json, requireCapability } from '../../../../lib/cms/helpers';
import { slugify } from '../../../../lib/utils/slug';

export const prerender = false;

export const GET: APIRoute = async () => {
  const { data, error } = await supabaseAdmin.from('blog_tags').select('id, name, slug').order('name');
  if (error) return json({ error: error.message }, 500);
  return json(data ?? []);
};

export const POST: APIRoute = async (ctx) => {
  const denied = requireCapability(ctx.locals.profile, 'content.create');
  if (denied) return denied;
  const body = await ctx.request.json().catch(() => null);
  const name = String(body?.name ?? '').trim();
  if (!name) return json({ error: 'name_required' }, 400);
  const { data, error } = await supabaseAdmin.from('blog_tags').insert({
    name,
    slug: slugify(name),
  }).select().single();
  if (error) return json({ error: error.message }, 400);
  return json(data, 201);
};
