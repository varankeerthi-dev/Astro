// /media/[...path] — serves stored blobs (lib/storage.ts) with long cache
// headers. This replaces Supabase Storage's public bucket URLs.
import type { APIRoute } from 'astro';
import { getFile } from '../../lib/storage';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const path = Array.isArray(params.path) ? params.path.join('/') : (params.path ?? '');
  if (!path) return new Response('Not found', { status: 404 });

  try {
    const file = await getFile(path);
    if (!file) return new Response('Not found', { status: 404 });
    return new Response(file.data, {
      headers: {
        'Content-Type': file.mime || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
};
