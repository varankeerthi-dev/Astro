import type { APIRoute } from 'astro';
import { query, queryOne, dbReady } from '../../../../lib/db';
import { json, requireCapability } from '../../../../lib/cms/helpers';

export const prerender = false;

export const GET: APIRoute = async () => {
  if (!dbReady) return json({ error: 'database_not_configured' }, 503);
  try {
    const rows = await query(`select id, name, slug, description from public.blog_categories order by name`);
    return json(rows);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
};

export const POST: APIRoute = async (ctx) => {
  const denied = requireCapability(ctx.locals.profile, 'content.create');
  if (denied) return denied;
  const body = await ctx.request.json().catch(() => null);
  if (!body || !body.name) return json({ error: 'name_required' }, 400);
  try {
    const rows = await query(
      `insert into public.blog_categories (name, slug, description)
       values ($1, $2, $3) returning *`,
      [
        String(body.name).trim(),
        String(body.slug ?? '').trim() || null,
        body.description ? String(body.description) : null,
      ],
    );
    return json(rows[0], 201);
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
};
