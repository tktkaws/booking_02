-- Seed data for departments
-- Inserts are idempotent via ON CONFLICT(name) DO NOTHING

begin;

insert into public.departments (name)
values ('制作部')
on conflict (name) do nothing;

insert into public.departments (name)
values ('総務管理部')
on conflict (name) do nothing;

insert into public.departments (name)
values ('営業開発部')
on conflict (name) do nothing;

commit;

