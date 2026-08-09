-- 0008_kb.sql — Phase 7 Knowledge Base (extends the existing help system)

-- ── kb_categories ───────────────────────────────────────────────────────────
create table if not exists public.kb_categories (
  id uuid primary key default gen_random_uuid(),
  kind public.kb_kind not null default 'user_guide',
  name text not null,
  slug text not null unique,
  module text,                            -- ERP module: CRM, Inventory, Site Visits…
  palette_key text not null default 'blue',  -- reuses help/[slug].astro's existing palettes
  display_order int not null default 0
);

-- ── kb_articles ─────────────────────────────────────────────────────────────
-- Immutable wrapper for array_to_string (STABLE in modern Postgres, so it cannot
-- appear directly inside a generated column).
create or replace function public.arr_to_text(a text[])
returns text
language sql immutable
as $$ select coalesce(array_to_string(a, ' '), '') $$;

create table if not exists public.kb_articles (
  id uuid primary key default gen_random_uuid(),
  page_id uuid references public.pages(id) on delete set null,
  kind public.kb_kind not null default 'user_guide',
  title text not null,
  summary text,
  content_json jsonb,
  content_html text,                      -- callouts/warnings/tips/steps/collapse blocks
  category_id uuid references public.kb_categories(id) on delete set null,
  module text,
  tags text[] not null default '{}',
  keywords text[] not null default '{}',  -- admin "search keywords" field
  difficulty public.difficulty not null default 'beginner',
  author_id uuid references public.profiles(id) on delete set null,
  product_version text,                   -- "applies to v2.4+"
  featured_image_id uuid references public.media_assets(id) on delete set null,
  attachments jsonb not null default '[]',    -- [{media_id, label}] PDFs/videos/GIFs
  related_article_ids uuid[] not null default '{}',
  reading_time_min int,
  toc jsonb,
  helpful_yes int not null default 0,     -- denormalized counters, maintained by feedback endpoint
  helpful_no int not null default 0,
  status public.content_status not null default 'draft',
  publish_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_reviewed_at timestamptz,
  deleted_at timestamptz,
  -- Full-text search document (title + summary + body + search keywords)
  search_tsv tsvector generated always as (
    to_tsvector('english'::regconfig,
      coalesce(title, '') || ' ' ||
      coalesce(summary, '') || ' ' ||
      coalesce(content_html, '') || ' ' ||
      public.arr_to_text(keywords))
  ) stored
);
create index if not exists kb_articles_fts on public.kb_articles using gin (search_tsv);
create index if not exists kb_articles_category_idx on public.kb_articles (category_id, status)
  where deleted_at is null;
create index if not exists kb_articles_module_idx on public.kb_articles (module)
  where deleted_at is null;

-- ── kb_feedback ("Was this article helpful?") ───────────────────────────────
create table if not exists public.kb_feedback (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.kb_articles(id) on delete cascade,
  helpful boolean not null,
  comment text,
  created_at timestamptz not null default now()
);
create index if not exists kb_feedback_article_idx on public.kb_feedback (article_id, created_at desc);

-- ── kb_suggested_edits (reader → editor workflow) ───────────────────────────
create table if not exists public.kb_suggested_edits (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.kb_articles(id) on delete cascade,
  suggestion text not null,
  contact_email text,
  state text not null default 'open' check (state in ('open','accepted','rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index if not exists kb_suggested_edits_state_idx on public.kb_suggested_edits (state, created_at desc);

-- ── release_notes (timeline view, filter by version/module) ─────────────────
create table if not exists public.release_notes (
  id uuid primary key default gen_random_uuid(),
  version text not null,                  -- e.g. 2.4.0
  module text,
  badge text not null default 'improved' check (badge in ('new','improved','fixed')),
  title text not null,
  description text,
  article_id uuid references public.kb_articles(id) on delete set null,  -- optional deep link
  released_on date,
  status public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists release_notes_timeline_idx on public.release_notes (released_on desc)
  where deleted_at is null;

-- ── feature_releases (Feature Discovery: multi-destination publish) ─────────
create table if not exists public.feature_releases (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text,
  dest_help_article boolean not null default false,
  kb_article_id uuid references public.kb_articles(id) on delete set null,
  dest_release_notes boolean not null default false,
  release_note_id uuid references public.release_notes(id) on delete set null,
  dest_erp_badge boolean not null default false,          -- "New" badge inside the ERP (webhook)
  dest_announcement boolean not null default false,
  announcement_id uuid references public.announcements(id) on delete set null,
  dest_banner boolean not null default false,
  banner_id uuid references public.banners(id) on delete set null,
  dest_inapp_notification boolean not null default false, -- ERP webhook
  status public.content_status not null default 'draft',
  publish_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
