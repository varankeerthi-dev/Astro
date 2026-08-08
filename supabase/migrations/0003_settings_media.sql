-- 0003_settings_media.sql — Website Settings singleton + Media Library tables
-- (media tables are created first so site_settings can reference them)

-- ── media_folders ───────────────────────────────────────────────────────────
create table if not exists public.media_folders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  parent_id uuid references public.media_folders(id) on delete set null,
  path text not null unique             -- materialized path: /banners/homepage
);

-- ── media_assets ────────────────────────────────────────────────────────────
create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  bucket text not null default 'media',
  storage_path text not null unique,    -- /banners/2026/08/erp-software-chennai-1920w.webp
  folder_id uuid references public.media_folders(id) on delete set null,
  filename text not null,               -- SEO-friendly, slugified at upload time
  mime text not null,
  bytes int,
  width int,
  height int,
  alt_text text,
  caption text,
  variants jsonb,                       -- {"480": "…-480w.webp", "768": …, "original": …}
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists media_assets_folder_idx on public.media_assets (folder_id) where deleted_at is null;
create index if not exists media_assets_filename_idx on public.media_assets (lower(filename));

-- ── media_usage ("where is this asset used?") ───────────────────────────────
create table if not exists public.media_usage (
  media_id uuid not null references public.media_assets(id) on delete cascade,
  entity text not null,
  entity_id uuid not null,
  field text not null,
  primary key (media_id, entity, entity_id, field)
);

-- ── site_settings (singleton row id=1, edited in /admin/settings) ───────────
create table if not exists public.site_settings (
  id int primary key default 1 check (id = 1),
  site_name text,
  tagline text,
  logo_media_id uuid references public.media_assets(id) on delete set null,
  favicon_media_id uuid references public.media_assets(id) on delete set null,
  contact_email text,
  contact_phone text,
  address jsonb,                        -- {line1,line2,city,state,pin,country}
  business_hours jsonb,                 -- [{days, open, close}]
  social_links jsonb,                   -- {linkedin, twitter, youtube, …}
  copyright_text text,                  -- supports {year} placeholder
  default_seo_title text,
  default_seo_description text,
  default_og_image_id uuid references public.media_assets(id) on delete set null,
  robots_txt text,                      -- editable robots body (sitemap line appended at serve time)
  sitemap_enabled boolean not null default true,
  gsc_verification text,                -- Google Search Console meta token
  ga_measurement_id text,               -- future
  gtm_id text,                          -- future
  clarity_project_id text,              -- Phase 8: settings-driven, env fallback
  umami_website_id text,                -- Phase 8: settings-driven, env fallback
  cookie_consent_text text,
  header_scripts text,                  -- administrator-only
  footer_scripts text,                  -- administrator-only
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
