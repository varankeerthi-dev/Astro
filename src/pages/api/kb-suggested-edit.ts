// POST /api/kb-suggested-edit — public "Suggest an edit" workflow.
import type { APIRoute } from 'astro';
import { query, queryOne, dbReady } from '../../lib/db';
import { json } from '../../lib/cms/helpers';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  const articleId = String(body?.article_id ?? '');
  const suggestion = String(body?.suggestion ?? '').trim();
  const contactEmail = body?.contact_email ? String(body.contact_email).trim().slice(0, 200) : null;
  if (!articleId || suggestion.length < 10) {
    return json({ error: 'article_and_suggestion_required', message: 'Please write at least 10 characters.' }, 400);
  }
  if (!dbReady) return json({ error: 'database_not_configured' }, 503);

  try {
    const article = await queryOne<{ id: string }>(
      `select id from public.kb_articles where id = $1 and status = 'published'`,
      [articleId],
    );
    if (!article) return json({ error: 'not_found' }, 404);

    const rows = await query(
      `insert into public.kb_suggested_edits (article_id, suggestion, contact_email)
       values ($1, $2, $3) returning *`,
      [articleId, suggestion.slice(0, 4000), contactEmail],
    );
    return json({ ok: true, id: rows[0].id }, 201);
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
};
