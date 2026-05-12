alter table public.grant_funding_projects
add column if not exists accounting_locked_fields text[] not null default '{}'::text[];

alter table public.grant_funding_projects
add column if not exists accounting_updated_at timestamptz;

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
    coalesce(nullif(payload->>'project_budget', '')::numeric, 0),
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
    project_budget = case
      when 'project_budget' = any(public.grant_funding_projects.accounting_locked_fields) then public.grant_funding_projects.project_budget
      else excluded.project_budget
    end,
    requested_amount = case
      when 'requested_amount' = any(public.grant_funding_projects.accounting_locked_fields) then public.grant_funding_projects.requested_amount
      else excluded.requested_amount
    end,
    expected_amount_low = case
      when 'expected_amount_low' = any(public.grant_funding_projects.accounting_locked_fields) then public.grant_funding_projects.expected_amount_low
      else excluded.expected_amount_low
    end,
    expected_amount_high = case
      when 'expected_amount_high' = any(public.grant_funding_projects.accounting_locked_fields) then public.grant_funding_projects.expected_amount_high
      else excluded.expected_amount_high
    end,
    status = case
      when 'status' = any(public.grant_funding_projects.accounting_locked_fields) then public.grant_funding_projects.status
      else excluded.status
    end,
    source_url = excluded.source_url,
    synced_payload = excluded.synced_payload,
    synced_at = excluded.synced_at
  returning * into result;

  return result;
end;
$$;

revoke all on function public.sync_release_manager_grant_project(jsonb) from public;
grant execute on function public.sync_release_manager_grant_project(jsonb) to service_role;
