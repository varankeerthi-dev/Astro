// CDN cache helpers: tag public responses (middleware) and purge them on
// publish (crud layer). No-op when Vercel env vars aren't configured —
// stale-while-revalidate keeps the site fresh anyway.
const TTL_S = 300;

export function cacheHeaders(tags: string[], ttl = TTL_S): Record<string, string> {
  return {
    'Cache-Control': `public, s-maxage=${ttl}, stale-while-revalidate=600`,
    'X-Vercel-Cache-Tags': tags.join(','),
  };
}

/** Cache tags for a public pathname (kept in sync with publish purges). */
export function cacheTagsFor(pathname: string): string[] {
  if (pathname === '/') return ['home', 'banners', 'announcements'];
  if (pathname === '/pricing') return ['pricing', 'announcements'];
  if (pathname.startsWith('/help')) return ['help', 'kb'];
  if (pathname.startsWith('/blog')) return ['blog'];
  if (pathname.startsWith('/locations')) return ['locations'];
  if (pathname.startsWith('/industries')) return ['industries'];
  return ['page'];
}

export async function purgeCacheTags(tags: string[]): Promise<void> {
  const token = import.meta.env.VERCEL_TOKEN as string | undefined;
  const projectId = import.meta.env.VERCEL_PROJECT_ID as string | undefined;
  if (!token || !projectId || tags.length === 0) return;
  try {
    await fetch(`https://api.vercel.com/v1/projects/${projectId}/cache/purge`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags }),
    });
  } catch {
    // best-effort; stale-while-revalidate limits the blast radius
  }
}
