// Media blob storage on Neon (replaces Supabase Storage).
//
// Files live in the `media_files` table as bytea blobs, keyed by their
// storage_path (e.g. `misc/2026/08/hero-768w.webp`), and are served through
// the same-origin route /media/[...path]. This keeps the CMS fully
// self-contained on Neon with zero extra accounts. Swap to Cloudflare R2 /
// S3 later by changing only the three functions below + mediaUrl().
import { query, execute, dbReady } from './db';

/** Public URL for a stored path (same-origin route). */
export function mediaUrl(path: string): string {
  if (!path) return '';
  return `/media/${path.replace(/^\/+/, '')}`;
}

/** Insert or overwrite a blob. */
export async function saveFile(path: string, data: Buffer, mime: string): Promise<void> {
  if (!dbReady) throw new Error('database not configured');
  await execute(
    `insert into public.media_files (path, data, mime) values ($1, $2, $3)
     on conflict (path) do update set data = excluded.data, mime = excluded.mime`,
    [path.replace(/^\/+/, ''), data, mime],
  );
}

/** Fetch a blob + mime by path, or null. */
export async function getFile(path: string): Promise<{ data: Buffer; mime: string } | null> {
  const rows = await query<{ data: Uint8Array; mime: string }>(
    `select data, mime from public.media_files where path = $1`,
    [path.replace(/^\/+/, '')],
  );
  const row = rows[0];
  if (!row) return null;
  return { data: Buffer.from(row.data), mime: row.mime };
}

/** Delete blobs (best-effort — the caller already soft-deleted the asset row). */
export async function deleteFiles(paths: string[]): Promise<void> {
  const clean = paths.map((p) => p.replace(/^\/+/, ''));
  if (clean.length === 0) return;
  await execute(`delete from public.media_files where path = any($1)`, [clean]);
}
