-- 0002_identity.sql — profiles (1:1 with auth.users), audit log, version history

-- ── profiles ────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role public.user_role not null default 'marketing_editor',
  created_at timestamptz not null default now()
);

-- Auto-create a profile whenever a user is added in Supabase Auth
-- (Authentication → Add user, or the /api/admin/users invite endpoint).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── audit_log (append-only; written by server endpoints with the service role) ──
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,                 -- create|update|publish|unpublish|schedule|archive|delete|restore|login…
  entity text not null,                 -- banner|announcement|page|blog_post|kb_article|media|setting…
  entity_id uuid,
  summary text,
  diff jsonb,                           -- {field: [old, new]}
  ip inet,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_entity_idx on public.audit_log (entity, entity_id, created_at desc);
create index if not exists audit_log_actor_idx  on public.audit_log (actor_id, created_at desc);
create index if not exists audit_log_action_idx on public.audit_log (action, created_at desc);

-- ── content_versions (version history for pages & articles) ─────────────────
create table if not exists public.content_versions (
  id uuid primary key default gen_random_uuid(),
  entity text not null,
  entity_id uuid not null,
  version int not null,
  kind text not null default 'manual' check (kind in ('autosave','manual','publish','restore')),
  snapshot jsonb not null,              -- full row snapshot at save time
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (entity, entity_id, version)
);
create index if not exists content_versions_entity_idx
  on public.content_versions (entity, entity_id, version desc);

-- Next version number for an entity (used by save endpoints).
create or replace function public.next_version(p_entity text, p_entity_id uuid)
returns int
language sql stable
as $$
  select coalesce(max(version), 0) + 1
  from public.content_versions
  where entity = p_entity and entity_id = p_entity_id;
$$;
