import type { APIRoute } from 'astro';
import sharp from 'sharp';
import { supabaseAdmin } from '../../../../lib/supabase/admin';
import { json, requireCapability, writeAudit } from '../../../../lib/cms/helpers';
import { slugify } from '../../../../lib/utils/slug';

export const prerender = false;

const WIDTHS = [480, 768, 1280, 1920];
const extFor = (mime: string): string =>
  ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg' }[mime] ?? 'bin');

export const PATCH: APIRoute = async (ctx) => {
  const denied = requireCapability(ctx.locals.profile, 'content.edit');
  if (denied) return denied;
  const id = ctx.params.id ?? '';
  const body = await ctx.request.json().catch(() => null);
  if (!body) return json({ error: 'invalid_json' }, 400);

  const patch: Record<string, unknown> = {};
  if (body.alt_text !== undefined) patch.alt_text = body.alt_text ? String(body.alt_text) : null;
  if (body.caption !== undefined) patch.caption = body.caption ? String(body.caption) : null;
  if (body.folder_id !== undefined) patch.folder_id = body.folder_id ? String(body.folder_id) : null;
  if (Object.keys(patch).length === 0) return json({ error: 'nothing_to_update' }, 400);

  const { data, error } = await supabaseAdmin.from('media_assets').update(patch).eq('id', id).select().single();
  if (error) return json({ error: error.message }, 400);
  await writeAudit({
    actor_id: ctx.locals.profile?.id,
    action: 'update',
    entity: 'media',
    entity_id: id,
    summary: `Updated media ${data.filename}`,
    ip: ctx.clientAddress,
  });
  return json(data);
};

export const POST: APIRoute = async (ctx) => {
  const denied = requireCapability(ctx.locals.profile, 'content.edit');
  if (denied) return denied;
  const id = ctx.params.id ?? '';

  const { data: row } = await supabaseAdmin.from('media_assets').select('*').eq('id', id).maybeSingle();
  if (!row) return json({ error: 'not_found' }, 404);

  const form = await ctx.request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return json({ error: 'file_required' }, 400);
  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = file.type || 'application/octet-stream';
  const ext = extFor(mime);
  const base = slugify(String(row.filename).replace(/\.[a-z0-9]+$/i, ''));
  const folderPath = row.folder_id
    ? ((await supabaseAdmin.from('media_folders').select('path').eq('id', row.folder_id).maybeSingle()).data?.path as string | undefined) ?? 'misc'
    : 'misc';
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
      // best effort
    }
  }

  const { data, error } = await supabaseAdmin
    .from('media_assets')
    .update({ storage_path: original, filename: `${base}.${ext}`, mime, bytes: buffer.length, width, height, variants })
    .eq('id', id)
    .select()
    .single();
  if (error) return json({ error: error.message }, 400);

  // best-effort cleanup of the previous files
  try {
    await supabaseAdmin.storage.from('media').remove(Object.values((row.variants as Record<string, string>) ?? { original: row.storage_path }));
  } catch {
    // ignore
  }

  await writeAudit({
    actor_id: ctx.locals.profile?.id,
    action: 'update',
    entity: 'media',
    entity_id: id,
    summary: `Replaced file for ${data.filename}`,
    ip: ctx.clientAddress,
  });
  return json(data);
};

export const DELETE: APIRoute = async (ctx) => {
  const denied = requireCapability(ctx.locals.profile, 'content.delete');
  if (denied) return denied;
  const id = ctx.params.id ?? '';

  const { data: usage } = await supabaseAdmin.from('media_usage').select('entity, field').eq('media_id', id);
  if (usage && usage.length > 0) {
    return json({ error: 'in_use', usage: usage.slice(0, 10), message: 'This file is used by published content. Remove it from those pages first.' }, 409);
  }

  const { data: row } = await supabaseAdmin.from('media_assets').select('*').eq('id', id).maybeSingle();
  if (!row) return json({ error: 'not_found' }, 404);

  const { error } = await supabaseAdmin.from('media_assets').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) return json({ error: error.message }, 500);

  try {
    await supabaseAdmin.storage.from('media').remove(Object.values((row.variants as Record<string, string>) ?? { original: row.storage_path }));
  } catch {
    // ignore
  }

  await writeAudit({
    actor_id: ctx.locals.profile?.id,
    action: 'delete',
    entity: 'media',
    entity_id: id,
    summary: `Deleted media ${row.filename}`,
    ip: ctx.clientAddress,
  });
  return json({ ok: true });
};
