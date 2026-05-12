create table if not exists public.company_roles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  description text,
  can_create_records boolean not null default false,
  can_request_approval boolean not null default false,
  can_approve boolean not null default false,
  can_manage_members boolean not null default false,
  can_manage_company boolean not null default false,
  can_view_reports boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (company_id, name)
);

create trigger company_roles_set_updated_at
before update on public.company_roles
for each row execute function public.set_updated_at();

alter table public.company_roles enable row level security;

alter table public.company_members
add column if not exists custom_role_id uuid references public.company_roles(id) on delete set null;

alter table public.company_invites
add column if not exists custom_role_id uuid references public.company_roles(id) on delete set null;

create or replace function public.has_company_permission(target_company_id uuid, permission_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_members cm
    left join public.company_roles cr
      on cr.id = cm.custom_role_id
      and cr.company_id = cm.company_id
    where cm.company_id = target_company_id
      and cm.user_id = auth.uid()
      and (
        cm.role = 'owner'
        or (
          permission_name = 'create_records'
          and (cm.role in ('admin', 'bookkeeper') or coalesce(cr.can_create_records, false))
        )
        or (
          permission_name = 'request_approval'
          and (cm.role in ('admin', 'bookkeeper') or coalesce(cr.can_request_approval, false))
        )
        or (
          permission_name = 'approve'
          and (cm.role = 'admin' or coalesce(cr.can_approve, false))
        )
        or (
          permission_name = 'manage_members'
          and (cm.role = 'admin' or coalesce(cr.can_manage_members, false))
        )
        or (
          permission_name = 'manage_company'
          and (cm.role = 'admin' or coalesce(cr.can_manage_company, false))
        )
        or (
          permission_name = 'view_reports'
          and coalesce(cr.can_view_reports, true)
        )
      )
  )
$$;

create or replace function public.has_company_write_access(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_company_permission(target_company_id, 'create_records')
$$;

create or replace function public.has_company_admin_access(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_company_permission(target_company_id, 'manage_members')
$$;

drop policy if exists "company_roles_select_member" on public.company_roles;
drop policy if exists "company_roles_insert_admin" on public.company_roles;
drop policy if exists "company_roles_update_admin" on public.company_roles;
drop policy if exists "company_roles_delete_admin" on public.company_roles;
drop policy if exists "company_invites_insert_admin" on public.company_invites;
drop policy if exists "company_invites_update_admin" on public.company_invites;
drop policy if exists "company_invites_delete_admin" on public.company_invites;
drop policy if exists "company_members_manage_admin" on public.company_members;
drop policy if exists "companies_update_admin" on public.companies;
drop policy if exists "approval_requests_update_admin" on public.approval_requests;
drop policy if exists "approval_requests_delete_admin" on public.approval_requests;

create policy "company_roles_select_member"
on public.company_roles
for select
using (public.has_company_access(company_id));

create policy "company_roles_insert_admin"
on public.company_roles
for insert
with check (public.has_company_permission(company_id, 'manage_members'));

create policy "company_roles_update_admin"
on public.company_roles
for update
using (public.has_company_permission(company_id, 'manage_members'))
with check (public.has_company_permission(company_id, 'manage_members'));

create policy "company_roles_delete_admin"
on public.company_roles
for delete
using (public.has_company_permission(company_id, 'manage_members'));

create policy "company_invites_insert_admin"
on public.company_invites
for insert
with check (public.has_company_permission(company_id, 'manage_members'));

create policy "company_invites_update_admin"
on public.company_invites
for update
using (public.has_company_permission(company_id, 'manage_members'))
with check (public.has_company_permission(company_id, 'manage_members'));

create policy "company_invites_delete_admin"
on public.company_invites
for delete
using (public.has_company_permission(company_id, 'manage_members'));

create policy "company_members_manage_admin"
on public.company_members
for all
using (public.has_company_permission(company_id, 'manage_members'))
with check (public.has_company_permission(company_id, 'manage_members'));

create policy "companies_update_admin"
on public.companies
for update
using (public.has_company_permission(id, 'manage_company'))
with check (public.has_company_permission(id, 'manage_company'));

create policy "approval_requests_update_admin"
on public.approval_requests
for update
using (public.has_company_permission(company_id, 'approve'))
with check (public.has_company_permission(company_id, 'approve'));

create policy "approval_requests_delete_admin"
on public.approval_requests
for delete
using (public.has_company_permission(company_id, 'approve'));

create or replace function public.accept_company_invite(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_record public.company_invites%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select *
  into invite_record
  from public.company_invites
  where token = invite_token
    and status = 'pending'
    and expires_at > timezone('utc', now())
  limit 1;

  if invite_record.id is null then
    raise exception 'Invite not found or expired';
  end if;

  insert into public.company_members (company_id, user_id, role, custom_role_id, is_default_company)
  values (invite_record.company_id, auth.uid(), invite_record.role, invite_record.custom_role_id, false)
  on conflict (company_id, user_id) do update
  set
    role = excluded.role,
    custom_role_id = excluded.custom_role_id;

  update public.company_invites
  set
    status = 'accepted',
    accepted_by = auth.uid(),
    accepted_at = timezone('utc', now())
  where id = invite_record.id;

  return invite_record.company_id;
end;
$$;

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

  if not public.has_company_permission(approval_record.company_id, 'approve') then
    raise exception 'This role cannot decide approvals';
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
