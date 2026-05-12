create table if not exists public.grant_funding_projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  external_source text not null default 'release_manager',
  external_application_id text not null,
  owner_email text not null,
  artist_name text,
  project_name text not null,
  project_type text not null,
  grant_program_name text,
  grant_program_code text,
  funding_body_name text,
  funding_body_type text,
  official_url text,
  project_budget numeric(12,2) not null default 0,
  requested_amount numeric(12,2),
  expected_amount_low numeric(12,2),
  expected_amount_high numeric(12,2),
  status text not null default 'draft',
  source_url text,
  synced_payload jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (external_source, external_application_id)
);

create index if not exists grant_funding_projects_company_status_idx
on public.grant_funding_projects (company_id, status, synced_at desc);

create trigger grant_funding_projects_set_updated_at
before update on public.grant_funding_projects
for each row execute function public.set_updated_at();

alter table public.grant_funding_projects enable row level security;

drop policy if exists "grant_funding_projects_member_access" on public.grant_funding_projects;
create policy "grant_funding_projects_member_access"
on public.grant_funding_projects
for all
using (public.has_company_access(company_id))
with check (public.has_company_write_access(company_id));

create or replace function public.default_company_id_for_email(target_email text)
returns uuid
language sql
security definer
set search_path = public, auth
as $$
  select cm.company_id
  from auth.users u
  join public.company_members cm on cm.user_id = u.id
  where lower(u.email) = lower(target_email)
  order by cm.is_default_company desc, cm.created_at asc
  limit 1
$$;

revoke all on function public.default_company_id_for_email(text) from public;
grant execute on function public.default_company_id_for_email(text) to service_role;

create or replace function public.sync_release_manager_grant_project(payload jsonb)
returns public.grant_funding_projects
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_owner_email text := lower(coalesce(payload->>'owner_email', ''));
  target_company_id uuid;
  result public.grant_funding_projects;
begin
  if target_owner_email <> 'switchthemc@gmail.com' then
    raise exception 'Grant sync is restricted to switchthemc@gmail.com';
  end if;

  target_company_id := public.default_company_id_for_email(target_owner_email);
  if target_company_id is null then
    raise exception 'No accounting company found for %', target_owner_email;
  end if;

  insert into public.grant_funding_projects (
    company_id,
    external_source,
    external_application_id,
    owner_email,
    artist_name,
    project_name,
    project_type,
    grant_program_name,
    grant_program_code,
    funding_body_name,
    funding_body_type,
    official_url,
    project_budget,
    requested_amount,
    expected_amount_low,
    expected_amount_high,
    status,
    source_url,
    synced_payload,
    synced_at
  )
  values (
    target_company_id,
    coalesce(payload->>'source_app', 'release_manager'),
    payload->>'external_application_id',
    target_owner_email,
    nullif(payload->>'artist_name', ''),
    coalesce(nullif(payload->>'project_name', ''), 'Untitled grant project'),
    coalesce(nullif(payload->>'project_type', ''), 'music_project'),
    payload#>>'{grant_program,name}',
    payload#>>'{grant_program,short_code}',
    payload#>>'{grant_program,body_name}',
    payload#>>'{grant_program,body_type}',
    payload#>>'{grant_program,official_url}',
    coalesce((payload->>'project_budget')::numeric, 0),
    nullif(payload->>'requested_amount', '')::numeric,
    nullif(payload->>'expected_amount_low', '')::numeric,
    nullif(payload->>'expected_amount_high', '')::numeric,
    coalesce(nullif(payload->>'status', ''), 'draft'),
    payload->>'source_url',
    payload,
    timezone('utc', now())
  )
  on conflict (external_source, external_application_id)
  do update set
    artist_name = excluded.artist_name,
    project_name = excluded.project_name,
    project_type = excluded.project_type,
    grant_program_name = excluded.grant_program_name,
    grant_program_code = excluded.grant_program_code,
    funding_body_name = excluded.funding_body_name,
    funding_body_type = excluded.funding_body_type,
    official_url = excluded.official_url,
    project_budget = excluded.project_budget,
    requested_amount = excluded.requested_amount,
    expected_amount_low = excluded.expected_amount_low,
    expected_amount_high = excluded.expected_amount_high,
    status = excluded.status,
    source_url = excluded.source_url,
    synced_payload = excluded.synced_payload,
    synced_at = excluded.synced_at
  returning * into result;

  return result;
end;
$$;

revoke all on function public.sync_release_manager_grant_project(jsonb) from public;
grant execute on function public.sync_release_manager_grant_project(jsonb) to service_role;
