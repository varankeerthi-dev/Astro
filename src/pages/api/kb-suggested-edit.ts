// POST /api/kb-suggested-edit — public "Suggest an edit" workflow.
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../lib/supabase/admin';
import { json } from '../../lib/cms/helpers';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  const articleId = String(body?.article_id ?? '');
  const suggestion = String(body?.suggestion ?? '').trim();
  const contactEmail = body?.contact_email ? String(body.contact_email).trim().slice(0, 200) : null;
  if (!articleId || suggestion.length < 10) return json({ error: 'article_and_suggestion_required', message: 'Please write at least 10 characters.' }, 400);

  const { data: article } = await supabaseAdmin
    .from('kb_articles')
    .select('id')
    .eq('id', articleId)
    .eq('status', 'published')
    .maybeSingle();
  if (!article) return json({ error: 'not_found' }, 404);

  const { data, error } = await supabaseAdmin
    .from('kb_suggested_edits')
    .insert({ article_id: articleId, suggestion: suggestion.slice(0, 4000), contact_email: contactEmail })
    .select()
    .single();
  if (error) return json({ error: error.message }, 400);
  return json({ ok: true, id: data.id }, 201);
};
