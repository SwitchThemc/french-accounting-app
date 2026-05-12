create type public.invite_status as enum ('pending', 'accepted', 'revoked', 'expired');
create type public.approval_status as enum ('pending', 'approved', 'rejected', 'cancelled');

create table public.company_invites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  email text not null,
  role public.company_role not null default 'viewer',
  token text not null unique default encode(gen_random_bytes(18), 'hex'),
  status public.invite_status not null default 'pending',
  invited_by uuid references auth.users(id),
  accepted_by uuid references auth.users(id),
  accepted_at timestamptz,
  expires_at timestamptz not null default timezone('utc', now()) + interval '14 days',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index company_invites_company_idx on public.company_invites (company_id, status, created_at desc);

create trigger company_invites_set_updated_at
before update on public.company_invites
for each row execute function public.set_updated_at();

alter table public.company_invites enable row level security;

create policy "company_invites_member_access"
on public.company_invites
for all
using (public.has_company_access(company_id))
with check (public.has_company_write_access(company_id));

create table public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  kind text not null check (kind in ('contract', 'invoice', 'expense', 'company_change', 'other')),
  target_table text,
  target_id uuid,
  title text not null,
  details text,
  status public.approval_status not null default 'pending',
  requested_by uuid references auth.users(id),
  decided_by uuid references auth.users(id),
  decided_at timestamptz,
  decision_notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index approval_requests_company_idx on public.approval_requests (company_id, status, created_at desc);

create trigger approval_requests_set_updated_at
before update on public.approval_requests
for each row execute function public.set_updated_at();

alter table public.approval_requests enable row level security;

create policy "approval_requests_member_access"
on public.approval_requests
for all
using (public.has_company_access(company_id))
with check (public.has_company_write_access(company_id));

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

  insert into public.company_members (company_id, user_id, role, is_default_company)
  values (invite_record.company_id, auth.uid(), invite_record.role, false)
  on conflict (company_id, user_id) do update
  set role = excluded.role;

  update public.company_invites
  set
    status = 'accepted',
    accepted_by = auth.uid(),
    accepted_at = timezone('utc', now())
  where id = invite_record.id;

  return invite_record.company_id;
end;
$$;
