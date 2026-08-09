-- 0013_neon.sql — standalone auth sessions + in-DB media blobs (Neon adaptation)
--
-- Supabase Auth's JWT sessions are replaced by an app-managed sessions table
-- (lib/auth/session.ts mints 32-byte random tokens, stored httpOnly in the
-- bf-access cookie). Supabase Storage is replaced by a bytea blob table
-- served at /media/[...path] (lib/storage.ts).

-- ── sessions ────────────────────────────────────────────────────────────────
create table if not exists public.sessions (
  token text primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists sessions_user_idx    on public.sessions (user_id);
create index if not exists sessions_expires_idx on public.sessions (expires_at);

-- Garbage-collect expired sessions opportunistically (called by the cron).
create or replace function public.purge_expired_sessions()
returns int
language sql
as $$
  delete from public.sessions where expires_at <= now()
  returning 1;
$$;

-- ── media_files (bytea blobs; path mirrors the old storage_path) ────────────
create table if not exists public.media_files (
  path text primary key,          -- e.g. misc/2026/08/hero-768w.webp
  data bytea not null,
  mime text not null,
  created_at timestamptz not null default now()
);

-- RLS (defense-in-depth; the app connects as owner and bypasses it)
alter table public.sessions   enable row level security;
alter table public.media_files enable row level security;

drop policy if exists media_files_public_read on public.media_files;
create policy media_files_public_read on public.media_files
  for select to anon using (true);

drop policy if exists sessions_self on public.sessions;
create policy sessions_self on public.sessions
  for select to authenticated using (user_id = auth.uid());

grant select on public.media_files to anon, authenticated;
grant select on public.sessions to authenticated;
