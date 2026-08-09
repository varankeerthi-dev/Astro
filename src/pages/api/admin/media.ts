import type { APIRoute } from 'astro';
import sharp from 'sharp';
import { query, queryOne, dbReady } from '../../../lib/db';
import { saveFile } from '../../../lib/storage';
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
  if (!dbReady) return json({ error: 'database_not_configured' }, 503);

  const url = new URL(ctx.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  const folderId = url.searchParams.get('folder_id') ?? '';
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const perPage = 24;

  const where: string[] = ['a.deleted_at is null'];
  const params: unknown[] = [];
  if (q) {
    params.push(`%${q}%`);
    where.push(`a.filename ilike $${params.length}`);
  }
  if (folderId) {
    params.push(folderId);
    where.push(`a.folder_id = $${params.length}`);
  }
  const whereSql = where.join(' and ');

  try {
    const countRow = await queryOne<{ n: string }>(
      `select count(*) as n from public.media_assets a where ${whereSql}`,
      params,
    );
    const total = Number(countRow?.n ?? 0);

    params.push(perPage, (page - 1) * perPage);
    const data = await query(
      `select a.*, jsonb_build_object('path', f.path) as folder
         from public.media_assets a
         left join public.media_folders f on f.id = a.folder_id
        where ${whereSql}
        order by a.created_at desc
        limit $${params.length - 1} offset $${params.length}`,
      params,
    );

    const usageRows = await query<{ media_id: string }>(`select media_id from public.media_usage`);
    const counts = new Map<string, number>();
    for (const u of usageRows) counts.set(String(u.media_id), (counts.get(String(u.media_id)) ?? 0) + 1);

    const folders = await query(`select * from public.media_folders order by path`);
    return json({
      rows: data.map((r) => ({ ...r, usage_count: counts.get(String(r.id)) ?? 0 })),
      total,
      page,
      folders,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
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
    try {
      const parentId = body?.parent_id ? String(body.parent_id) : null;
      const parentPath = parentId
        ? ((await queryOne<{ path: string }>(`select path from public.media_folders where id = $1`, [parentId]))?.path ?? '')
        : '';
      const path = `${parentPath}/${slugify(name)}`.replace(/\/+/g, '/');
      const rows = await query(
        `insert into public.media_folders (name, parent_id, path) values ($1, $2, $3) returning *`,
        [name, parentId, path],
      );
      return json(rows[0], 201);
    } catch (e) {
      return json({ error: (e as Error).message }, 400);
    }
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

  try {
    const folderPath = folderId
      ? ((await queryOne<{ path: string }>(`select path from public.media_folders where id = $1`, [folderId]))?.path ?? 'misc')
      : 'misc';
    const base = slugify((file.name ?? 'file').replace(/\.[a-z0-9]+$/i, ''));
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
        // metadata/variants are best-effort — the original is already stored
      }
    }

    const rows = await query(
      `insert into public.media_assets
         (bucket, storage_path, folder_id, filename, mime, bytes, width, height, alt_text, variants, uploaded_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning *`,
      [
        'media', original, folderId, `${base}.${ext}`, mime, buffer.length,
        width, height, alt || null, JSON.stringify(variants), ctx.locals.profile?.id ?? null,
      ],
    );
    const data = rows[0];

    await writeAudit({
      actor_id: ctx.locals.profile?.id,
      action: 'create',
      entity: 'media',
      entity_id: data.id as string,
      summary: `Uploaded ${data.filename}`,
      ip: ctx.clientAddress,
    });
    return json(data, 201);
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
};
