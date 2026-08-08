-- 0009_navigation.sql — footer links + redirect map (migration safety net)

create table if not exists public.footer_links (
  id uuid primary key default gen_random_uuid(),
  column_name text not null,              -- Product|Industries|Support|Legal
  label text not null,
  url text not null,
  display_order int not null default 0,
  is_active boolean not null default true
);
create index if not exists footer_links_column_idx
  on public.footer_links (column_name, display_order) where is_active;
-- Makes seed.sql re-runnable and prevents accidental duplicates in the admin UI
create unique index if not exists footer_links_unique
  on public.footer_links (column_name, label);

create table if not exists public.redirects (
  id uuid primary key default gen_random_uuid(),
  from_path text not null unique,         -- e.g. /about.php (legacy perfecterp.com URLs)
  to_path text not null,
  status_code int not null default 301 check (status_code in (301, 302)),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists redirects_from_idx on public.redirects (from_path) where is_active;
