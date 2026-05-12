create or replace function public.has_company_admin_access(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_members cm
    where cm.company_id = target_company_id
      and cm.user_id = auth.uid()
      and cm.role in ('owner', 'admin')
  )
$$;

create or replace function public.has_company_owner_access(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_members cm
    where cm.company_id = target_company_id
      and cm.user_id = auth.uid()
      and cm.role = 'owner'
  )
$$;

drop policy if exists "company_invites_member_access" on public.company_invites;
drop policy if exists "company_invites_select_member" on public.company_invites;
drop policy if exists "company_invites_insert_admin" on public.company_invites;
drop policy if exists "company_invites_update_admin" on public.company_invites;
drop policy if exists "company_invites_delete_admin" on public.company_invites;

create policy "company_invites_select_member"
on public.company_invites
for select
using (public.has_company_access(company_id));

create policy "company_invites_insert_admin"
on public.company_invites
for insert
with check (public.has_company_admin_access(company_id));

create policy "company_invites_update_admin"
on public.company_invites
for update
using (public.has_company_admin_access(company_id))
with check (public.has_company_admin_access(company_id));

create policy "company_invites_delete_admin"
on public.company_invites
for delete
using (public.has_company_admin_access(company_id));

drop policy if exists "company_members_manage_admin" on public.company_members;

create policy "company_members_manage_admin"
on public.company_members
for all
using (public.has_company_admin_access(company_id))
with check (public.has_company_admin_access(company_id));

drop policy if exists "companies_update_admin" on public.companies;

create policy "companies_update_admin"
on public.companies
for update
using (public.has_company_admin_access(id))
with check (public.has_company_admin_access(id));

drop policy if exists "approval_requests_member_access" on public.approval_requests;
drop policy if exists "approval_requests_select_member" on public.approval_requests;
drop policy if exists "approval_requests_insert_writer" on public.approval_requests;
drop policy if exists "approval_requests_update_admin" on public.approval_requests;
drop policy if exists "approval_requests_delete_admin" on public.approval_requests;

create policy "approval_requests_select_member"
on public.approval_requests
for select
using (public.has_company_access(company_id));

create policy "approval_requests_insert_writer"
on public.approval_requests
for insert
with check (public.has_company_write_access(company_id));

create policy "approval_requests_update_admin"
on public.approval_requests
for update
using (public.has_company_admin_access(company_id))
with check (public.has_company_admin_access(company_id));

create policy "approval_requests_delete_admin"
on public.approval_requests
for delete
using (public.has_company_admin_access(company_id));

create or replace function public.decide_approval_request(
  target_approval_id uuid,
  decision public.approval_status,
  notes text default null
)
returns public.approval_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  approval_record public.approval_requests%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if decision not in ('approved', 'rejected', 'cancelled') then
    raise exception 'Invalid approval decision';
  end if;

  select *
  into approval_record
  from public.approval_requests
  where id = target_approval_id
  for update;

  if approval_record.id is null then
    raise exception 'Approval request not found';
  end if;

  if not public.has_company_admin_access(approval_record.company_id) then
    raise exception 'Only owners and admins can decide approvals';
  end if;

  if approval_record.status <> 'pending' then
    raise exception 'Only pending approvals can be decided';
  end if;

  update public.approval_requests
  set
    status = decision,
    decided_by = auth.uid(),
    decided_at = timezone('utc', now()),
    decision_notes = nullif(notes, '')
  where id = target_approval_id
  returning * into approval_record;

  return approval_record;
end;
$$;
