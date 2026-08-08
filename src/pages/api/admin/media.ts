import type { APIRoute } from 'astro';
import sharp from 'sharp';
import { supabaseAdmin } from '../../../lib/supabase/admin';
import { json, requireCapability, writeAudit } from '../../../lib/cms/helpers';
import { slugify } from '../../../lib/utils/slug';

export const prerender = false;

const WIDTHS = [480, 768, 1280, 1920];

function extFor(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
    'image/gif': 'gif', 'image/svg+xml': 'svg',
  };
  return map[mime] ?? 'bin';
}

export const GET: APIRoute = async (ctx) => {
  const denied = requireCapability(ctx.locals.profile, 'content.edit');
  if (denied) return denied;

  const url = new URL(ctx.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  const folderId = url.searchParams.get('folder_id') ?? '';
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const perPage = 24;

  let query = supabaseAdmin
    .from('media_assets')
    .select('*, folder:media_folders(path)', { count: 'exact' })
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);
  if (q) query = query.ilike('filename', `%${q}%`);
  if (folderId) query = query.eq('folder_id', folderId);

  const { data, error, count } = await query;
  if (error) return json({ error: error.message }, 500);

  const { data: usage } = await supabaseAdmin.from('media_usage').select('media_id');
  const counts = new Map<string, number>();
  for (const u of usage ?? []) counts.set(String(u.media_id), (counts.get(String(u.media_id)) ?? 0) + 1);

  const { data: folders } = await supabaseAdmin.from('media_folders').select('*').order('path');
  return json({
    rows: (data ?? []).map((r) => ({ ...r, usage_count: counts.get(String(r.id)) ?? 0 })),
    total: count ?? 0,
    page,
    folders: folders ?? [],
  });
};

export const POST: APIRoute = async (ctx) => {
  const denied = requireCapability(ctx.locals.profile, 'content.create');
  if (denied) return denied;

  const contentType = ctx.request.headers.get('content-type') ?? '';

  // JSON → create a folder
  if (contentType.includes('application/json')) {
    const body = await ctx.request.json().catch(() => null);
    const name = String(body?.name ?? '').trim();
    if (!name) return json({ error: 'name_required' }, 400);
    const parentId = body?.parent_id ? String(body.parent_id) : null;
    const parentPath = parentId
      ? ((await supabaseAdmin.from('media_folders').select('path').eq('id', parentId).maybeSingle()).data?.path as string | undefined) ?? ''
      : '';
    const path = `${parentPath}/${slugify(name)}`.replace(/\/+/g, '/');
    const { data, error } = await supabaseAdmin.from('media_folders').insert({ name, parent_id: parentId, path }).select().single();
    if (error) return json({ error: error.message }, 400);
    return json(data, 201);
  }

  // Multipart → upload + sharp variants
  const form = await ctx.request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return json({ error: 'file_required' }, 400);

  const folderId = form.get('folder_id') ? String(form.get('folder_id')) : null;
  const alt = form.get('alt_text') ? String(form.get('alt_text')) : '';
  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = file.type || 'application/octet-stream';
  const ext = extFor(mime);

  const folderPath = folderId
    ? ((await supabaseAdmin.from('media_folders').select('path').eq('id', folderId).maybeSingle()).data?.path as string | undefined) ?? 'misc'
    : 'misc';
  const base = slugify((file.name ?? 'file').replace(/\.[a-z0-9]+$/i, ''));
  const d = new Date();
  const dir = `${folderPath}/${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`.replace(/\/+/g, '/');
  const original = `${dir}/${base}-orig.${ext}`;

  const { error: upErr } = await supabaseAdmin.storage.from('media').upload(original, buffer, { contentType: mime, upsert: false });
  if (upErr) return json({ error: upErr.message }, 400);

  const variants: Record<string, string> = { original };
  let width: number | null = null;
  let height: number | null = null;
  if (['jpg', 'png', 'webp'].includes(ext)) {
    try {
      const meta = await sharp(buffer).metadata();
      width = meta.width ?? null;
      height = meta.height ?? null;
      for (const w of WIDTHS) {
        if (width && w >= width) continue;
        const vbuf = await sharp(buffer).resize({ width: w }).webp({ quality: 80 }).toBuffer();
        const vpath = `${dir}/${base}-${w}w.webp`;
        await supabaseAdmin.storage.from('media').upload(vpath, vbuf, { contentType: 'image/webp', upsert: false });
        variants[String(w)] = vpath;
      }
    } catch {
      // metadata/variants are best-effort — the original is already stored
    }
  }

  const { data, error } = await supabaseAdmin
    .from('media_assets')
    .insert({
      bucket: 'media',
      storage_path: original,
      folder_id: folderId,
      filename: `${base}.${ext}`,
      mime,
      bytes: buffer.length,
      width,
      height,
      alt_text: alt || null,
      variants,
      uploaded_by: ctx.locals.profile?.id ?? null,
    })
    .select()
    .single();
  if (error) return json({ error: error.message }, 400);

  await writeAudit({
    actor_id: ctx.locals.profile?.id,
    action: 'create',
    entity: 'media',
    entity_id: data.id as string,
    summary: `Uploaded ${data.filename}`,
    ip: ctx.clientAddress,
  });
  return json(data, 201);
};
