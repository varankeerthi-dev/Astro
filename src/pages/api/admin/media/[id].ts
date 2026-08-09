import type { APIRoute } from 'astro';
import sharp from 'sharp';
import { query, queryOne, dbReady } from '../../../../lib/db';
import { saveFile, deleteFiles } from '../../../../lib/storage';
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

  try {
    const set = Object.keys(patch).map((k, i) => `${k} = $${i + 1}`).join(', ');
    const rows = await query(
      `update public.media_assets set ${set} where id = $${Object.keys(patch).length + 1} returning *`,
      [...Object.values(patch), id],
    );
    if (!rows[0]) return json({ error: 'not_found' }, 404);
    const data = rows[0];
    await writeAudit({
      actor_id: ctx.locals.profile?.id,
      action: 'update',
      entity: 'media',
      entity_id: id,
      summary: `Updated media ${data.filename}`,
      ip: ctx.clientAddress,
    });
    return json(data);
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
};

export const POST: APIRoute = async (ctx) => {
  const denied = requireCapability(ctx.locals.profile, 'content.edit');
  if (denied) return denied;
  const id = ctx.params.id ?? '';

  const row = await queryOne<Record<string, unknown>>(`select * from public.media_assets where id = $1`, [id]);
  if (!row) return json({ error: 'not_found' }, 404);

  const form = await ctx.request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return json({ error: 'file_required' }, 400);
  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = file.type || 'application/octet-stream';
  const ext = extFor(mime);

  try {
    const base = slugify(String(row.filename).replace(/\.[a-z0-9]+$/i, ''));
    const folderPath = row.folder_id
      ? ((await queryOne<{ path: string }>(`select path from public.media_folders where id = $1`, [row.folder_id]))?.path ?? 'misc')
      : 'misc';
    const d = new Date();
    const dir = `${folderPath}/${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`.replace(/\/+/g, '/');
    const original = `${dir}/${base}-orig.${ext}`;

    await saveFile(original, buffer, mime);

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
          await saveFile(vpath, vbuf, 'image/webp');
          variants[String(w)] = vpath;
        }
      } catch {
        // best effort
      }
    }

    const rows = await query(
      `update public.media_assets
          set storage_path = $1, filename = $2, mime = $3, bytes = $4, width = $5, height = $6, variants = $7
        where id = $8 returning *`,
      [original, `${base}.${ext}`, mime, buffer.length, width, height, JSON.stringify(variants), id],
    );
    const data = rows[0];

    // best-effort cleanup of the previous files
    try {
      const oldVariants = (row.variants as Record<string, string> | null) ?? { original: row.storage_path };
      await deleteFiles(Object.values(oldVariants));
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
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
};

export const DELETE: APIRoute = async (ctx) => {
  const denied = requireCapability(ctx.locals.profile, 'content.delete');
  if (denied) return denied;
  const id = ctx.params.id ?? '';

  try {
    const usage = await query(`select entity, field from public.media_usage where media_id = $1`, [id]);
    if (usage.length > 0) {
      return json({
        error: 'in_use',
        usage: usage.slice(0, 10),
        message: 'This file is used by published content. Remove it from those pages first.',
      }, 409);
    }

    const row = await queryOne<Record<string, unknown>>(`select * from public.media_assets where id = $1`, [id]);
    if (!row) return json({ error: 'not_found' }, 404);

    await query(`update public.media_assets set deleted_at = $1 where id = $2`, [new Date().toISOString(), id]);

    try {
      const variants = (row.variants as Record<string, string> | null) ?? { original: row.storage_path };
      await deleteFiles(Object.values(variants));
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
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
};
