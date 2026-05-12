create type public.e_invoicing_connector_kind as enum ('pdp', 'chorus_pro', 'manual_export');
create type public.e_invoicing_environment as enum ('sandbox', 'production');
create type public.e_invoice_delivery_status as enum ('draft', 'queued', 'sent', 'acknowledged', 'rejected', 'cancelled');

create table public.e_invoicing_connectors (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  kind public.e_invoicing_connector_kind not null,
  environment public.e_invoicing_environment not null default 'sandbox',
  display_name text not null,
  provider_name text,
  base_url text,
  routing_identifier text,
  is_default boolean not null default false,
  credentials_ref text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index e_invoicing_connectors_default_idx
on public.e_invoicing_connectors (company_id)
where is_default;

create trigger e_invoicing_connectors_set_updated_at
before update on public.e_invoicing_connectors
for each row execute function public.set_updated_at();

create table public.e_invoice_deliveries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  connector_id uuid references public.e_invoicing_connectors(id),
  invoice_id uuid not null references public.invoices(id),
  status public.e_invoice_delivery_status not null default 'queued',
  format text not null default 'factur-x' check (format in ('factur-x', 'ubl', 'cii', 'manual-pdf')),
  external_message_id text,
  submitted_at timestamptz,
  acknowledged_at timestamptz,
  rejected_at timestamptz,
  error_message text,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (company_id, invoice_id, connector_id, format)
);

create index e_invoice_deliveries_company_status_idx
on public.e_invoice_deliveries (company_id, status, created_at desc);

create trigger e_invoice_deliveries_set_updated_at
before update on public.e_invoice_deliveries
for each row execute function public.set_updated_at();

create table public.e_invoice_events (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  delivery_id uuid not null references public.e_invoice_deliveries(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index e_invoice_events_delivery_idx
on public.e_invoice_events (delivery_id, created_at desc);

create or replace function public.queue_e_invoice_delivery(
  target_invoice_id uuid,
  target_connector_id uuid default null,
  target_format text default 'factur-x'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invoice_record public.invoices%rowtype;
  connector_record public.e_invoicing_connectors%rowtype;
  delivery_id uuid;
begin
  select *
  into invoice_record
  from public.invoices
  where id = target_invoice_id;

  if invoice_record.id is null then
    raise exception 'Invoice % not found', target_invoice_id;
  end if;

  perform public.assert_company_write_access(invoice_record.company_id);

  if target_connector_id is null then
    select *
    into connector_record
    from public.e_invoicing_connectors
    where company_id = invoice_record.company_id
      and is_default
    limit 1;
  else
    select *
    into connector_record
    from public.e_invoicing_connectors
    where id = target_connector_id
      and company_id = invoice_record.company_id;
  end if;

  if connector_record.id is null then
    raise exception 'No e-invoicing connector configured for company %', invoice_record.company_id;
  end if;

  insert into public.e_invoice_deliveries (
    company_id,
    connector_id,
    invoice_id,
    status,
    format,
    payload,
    created_by
  )
  values (
    invoice_record.company_id,
    connector_record.id,
    invoice_record.id,
    'queued',
    target_format,
    jsonb_build_object(
      'invoice_number', invoice_record.number,
      'connector_kind', connector_record.kind,
      'provider_name', connector_record.provider_name,
      'environment', connector_record.environment
    ),
    auth.uid()
  )
  on conflict (company_id, invoice_id, connector_id, format) do update
  set
    status = 'queued',
    error_message = null,
    updated_at = timezone('utc', now())
  returning id into delivery_id;

  insert into public.e_invoice_events (company_id, delivery_id, event_type, payload)
  values (
    invoice_record.company_id,
    delivery_id,
    'queued',
    jsonb_build_object('format', target_format)
  );

  return delivery_id;
end;
$$;

create or replace view public.account_balances_report
with (security_invoker = true)
as
select
  aa.company_id,
  aa.code as account_code,
  aa.label,
  aa.account_class,
  coalesce(sum(jl.debit), 0) as debit_total,
  coalesce(sum(jl.credit), 0) as credit_total,
  case
    when aa.account_class in ('asset', 'expense') then coalesce(sum(jl.debit - jl.credit), 0)
    else coalesce(sum(jl.credit - jl.debit), 0)
  end as balance
from public.accounting_accounts aa
left join public.journal_lines jl
  on jl.company_id = aa.company_id
  and jl.account_code = aa.code
left join public.journal_entries je
  on je.id = jl.journal_entry_id
  and je.status = 'posted'
group by aa.company_id, aa.code, aa.label, aa.account_class;

create or replace view public.profit_loss_report
with (security_invoker = true)
as
select
  company_id,
  sum(case when account_class = 'revenue' then balance else 0 end) as revenue,
  sum(case when account_class = 'expense' then balance else 0 end) as expenses,
  sum(case when account_class = 'revenue' then balance else 0 end)
    - sum(case when account_class = 'expense' then balance else 0 end) as net_result
from public.account_balances_report
where account_class in ('revenue', 'expense')
group by company_id;

create or replace view public.balance_sheet_report
with (security_invoker = true)
as
with totals as (
  select
    company_id,
    sum(case when account_class = 'asset' then balance else 0 end) as assets,
    sum(case when account_class = 'liability' then balance else 0 end) as liabilities,
    sum(case when account_class = 'equity' then balance else 0 end) as equity
  from public.account_balances_report
  where account_class in ('asset', 'liability', 'equity')
  group by company_id
),
pl as (
  select company_id, net_result
  from public.profit_loss_report
)
select
  totals.company_id,
  totals.assets,
  totals.liabilities,
  totals.equity,
  coalesce(pl.net_result, 0) as current_year_result,
  totals.liabilities + totals.equity + coalesce(pl.net_result, 0) as liabilities_equity,
  totals.assets - (totals.liabilities + totals.equity + coalesce(pl.net_result, 0)) as imbalance
from totals
left join pl on pl.company_id = totals.company_id;

alter table public.e_invoicing_connectors enable row level security;
alter table public.e_invoice_deliveries enable row level security;
alter table public.e_invoice_events enable row level security;

create policy "e_invoicing_connectors_member_access"
on public.e_invoicing_connectors
for all
using (public.has_company_access(company_id))
with check (public.has_company_write_access(company_id));

create policy "e_invoice_deliveries_member_access"
on public.e_invoice_deliveries
for all
using (public.has_company_access(company_id))
with check (public.has_company_write_access(company_id));

create policy "e_invoice_events_member_select"
on public.e_invoice_events
for select
using (public.has_company_access(company_id));

create policy "e_invoice_events_member_insert"
on public.e_invoice_events
for insert
with check (public.has_company_write_access(company_id));
