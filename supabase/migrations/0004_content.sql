-- 0004_content.sql — Phase 1 Banners + Phase 2 Announcements

-- ── banners (homepage carousel) ─────────────────────────────────────────────
create table if not exists public.banners (
  id uuid primary key default gen_random_uuid(),
  title_html text,                        -- HTML overlay — never baked into the image
  subtitle text,
  desktop_media_id uuid references public.media_assets(id) on delete set null,
  mobile_media_id  uuid references public.media_assets(id) on delete set null,
  cta_label text,
  cta_url text,
  cta_style text not null default 'primary'
    check (cta_style in ('primary','outline','ghost')),
  display_order int not null default 0,   -- drag & drop in /admin/banners
  status public.content_status not null default 'draft',
  publish_at timestamptz,                 -- scheduled publishing window (evaluated at read time)
  unpublish_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz                  -- soft delete (archive = status)
);
create index if not exists banners_public_idx on public.banners (status, publish_at, unpublish_at)
  where deleted_at is null;
create index if not exists banners_order_idx on public.banners (display_order)
  where deleted_at is null;

-- ── announcements ───────────────────────────────────────────────────────────
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  kind public.announcement_kind not null default 'information',
  title text not null,
  description text,
  icon text,                              -- design-system icon key
  theme text not null default 'info'
    check (theme in ('info','success','warning','danger','brand')),
  button_label text,
  button_url text,
  priority int not null default 0,        -- higher wins when stacked
  publish_at timestamptz,
  unpublish_at timestamptz,
  dismissible boolean not null default true,   -- dismissal remembered in localStorage
  locations text[] not null default '{home_topbar}',  -- home_topbar|pricing_banner|help_sidebar|all_pages
  status public.content_status not null default 'draft',
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists announcements_public_idx
  on public.announcements (status, priority desc, publish_at, unpublish_at)
  where deleted_at is null;
