-- 0005_seo_pages.sql — page registry + per-page SEO records (Phase 3)

-- ── pages: every public page gets an identity + ownership ───────────────────
create table if not exists public.pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null,                     -- '/', '/pricing', '/industries/construction-erp', …
  page_type text not null default 'static'
    check (page_type in ('static','blog','location','help','system')),
  title text not null,                    -- internal name + breadcrumb source
  status public.content_status not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
-- Duplicate-slug guard (only among live rows — soft-deleted slugs can be reused)
create unique index if not exists pages_slug_alive on public.pages (slug) where deleted_at is null;
create index if not exists pages_type_idx on public.pages (page_type, status) where deleted_at is null;

-- ── page_seo: 1:1 SEO record per page ───────────────────────────────────────
create table if not exists public.page_seo (
  page_id uuid primary key references public.pages(id) on delete cascade,
  seo_title text,
  meta_description text,
  canonical_url text,                     -- absolute; defaults to site base + slug when null
  robots text not null default 'index,follow',
  focus_keyword text,
  secondary_keywords text[],
  og_title text,
  og_description text,
  og_image_id uuid references public.media_assets(id) on delete set null,
  twitter_card text not null default 'summary_large_image',
  breadcrumb_title text,
  jsonld_extra jsonb                      -- page-type-specific schema overrides
);

-- Duplicate *title* detection is intentionally a soft admin warning
-- (see /api/admin/seo/analyze), not a hard constraint.
create index if not exists page_seo_title_idx on public.page_seo (lower(trim(seo_title)));
