// Public read helpers. Plain SQL over Neon — live filters are explicit here
// (mirrors what the old Supabase anon RLS policies allowed). `includeDrafts`
// is only ever true when a signed-in staff member has a preview cookie
// (locals.preview).
import { query, queryOne, dbReady } from '../db';

export interface LiveOpts {
  includeDrafts?: boolean;
}

type Row = Record<string, unknown>;

const LIVE_SQL = (opts: LiveOpts, withWindow: boolean): string => {
  if (opts.includeDrafts) return `deleted_at is null and status <> 'archived'`;
  if (withWindow) {
    return `deleted_at is null and status = 'published'
       and (publish_at is null or publish_at <= now())
       and (unpublish_at is null or unpublish_at > now())`;
  }
  return `deleted_at is null and status = 'published'
     and (publish_at is null or publish_at <= now())`;
};

/** banners for the homepage carousel */
export async function getLiveBanners(opts: LiveOpts = {}) {
  if (!dbReady) return [];
  return query(`select * from public.banners where ${LIVE_SQL(opts, true)} order by display_order asc`);
}

/** announcements for the sitewide top bar */
export async function getLiveAnnouncements(opts: LiveOpts = {}) {
  if (!dbReady) return [];
  return query(
    `select * from public.announcements where ${LIVE_SQL(opts, true)} order by priority desc, created_at desc`,
  );
}

/** page + its SEO record (slug = pathname, e.g. '/pricing') */
export async function getPageBySlug(slug: string, opts: LiveOpts = {}) {
  if (!dbReady) return null;
  const page = await queryOne<Row>(`select * from public.pages where slug = $1 and deleted_at is null`, [slug]);
  if (!page) return null;
  if (!opts.includeDrafts && page.status !== 'published') return null;
  const seo = await queryOne<Row>(`select * from public.page_seo where page_id = $1`, [page.id]);
  return { ...page, page_seo: seo ?? null };
}

export async function getLocationBySlug(slug: string, opts: LiveOpts = {}) {
  if (!dbReady) return null;
  const page = await queryOne<Row>(
    `select * from public.pages where slug = $1 and deleted_at is null`,
    [`/locations/${slug}`],
  );
  if (!page) return null;
  const loc = await queryOne<Row>(`select * from public.location_pages where page_id = $1`, [page.id]);
  if (!loc) return null;
  if (!opts.includeDrafts && loc.status !== 'published') return null;
  // resolve the banner media storage path (banner_path was a latent bug in the
  // original — mediaUrl('') rendered a broken <img>)
  let banner_path: string | null = null;
  if (loc.banner_media_id) {
    const media = await queryOne<Row>(
      `select storage_path from public.media_assets where id = $1`,
      [loc.banner_media_id],
    );
    banner_path = (media?.storage_path as string | null) ?? null;
  }
  const seo = await queryOne<Row>(`select * from public.page_seo where page_id = $1`, [page.id]);
  return { ...loc, banner_path, page: { ...page, page_seo: seo ?? null } };
}

export async function getBlogPostBySlug(slug: string, opts: LiveOpts = {}) {
  if (!dbReady) return null;
  const page = await queryOne<Row>(`select * from public.pages where slug = $1 and deleted_at is null`, [
    `/blog/${slug}`,
  ]);
  if (!page) return null;
  const post = await queryOne<Row>(`select * from public.blog_posts where page_id = $1`, [page.id]);
  if (!post) return null;
  if (!opts.includeDrafts && post.status !== 'published') return null;

  const [category, author, seo] = await Promise.all([
    post.category_id
      ? queryOne<Row>(`select name, slug from public.blog_categories where id = $1`, [post.category_id])
      : Promise.resolve(null),
    post.author_id
      ? queryOne<Row>(`select full_name from public.profiles where id = $1`, [post.author_id])
      : Promise.resolve(null),
    queryOne<Row>(`select * from public.page_seo where page_id = $1`, [page.id]),
  ]);
  return { ...post, category: category ?? null, author: author ?? null, page: { ...page, page_seo: seo ?? null } };
}

export async function listBlogPosts(opts: { page?: number; perPage?: number; category?: string } = {}) {
  const page = opts.page ?? 1;
  const perPage = opts.perPage ?? 9;
  if (!dbReady) return { rows: [], total: 0, page, perPage };

  const where = [`bp.deleted_at is null`, `bp.status = 'published'`];
  const params: unknown[] = [];
  if (opts.category) {
    params.push(opts.category);
    where.push(`c.slug = $${params.length}`);
  }

  const countRows = await query<{ n: string }>(
    `select count(*) as n
       from public.blog_posts bp
       left join public.blog_categories c on c.id = bp.category_id
      where ${where.join(' and ')}`,
    params,
  );
  const total = Number(countRows[0]?.n ?? 0);

  params.push(perPage, (page - 1) * perPage);
  const rows = await query<Row>(
    `select bp.id, bp.title, bp.excerpt, bp.featured_image_id, bp.reading_time_min,
            bp.publish_at, bp.created_at,
            jsonb_build_object('name', c.name, 'slug', c.slug) as category,
            jsonb_build_object('slug', p.slug) as page
       from public.blog_posts bp
       left join public.blog_categories c on c.id = bp.category_id
       left join public.pages p on p.id = bp.page_id
      where ${where.join(' and ')}
      order by bp.publish_at desc nulls last, bp.created_at desc
      limit $${params.length - 1} offset $${params.length}`,
    params,
  );
  return { rows, total, page, perPage };
}

export async function getKbArticleBySlug(slug: string, opts: LiveOpts = {}) {
  if (!dbReady) return null;
  const page = await queryOne<Row>(`select * from public.pages where slug = $1 and deleted_at is null`, [
    `/help/${slug}`,
  ]);
  if (!page) return null;
  const article = await queryOne<Row>(`select * from public.kb_articles where page_id = $1`, [page.id]);
  if (!article) return null;
  if (!opts.includeDrafts && article.status !== 'published') return null;

  const [category, author] = await Promise.all([
    article.category_id
      ? queryOne<Row>(`select name, slug, palette_key from public.kb_categories where id = $1`, [article.category_id])
      : Promise.resolve(null),
    article.author_id
      ? queryOne<Row>(`select full_name from public.profiles where id = $1`, [article.author_id])
      : Promise.resolve(null),
  ]);
  return { ...article, category: category ?? null, author: author ?? null, page: { slug: page.slug } };
}

export async function listKbArticles(opts: { category?: string; kind?: string; limit?: number } = {}) {
  const limit = opts.limit ?? 50;
  if (!dbReady) return [];

  const where = [`a.deleted_at is null`, `a.status = 'published'`];
  const params: unknown[] = [];
  if (opts.category) {
    params.push(opts.category);
    where.push(`c.slug = $${params.length}`);
  }
  if (opts.kind) {
    params.push(opts.kind);
    where.push(`a.kind = $${params.length}`);
  }
  params.push(limit);

  return query<Row>(
    `select a.id, a.title, a.summary, a.reading_time_min, a.updated_at,
            jsonb_build_object('name', c.name, 'slug', c.slug, 'palette_key', c.palette_key) as category,
            jsonb_build_object('slug', p.slug) as page
       from public.kb_articles a
       left join public.kb_categories c on c.id = a.category_id
       left join public.pages p on p.id = a.page_id
      where ${where.join(' and ')}
      order by a.updated_at desc
      limit $${params.length}`,
    params,
  );
}

export async function listKbCategories() {
  if (!dbReady) return [];
  return query(
    `select id, name, slug, kind, palette_key from public.kb_categories order by display_order asc`,
  );
}

export async function listReleaseNotes() {
  if (!dbReady) return [];
  return query(
    `select * from public.release_notes where status = 'published' and deleted_at is null order by released_on desc nulls last`,
  );
}

export async function searchKb(q: string, limit = 10) {
  if (!dbReady) return [];
  return query<Row>(
    `select a.id, a.title, a.summary, jsonb_build_object('slug', p.slug) as page
       from public.kb_articles a
       left join public.pages p on p.id = a.page_id
      where a.status = 'published' and a.deleted_at is null
        and a.search_tsv @@ websearch_to_tsquery('english', $1)
      order by ts_rank(a.search_tsv, websearch_to_tsquery('english', $1)) desc
      limit $2`,
    [q, limit],
  );
}

/** public media URL helper (same-origin /media route) */
export { mediaUrl } from '../storage';

/** article body from stored markdown (canonical source for editor v1) */
export function articleBody(md: string | null): string {
  return md ?? '';
}
