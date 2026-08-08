-- 0001_enums.sql — shared enum types
-- Idempotent: safe to run more than once (e.g. via the Supabase dashboard SQL editor).

do $$ begin
  create type public.content_status as enum ('draft','scheduled','published','archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.user_role as enum ('marketing_editor','publisher','administrator');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.announcement_kind as enum
    ('information','new_feature','product_launch','celebration',
     'holiday_wishes','offer','maintenance','alert');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.kb_kind as enum
    ('user_guide','faq','release_note','troubleshooting',
     'feature_documentation','video_tutorial','tips_and_tricks','api_documentation');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.difficulty as enum ('beginner','intermediate','advanced');
exception when duplicate_object then null; end $$;
