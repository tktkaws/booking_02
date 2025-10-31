-- Schema: tables, constraints, indexes, views
-- Base: __docs/schema.md + 開発計画の要件（非重複・15分単位など）

begin;

-- Extensions required
create extension if not exists pgcrypto; -- for gen_random_uuid()

-- Departments
create table if not exists public.departments (
  id             uuid primary key default gen_random_uuid(),
  name           text not null unique,
  default_color  text not null default '#64748b'::text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Profiles
create table if not exists public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  display_name   text not null,
  department_id  uuid not null references public.departments(id) on delete restrict,
  color_settings jsonb not null default '{}'::jsonb,
  is_admin       boolean not null default false,
  deleted_at     timestamptz null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Bookings
-- 備考: RLS方針（部署ベース）に合わせるため、schema.mdに明示のない department_id を追加しています。
create table if not exists public.bookings (
  id              bigint generated always as identity primary key,
  title           text not null,
  description     text not null default ''::text,
  start_at        timestamptz not null,
  end_at          timestamptz not null,
  created_by      uuid not null references auth.users (id) on delete restrict,
  department_id   uuid not null references public.departments(id) on delete restrict,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  is_companywide  boolean not null default false,
  -- 予約の重複禁止用の生成列（半開区間）
  time_range      tstzrange generated always as (tstzrange(start_at, end_at, '[)')) stored,
  constraint bookings_end_after_start check (end_at > start_at),
  constraint bookings_15min_increment check (
    (extract(minute from start_at)::int % 15 = 0) and extract(second from start_at) = 0 and
    (extract(minute from end_at)::int % 15 = 0) and extract(second from end_at) = 0
  )
);

-- 非重複制約（同一会議室前提の全体での重複禁止）
alter table public.bookings
  add constraint bookings_no_overlap exclude using gist (time_range with &&);

-- Settings（シンプルな任意設定。必要に応じてPK追加可）
create table if not exists public.settings (
  company_color text null
);

-- Indexes
create index if not exists idx_profiles_department on public.profiles(department_id);
create index if not exists idx_profiles_is_admin on public.profiles(is_admin);
create index if not exists idx_bookings_created_by on public.bookings(created_by);
create index if not exists idx_bookings_department on public.bookings(department_id);
create index if not exists idx_bookings_start_at on public.bookings(start_at);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end$$;

drop trigger if exists trg_departments_set_updated_at on public.departments;
create trigger trg_departments_set_updated_at
before update on public.departments
for each row execute function public.set_updated_at();

drop trigger if exists trg_profiles_set_updated_at on public.profiles;
create trigger trg_profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_bookings_set_updated_at on public.bookings;
create trigger trg_bookings_set_updated_at
before update on public.bookings
for each row execute function public.set_updated_at();

-- Public View: profiles_public
create or replace view public.profiles_public as
select
  p.id,
  p.display_name,
  p.department_id,
  d.name as department_name,
  p.color_settings
from public.profiles p
join public.departments d on d.id = p.department_id
where p.deleted_at is null;

commit;
