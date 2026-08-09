// POST /api/kb-feedback — public "Was this article helpful?" widget.
import type { APIRoute } from 'astro';
import { queryOne, withTx, dbReady } from '../../lib/db';
import { json } from '../../lib/cms/helpers';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  const articleId = String(body?.article_id ?? '');
  const helpful = Boolean(body?.helpful);
  const comment = body?.comment ? String(body.comment).slice(0, 1000) : null;
  if (!articleId) return json({ error: 'article_id_required' }, 400);
  if (!dbReady) return json({ error: 'database_not_configured' }, 503);

  try {
    const article = await queryOne<{ id: string; helpful_yes: number; helpful_no: number }>(
      `select id, helpful_yes, helpful_no from public.kb_articles
        where id = $1 and status = 'published'`,
      [articleId],
    );
    if (!article) return json({ error: 'not_found' }, 404);

    await withTx(async (q) => {
      await q(
        `insert into public.kb_feedback (article_id, helpful, comment) values ($1, $2, $3)`,
        [articleId, helpful, comment],
      );
      const col = helpful ? 'helpful_yes' : 'helpful_no';
      await q(
        `update public.kb_articles set ${col} = ${col} + 1 where id = $1`,
        [articleId],
      );
    });
    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
};
