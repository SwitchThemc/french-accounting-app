create or replace function public.create_company_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  should_be_default boolean;
begin
  select not exists (
    select 1
    from public.company_members cm
    where cm.user_id = new.created_by
      and cm.is_default_company
  )
  into should_be_default;

  insert into public.company_members (company_id, user_id, role, is_default_company)
  values (new.id, new.created_by, 'owner', should_be_default)
  on conflict (company_id, user_id) do nothing;

  perform public.bootstrap_company_defaults(new.id);
  return new;
end;
$$;
