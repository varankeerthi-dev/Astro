-- 0007_blog.sql — Phase 5 blog CMS

create table if not exists public.blog_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text
);

create table if not exists public.blog_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique
);

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  page_id uuid references public.pages(id) on delete set null,  -- slug + SEO via page_seo
  title text not null,
  excerpt text,
  content_json jsonb,                     -- rich editor document (TipTap-compatible)
  content_html text,                      -- server-rendered, sanitized cache of the above
  category_id uuid references public.blog_categories(id) on delete set null,
  author_id uuid references public.profiles(id) on delete set null,
  featured_image_id uuid references public.media_assets(id) on delete set null,
  reading_time_min int,                   -- computed on save
  toc jsonb,                              -- computed heading tree for the sticky TOC
  related_post_ids uuid[] not null default '{}',  -- manual override; fallback = same-category recent
  status public.content_status not null default 'draft',
  publish_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists blog_posts_public_idx on public.blog_posts (status, publish_at desc)
  where deleted_at is null;
create index if not exists blog_posts_category_idx on public.blog_posts (category_id)
  where deleted_at is null;

create table if not exists public.blog_post_tags (
  post_id uuid not null references public.blog_posts(id) on delete cascade,
  tag_id uuid not null references public.blog_tags(id) on delete cascade,
  primary key (post_id, tag_id)
);
