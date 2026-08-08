// POST /api/kb-feedback — public "Was this article helpful?" widget.
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../lib/supabase/admin';
import { json } from '../../lib/cms/helpers';

export const prerender = false;

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const body = await request.json().catch(() => null);
  const articleId = String(body?.article_id ?? '');
  const helpful = Boolean(body?.helpful);
  const comment = body?.comment ? String(body.comment).slice(0, 1000) : null;
  if (!articleId) return json({ error: 'article_id_required' }, 400);

  const { data: article } = await supabaseAdmin
    .from('kb_articles')
    .select('id, helpful_yes, helpful_no')
    .eq('id', articleId)
    .eq('status', 'published')
    .maybeSingle();
  if (!article) return json({ error: 'not_found' }, 404);

  const { error } = await supabaseAdmin.from('kb_feedback').insert({ article_id: articleId, helpful, comment, ip: clientAddress });
  if (error) return json({ error: error.message }, 400);

  if (helpful) {
    await supabaseAdmin.from('kb_articles').update({ helpful_yes: (article.helpful_yes ?? 0) + 1 }).eq('id', articleId);
  } else {
    await supabaseAdmin.from('kb_articles').update({ helpful_no: (article.helpful_no ?? 0) + 1 }).eq('id', articleId);
  }
  return json({ ok: true });
};
