-- RLS policies based on 開発計画

begin;

-- Helper functions
create or replace function public.current_user_is_admin()
returns boolean language sql stable as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid() and deleted_at is null), false);
$$;

create or replace function public.current_user_department_id()
returns uuid language sql stable as $$
  select (select department_id from public.profiles where id = auth.uid() and deleted_at is null);
$$;

-- Enable RLS
alter table public.bookings enable row level security;
alter table public.profiles enable row level security;
alter table public.departments enable row level security;
alter table public.settings enable row level security;

-- Bookings
drop policy if exists bookings_select_public on public.bookings;
create policy bookings_select_public on public.bookings
for select
to public
using (true); -- 匿名含む全員が閲覧可能

drop policy if exists bookings_insert_same_department on public.bookings;
create policy bookings_insert_same_department on public.bookings
for insert
to authenticated
with check (
  auth.uid() = created_by
  and department_id is not distinct from public.current_user_department_id()
);

drop policy if exists bookings_update_admin_or_same_dept on public.bookings;
create policy bookings_update_admin_or_same_dept on public.bookings
for update
to authenticated
using (
  public.current_user_is_admin() or
  department_id is not distinct from public.current_user_department_id()
)
with check (
  public.current_user_is_admin() or
  department_id is not distinct from public.current_user_department_id()
);

drop policy if exists bookings_delete_admin_or_same_dept on public.bookings;
create policy bookings_delete_admin_or_same_dept on public.bookings
for delete
to authenticated
using (
  public.current_user_is_admin() or
  department_id is not distinct from public.current_user_department_id()
);

-- Profiles
drop policy if exists profiles_select_public on public.profiles;
create policy profiles_select_public on public.profiles
for select
to public
using (true);

-- 自分の行の INSERT を許可（is_admin は false のまま）
drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
for insert
to authenticated
with check (auth.uid() = id and is_admin = false);

-- 一般ユーザーの自己更新（is_admin を変更不可に制限: 新しい行で false 固定）
drop policy if exists profiles_update_self_nonadmin_fields on public.profiles;
create policy profiles_update_self_nonadmin_fields on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id and is_admin = false);

-- 管理者の更新/削除
drop policy if exists profiles_update_by_admin on public.profiles;
create policy profiles_update_by_admin on public.profiles
for update
to authenticated
using (public.current_user_is_admin())
with check (true);

drop policy if exists profiles_delete_by_admin on public.profiles;
create policy profiles_delete_by_admin on public.profiles
for delete
to authenticated
using (public.current_user_is_admin());

-- Departments: 読み取りは全員、書き込みは管理者のみ
drop policy if exists departments_select_public on public.departments;
create policy departments_select_public on public.departments
for select
to public
using (true);

drop policy if exists departments_admin_write on public.departments;
create policy departments_admin_write on public.departments
for all
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

-- Settings: 読み取りは全員、更新は管理者
drop policy if exists settings_select_public on public.settings;
create policy settings_select_public on public.settings
for select
to public
using (true);

drop policy if exists settings_admin_write on public.settings;
create policy settings_admin_write on public.settings
for all
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

commit;
