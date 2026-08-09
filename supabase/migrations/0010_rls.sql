-- 0010_rls.sql — Row Level Security, grants, storage buckets
--
-- Access model (see design doc §7):
--   anon          → SELECT published-and-live rows only (public website reads)
--   authenticated → SELECT everything (admin list views); NO direct writes —
--                   all mutations go through /api/admin/* endpoints using the
--                   service role, so versioning + audit + cache purge can't be skipped.
--   exceptions    → kb_feedback / kb_suggested_edits accept public INSERTs (reader forms).

-- ── standalone-Postgres auth shim (Neon adaptation) ─────────────────────────
-- Supabase exposes auth.uid()/auth.jwt() and the anon/authenticated roles.
-- On Neon we create equivalent roles + functions reading a per-request session
-- claim (set via set_config by lib/db when a signed-in admin runs a query).
-- The app connects as the database owner, so RLS is bypassed in practice;
-- policies remain as documented defense-in-depth.
do $$ begin
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;

create schema if not exists auth;
create or replace function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create or replace function auth.jwt() returns jsonb
language sql stable
as $$ select nullif(current_setting('request.jwt.claims', true), '')::jsonb $$;

-- ── role helper (security definer avoids RLS recursion on profiles) ─────────
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ── enable RLS on every CMS table ───────────────────────────────────────────
alter table public.profiles            enable row level security;
alter table public.audit_log           enable row level security;
alter table public.content_versions    enable row level security;
alter table public.site_settings       enable row level security;
alter table public.media_folders       enable row level security;
alter table public.media_assets        enable row level security;
alter table public.media_usage         enable row level security;
alter table public.banners             enable row level security;
alter table public.announcements       enable row level security;
alter table public.pages               enable row level security;
alter table public.page_seo            enable row level security;
alter table public.location_pages      enable row level security;
alter table public.blog_categories     enable row level security;
alter table public.blog_tags           enable row level security;
alter table public.blog_posts          enable row level security;
alter table public.blog_post_tags      enable row level security;
alter table public.kb_categories       enable row level security;
alter table public.kb_articles         enable row level security;
alter table public.kb_feedback         enable row level security;
alter table public.kb_suggested_edits  enable row level security;
alter table public.release_notes       enable row level security;
alter table public.feature_releases    enable row level security;
alter table public.footer_links        enable row level security;
alter table public.redirects           enable row level security;

-- ── profiles ────────────────────────────────────────────────────────────────
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.current_user_role() = 'administrator');
-- No client insert/update/delete: invites & role changes go through service-role endpoints.

-- ── audit_log / content_versions ────────────────────────────────────────────
drop policy if exists audit_log_read on public.audit_log;
create policy audit_log_read on public.audit_log
  for select to authenticated
  using (public.current_user_role() in ('publisher','administrator'));

drop policy if exists content_versions_read on public.content_versions;
create policy content_versions_read on public.content_versions
  for select to authenticated using (true);
-- Inserts happen via service role only.

-- ── site_settings (public config — rendered on the public site anyway) ──────
drop policy if exists site_settings_public_read on public.site_settings;
create policy site_settings_public_read on public.site_settings
  for select to anon, authenticated using (true);
-- Updates: administrator only, via /api/admin/settings (service role).

-- ── media ───────────────────────────────────────────────────────────────────
drop policy if exists media_assets_public_read on public.media_assets;
create policy media_assets_public_read on public.media_assets
  for select to anon using (deleted_at is null);

drop policy if exists media_assets_staff_read on public.media_assets;
create policy media_assets_staff_read on public.media_assets
  for select to authenticated using (true);

drop policy if exists media_folders_public_read on public.media_folders;
create policy media_folders_public_read on public.media_folders
  for select to anon, authenticated using (true);

drop policy if exists media_usage_staff_read on public.media_usage;
create policy media_usage_staff_read on public.media_usage
  for select to authenticated using (true);

-- ── reusable visibility expressions ─────────────────────────────────────────
-- banners & announcements & blog_posts & kb_articles & location_pages use:
--   status='published' AND deleted_at IS NULL
--   AND (publish_at IS NULL OR publish_at <= now())
--   AND (unpublish_at IS NULL OR unpublish_at > now())   -- where the column exists

-- ── banners ─────────────────────────────────────────────────────────────────
drop policy if exists banners_public_read on public.banners;
create policy banners_public_read on public.banners
  for select to anon
  using (status = 'published' and deleted_at is null
     and (publish_at is null or publish_at <= now())
     and (unpublish_at is null or unpublish_at > now()));

drop policy if exists banners_staff_read on public.banners;
create policy banners_staff_read on public.banners
  for select to authenticated using (true);

-- ── announcements ───────────────────────────────────────────────────────────
drop policy if exists announcements_public_read on public.announcements;
create policy announcements_public_read on public.announcements
  for select to anon
  using (status = 'published' and deleted_at is null
     and (publish_at is null or publish_at <= now())
     and (unpublish_at is null or unpublish_at > now()));

drop policy if exists announcements_staff_read on public.announcements;
create policy announcements_staff_read on public.announcements
  for select to authenticated using (true);

-- ── pages & page_seo ────────────────────────────────────────────────────────
drop policy if exists pages_public_read on public.pages;
create policy pages_public_read on public.pages
  for select to anon
  using (status = 'published' and deleted_at is null);

drop policy if exists pages_staff_read on public.pages;
create policy pages_staff_read on public.pages
  for select to authenticated using (true);

drop policy if exists page_seo_public_read on public.page_seo;
create policy page_seo_public_read on public.page_seo
  for select to anon
  using (exists (
    select 1 from public.pages p
    where p.id = page_seo.page_id and p.status = 'published' and p.deleted_at is null
  ));

drop policy if exists page_seo_staff_read on public.page_seo;
create policy page_seo_staff_read on public.page_seo
  for select to authenticated using (true);

-- ── location_pages ──────────────────────────────────────────────────────────
drop policy if exists location_pages_public_read on public.location_pages;
create policy location_pages_public_read on public.location_pages
  for select to anon
  using (status = 'published' and deleted_at is null
     and (publish_at is null or publish_at <= now()));

drop policy if exists location_pages_staff_read on public.location_pages;
create policy location_pages_staff_read on public.location_pages
  for select to authenticated using (true);

-- ── blog ────────────────────────────────────────────────────────────────────
drop policy if exists blog_posts_public_read on public.blog_posts;
create policy blog_posts_public_read on public.blog_posts
  for select to anon
  using (status = 'published' and deleted_at is null
     and (publish_at is null or publish_at <= now()));

drop policy if exists blog_posts_staff_read on public.blog_posts;
create policy blog_posts_staff_read on public.blog_posts
  for select to authenticated using (true);

drop policy if exists blog_taxonomy_public_read on public.blog_categories;
create policy blog_taxonomy_public_read on public.blog_categories
  for select to anon, authenticated using (true);

drop policy if exists blog_tags_public_read on public.blog_tags;
create policy blog_tags_public_read on public.blog_tags
  for select to anon, authenticated using (true);

drop policy if exists blog_post_tags_public_read on public.blog_post_tags;
create policy blog_post_tags_public_read on public.blog_post_tags
  for select to anon, authenticated using (true);

-- ── knowledge base ──────────────────────────────────────────────────────────
drop policy if exists kb_articles_public_read on public.kb_articles;
create policy kb_articles_public_read on public.kb_articles
  for select to anon
  using (status = 'published' and deleted_at is null
     and (publish_at is null or publish_at <= now()));

drop policy if exists kb_articles_staff_read on public.kb_articles;
create policy kb_articles_staff_read on public.kb_articles
  for select to authenticated using (true);

drop policy if exists kb_categories_public_read on public.kb_categories;
create policy kb_categories_public_read on public.kb_categories
  for select to anon, authenticated using (true);

-- Reader forms: anyone can submit feedback / suggest an edit.
drop policy if exists kb_feedback_public_insert on public.kb_feedback;
create policy kb_feedback_public_insert on public.kb_feedback
  for insert to anon, authenticated with check (true);

drop policy if exists kb_feedback_staff_read on public.kb_feedback;
create policy kb_feedback_staff_read on public.kb_feedback
  for select to authenticated using (true);

drop policy if exists kb_suggested_edits_public_insert on public.kb_suggested_edits;
create policy kb_suggested_edits_public_insert on public.kb_suggested_edits
  for insert to anon, authenticated with check (true);

drop policy if exists kb_suggested_edits_staff_read on public.kb_suggested_edits;
create policy kb_suggested_edits_staff_read on public.kb_suggested_edits
  for select to authenticated using (true);

drop policy if exists release_notes_public_read on public.release_notes;
create policy release_notes_public_read on public.release_notes
  for select to anon
  using (status = 'published' and deleted_at is null);

drop policy if exists release_notes_staff_read on public.release_notes;
create policy release_notes_staff_read on public.release_notes
  for select to authenticated using (true);

-- feature_releases: internal composer — staff only.
drop policy if exists feature_releases_staff_read on public.feature_releases;
create policy feature_releases_staff_read on public.feature_releases
  for select to authenticated using (true);

-- ── navigation ──────────────────────────────────────────────────────────────
drop policy if exists footer_links_public_read on public.footer_links;
create policy footer_links_public_read on public.footer_links
  for select to anon, authenticated using (is_active);

drop policy if exists footer_links_staff_read on public.footer_links;
create policy footer_links_staff_read on public.footer_links
  for select to authenticated using (true);

drop policy if exists redirects_public_read on public.redirects;
create policy redirects_public_read on public.redirects
  for select to anon, authenticated using (is_active);

drop policy if exists redirects_staff_read on public.redirects;
create policy redirects_staff_read on public.redirects
  for select to authenticated using (true);

-- ── grants (RLS still filters rows; these grant table-level privileges) ─────
grant select on all tables in schema public to anon;
grant select on all tables in schema public to authenticated;
grant insert on public.kb_feedback, public.kb_suggested_edits to anon, authenticated;

-- ── storage (Neon adaptation) ───────────────────────────────────────────────
-- Supabase Storage buckets/policies are removed: media files move to object
-- storage (Cloudflare R2 / S3) with metadata tracked in media_assets.
