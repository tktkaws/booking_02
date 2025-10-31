-- Fill defaults for bookings: created_by and department_id from auth context
-- Run after 01_schema.sql and 02_rls.sql

begin;

create or replace function public.bookings_fill_defaults()
returns trigger
language plpgsql
security invoker
as $$
begin
  -- Ensure created_by matches current user
  if new.created_by is distinct from auth.uid() then
    new.created_by := auth.uid();
  end if;

  -- Ensure department_id matches current user's department
  if new.department_id is distinct from public.current_user_department_id() then
    new.department_id := public.current_user_department_id();
  end if;

  return new;
end
$$;

drop trigger if exists trg_bookings_fill_defaults on public.bookings;
create trigger trg_bookings_fill_defaults
before insert on public.bookings
for each row
execute function public.bookings_fill_defaults();

commit;

