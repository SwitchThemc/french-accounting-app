create extension if not exists pgcrypto;

create type public.company_role as enum ('owner', 'admin', 'bookkeeper', 'viewer');
create type public.fiscal_regime as enum ('micro_bnc', 'micro_bic', 'reel_simplifie', 'reel_normal', 'sasu_is');
create type public.vat_liability_mode as enum ('exempt', 'vat_registered');
create type public.contact_kind as enum ('customer', 'supplier', 'both');
create type public.document_status as enum ('draft', 'issued', 'sent', 'paid', 'overdue', 'cancelled');
create type public.invoice_kind as enum ('invoice', 'credit_note', 'quote');
create type public.journal_entry_status as enum ('draft', 'posted', 'reversed');
create type public.journal_source as enum ('invoice', 'expense', 'bank_transaction', 'manual_adjustment', 'vat_return', 'opening_balance');
create type public.bank_provider as enum ('manual', 'bridge', 'budget_insight', 'tink', 'other');
create type public.reconciliation_match_status as enum ('suggested', 'confirmed', 'rejected');
create type public.tax_period_kind as enum ('urssaf_turnover', 'vat_return', 'year_end');
create type public.tax_period_status as enum ('open', 'draft', 'filed', 'paid');
create type public.payment_method as enum ('card', 'bank_transfer', 'cash', 'check', 'direct_debit', 'other');
create type public.account_class as enum ('asset', 'liability', 'equity', 'revenue', 'expense', 'off_balance');
create type public.export_kind as enum ('livre_recettes', 'registre_achats', 'fec', 'vat_summary', 'profit_and_loss', 'balance_sheet');
create type public.export_status as enum ('queued', 'ready', 'failed');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.prevent_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Hard deletes are disabled for %', tg_table_name;
end;
$$;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  locale text not null default 'fr-FR',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_form text,
  country_code text not null default 'FR' check (char_length(country_code) = 2),
  base_currency text not null default 'EUR' check (char_length(base_currency) = 3),
  fiscal_regime public.fiscal_regime not null,
  vat_liability_mode public.vat_liability_mode not null default 'exempt',
  invoice_prefix text not null default 'INV',
  fiscal_year_start_month smallint not null default 1 check (fiscal_year_start_month between 1 and 12),
  siret text,
  vat_number text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger companies_set_updated_at
before update on public.companies
for each row execute function public.set_updated_at();

create table public.company_members (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.company_role not null,
  is_default_company boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (company_id, user_id)
);

create unique index company_members_default_company_per_user_idx
on public.company_members (user_id)
where is_default_company;

create table public.account_templates (
  id uuid primary key default gen_random_uuid(),
  country_code text not null check (char_length(country_code) = 2),
  code text not null,
  label text not null,
  account_class public.account_class not null,
  tax_category text,
  allow_manual_posting boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  unique (country_code, code)
);

create table public.vat_code_templates (
  id uuid primary key default gen_random_uuid(),
  country_code text not null check (char_length(country_code) = 2),
  code text not null,
  label text not null,
  rate numeric(5,2) not null check (rate >= 0 and rate <= 100),
  deductible_percent numeric(5,2) not null default 100.00 check (deductible_percent >= 0 and deductible_percent <= 100),
  applies_to_sales boolean not null default true,
  applies_to_purchases boolean not null default true,
  collected_account_code text,
  deductible_account_code text,
  nondeductible_account_code text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (country_code, code)
);

create table public.accounting_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  label text not null,
  account_class public.account_class not null,
  tax_category text,
  allow_manual_posting boolean not null default true,
  system_account boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (company_id, code)
);

create trigger accounting_accounts_set_updated_at
before update on public.accounting_accounts
for each row execute function public.set_updated_at();

create trigger accounting_accounts_prevent_delete
before delete on public.accounting_accounts
for each row execute function public.prevent_delete();

create table public.vat_codes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  label text not null,
  rate numeric(5,2) not null check (rate >= 0 and rate <= 100),
  deductible_percent numeric(5,2) not null default 100.00 check (deductible_percent >= 0 and deductible_percent <= 100),
  applies_to_sales boolean not null default true,
  applies_to_purchases boolean not null default true,
  collected_account_code text,
  deductible_account_code text,
  nondeductible_account_code text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (company_id, code),
  constraint vat_codes_collected_account_fk
    foreign key (company_id, collected_account_code)
    references public.accounting_accounts (company_id, code),
  constraint vat_codes_deductible_account_fk
    foreign key (company_id, deductible_account_code)
    references public.accounting_accounts (company_id, code),
  constraint vat_codes_nondeductible_account_fk
    foreign key (company_id, nondeductible_account_code)
    references public.accounting_accounts (company_id, code)
);

create trigger vat_codes_set_updated_at
before update on public.vat_codes
for each row execute function public.set_updated_at();

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  kind public.contact_kind not null default 'customer',
  display_name text not null,
  legal_name text,
  email text,
  phone text,
  vat_number text,
  siret text,
  payment_terms_days integer not null default 30,
  billing_address jsonb not null default '{}'::jsonb,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index contacts_company_kind_idx on public.contacts (company_id, kind);

create trigger contacts_set_updated_at
before update on public.contacts
for each row execute function public.set_updated_at();

create table public.invoice_sequences (
  company_id uuid not null references public.companies(id) on delete cascade,
  sequence_year integer not null check (sequence_year >= 2000),
  prefix text not null,
  next_value bigint not null default 1 check (next_value >= 1),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (company_id, sequence_year, prefix)
);

create trigger invoice_sequences_set_updated_at
before update on public.invoice_sequences
for each row execute function public.set_updated_at();

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  contact_id uuid references public.contacts(id),
  kind public.invoice_kind not null default 'invoice',
  status public.document_status not null default 'draft',
  issue_date date not null default current_date,
  due_date date,
  paid_at date,
  payment_method public.payment_method,
  number text,
  external_reference text,
  currency_code text not null default 'EUR' check (char_length(currency_code) = 3),
  subtotal_ex_vat numeric(18,2) not null default 0,
  vat_total numeric(18,2) not null default 0,
  total_inc_vat numeric(18,2) not null default 0,
  facturx_profile text default 'minimum',
  facturx_payload jsonb not null default '{}'::jsonb,
  legal_mentions jsonb not null default '[]'::jsonb,
  source_command text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (company_id, number)
);

create index invoices_company_status_idx on public.invoices (company_id, status, issue_date desc);

create trigger invoices_set_updated_at
before update on public.invoices
for each row execute function public.set_updated_at();

create table public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  sort_order integer not null default 1,
  description text not null,
  quantity numeric(12,3) not null default 1 check (quantity > 0),
  unit_price_ex_vat numeric(18,2) not null default 0,
  discount_rate numeric(5,2) not null default 0 check (discount_rate >= 0 and discount_rate <= 100),
  account_code text not null,
  vat_code_id uuid references public.vat_codes(id),
  vat_rate numeric(5,2) not null default 0 check (vat_rate >= 0 and vat_rate <= 100),
  line_total_ex_vat numeric(18,2) not null default 0,
  line_vat_total numeric(18,2) not null default 0,
  line_total_inc_vat numeric(18,2) not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint invoice_lines_company_account_fk
    foreign key (company_id, account_code)
    references public.accounting_accounts (company_id, code)
);

create index invoice_lines_invoice_sort_idx on public.invoice_lines (invoice_id, sort_order);

create trigger invoice_lines_set_updated_at
before update on public.invoice_lines
for each row execute function public.set_updated_at();

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  supplier_contact_id uuid references public.contacts(id),
  status public.document_status not null default 'draft',
  expense_date date not null default current_date,
  payment_date date,
  payment_method public.payment_method,
  supplier_name text not null,
  description text not null,
  currency_code text not null default 'EUR' check (char_length(currency_code) = 3),
  total_ex_vat numeric(18,2) not null default 0,
  vat_total numeric(18,2) not null default 0,
  total_inc_vat numeric(18,2) not null default 0,
  deductible_amount numeric(18,2) not null default 0,
  business_use_percent numeric(5,2) not null default 100.00 check (business_use_percent >= 0 and business_use_percent <= 100),
  vat_code_id uuid references public.vat_codes(id),
  category_account_code text not null,
  source_command text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint expenses_company_account_fk
    foreign key (company_id, category_account_code)
    references public.accounting_accounts (company_id, code)
);

create index expenses_company_status_idx on public.expenses (company_id, status, expense_date desc);

create trigger expenses_set_updated_at
before update on public.expenses
for each row execute function public.set_updated_at();

create table public.expense_documents (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  storage_bucket text not null default 'expense-documents',
  storage_path text not null,
  original_filename text,
  content_type text,
  ocr_payload jsonb not null default '{}'::jsonb,
  ai_suggestion jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index expense_documents_expense_idx on public.expense_documents (expense_id);

create table public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  provider public.bank_provider not null default 'manual',
  provider_account_id text,
  bank_name text,
  iban text,
  bic text,
  currency_code text not null default 'EUR' check (char_length(currency_code) = 3),
  last_synced_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger bank_accounts_set_updated_at
before update on public.bank_accounts
for each row execute function public.set_updated_at();

create table public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  bank_account_id uuid not null references public.bank_accounts(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  provider_transaction_id text,
  booking_date date not null,
  value_date date,
  amount numeric(18,2) not null,
  currency_code text not null default 'EUR' check (char_length(currency_code) = 3),
  direction text not null check (direction in ('in', 'out')),
  counterparty_name text,
  label text not null,
  raw_descriptor text,
  metadata jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  unique (bank_account_id, provider_transaction_id)
);

create index bank_transactions_company_booking_idx on public.bank_transactions (company_id, booking_date desc);

create table public.categorization_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  match_field text not null check (match_field in ('label', 'counterparty_name', 'raw_descriptor')),
  pattern text not null,
  priority integer not null default 100,
  target_account_code text,
  vat_code_id uuid references public.vat_codes(id),
  auto_apply boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint categorization_rules_target_account_fk
    foreign key (company_id, target_account_code)
    references public.accounting_accounts (company_id, code)
);

create index categorization_rules_company_priority_idx on public.categorization_rules (company_id, priority asc);

create trigger categorization_rules_set_updated_at
before update on public.categorization_rules
for each row execute function public.set_updated_at();

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  source public.journal_source not null,
  source_id uuid,
  entry_date date not null default current_date,
  status public.journal_entry_status not null default 'posted',
  reference text,
  memo text,
  currency_code text not null default 'EUR' check (char_length(currency_code) = 3),
  posted_at timestamptz,
  reversed_by_entry_id uuid references public.journal_entries(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index journal_entries_company_date_idx on public.journal_entries (company_id, entry_date desc);

create trigger journal_entries_set_updated_at
before update on public.journal_entries
for each row execute function public.set_updated_at();

create trigger journal_entries_prevent_delete
before delete on public.journal_entries
for each row execute function public.prevent_delete();

create table public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null references public.journal_entries(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  line_no integer not null check (line_no > 0),
  account_code text not null,
  contact_id uuid references public.contacts(id),
  vat_code_id uuid references public.vat_codes(id),
  description text,
  debit numeric(18,2) not null default 0 check (debit >= 0),
  credit numeric(18,2) not null default 0 check (credit >= 0),
  currency_code text not null default 'EUR' check (char_length(currency_code) = 3),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (journal_entry_id, line_no),
  check ((debit = 0 and credit > 0) or (credit = 0 and debit > 0)),
  constraint journal_lines_company_account_fk
    foreign key (company_id, account_code)
    references public.accounting_accounts (company_id, code)
);

create index journal_lines_entry_idx on public.journal_lines (journal_entry_id, line_no);

create trigger journal_lines_set_updated_at
before update on public.journal_lines
for each row execute function public.set_updated_at();

create trigger journal_lines_prevent_delete
before delete on public.journal_lines
for each row execute function public.prevent_delete();

create table public.reconciliation_matches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  bank_transaction_id uuid not null references public.bank_transactions(id) on delete cascade,
  invoice_id uuid references public.invoices(id),
  expense_id uuid references public.expenses(id),
  journal_entry_id uuid references public.journal_entries(id),
  status public.reconciliation_match_status not null default 'suggested',
  confidence numeric(5,4) not null default 0 check (confidence >= 0 and confidence <= 1),
  matched_amount numeric(18,2) not null,
  explanation text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (num_nonnulls(invoice_id, expense_id, journal_entry_id) >= 1)
);

create index reconciliation_matches_transaction_idx on public.reconciliation_matches (bank_transaction_id, status);

create trigger reconciliation_matches_set_updated_at
before update on public.reconciliation_matches
for each row execute function public.set_updated_at();

create table public.tax_periods (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  kind public.tax_period_kind not null,
  start_date date not null,
  end_date date not null,
  due_date date,
  status public.tax_period_status not null default 'open',
  totals jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (company_id, kind, start_date, end_date),
  check (end_date >= start_date)
);

create trigger tax_periods_set_updated_at
before update on public.tax_periods
for each row execute function public.set_updated_at();

create table public.exports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  kind public.export_kind not null,
  status public.export_status not null default 'queued',
  storage_bucket text,
  storage_path text,
  requested_by uuid references auth.users(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger exports_set_updated_at
before update on public.exports
for each row execute function public.set_updated_at();

create table public.audit_events (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  actor_user_id uuid references auth.users(id),
  entity_table text not null,
  entity_id uuid,
  action text not null,
  before_state jsonb,
  after_state jsonb,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index audit_events_company_created_idx on public.audit_events (company_id, created_at desc);

create trigger audit_events_prevent_delete
before delete on public.audit_events
for each row execute function public.prevent_delete();

create or replace function public.current_company_role(target_company_id uuid)
returns public.company_role
language sql
stable
security definer
set search_path = public
as $$
  select cm.role
  from public.company_members cm
  where cm.company_id = target_company_id
    and cm.user_id = auth.uid()
  limit 1
$$;

create or replace function public.has_company_access(target_company_id uuid)
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
  )
$$;

create or replace function public.has_company_write_access(target_company_id uuid)
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
      and cm.role in ('owner', 'admin', 'bookkeeper')
  )
$$;

create or replace function public.bootstrap_company_defaults(target_company_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_country text;
begin
  select country_code into target_country
  from public.companies
  where id = target_company_id;

  insert into public.accounting_accounts (
    company_id,
    code,
    label,
    account_class,
    tax_category,
    allow_manual_posting,
    system_account
  )
  select
    target_company_id,
    t.code,
    t.label,
    t.account_class,
    t.tax_category,
    t.allow_manual_posting,
    true
  from public.account_templates t
  where t.country_code = target_country
  on conflict (company_id, code) do nothing;

  insert into public.vat_codes (
    company_id,
    code,
    label,
    rate,
    deductible_percent,
    applies_to_sales,
    applies_to_purchases,
    collected_account_code,
    deductible_account_code,
    nondeductible_account_code
  )
  select
    target_company_id,
    t.code,
    t.label,
    t.rate,
    t.deductible_percent,
    t.applies_to_sales,
    t.applies_to_purchases,
    t.collected_account_code,
    t.deductible_account_code,
    t.nondeductible_account_code
  from public.vat_code_templates t
  where t.country_code = target_country
  on conflict (company_id, code) do nothing;
end;
$$;

create or replace function public.create_company_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.company_members (company_id, user_id, role, is_default_company)
  values (new.id, new.created_by, 'owner', true)
  on conflict (company_id, user_id) do nothing;

  perform public.bootstrap_company_defaults(new.id);
  return new;
end;
$$;

create trigger companies_after_insert_defaults
after insert on public.companies
for each row execute function public.create_company_owner_membership();

create or replace function public.next_invoice_number(target_company_id uuid, target_issue_date date default current_date)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  seq_year integer := extract(year from target_issue_date);
  seq_prefix text;
  seq_value bigint;
begin
  select coalesce(nullif(invoice_prefix, ''), 'INV')
  into seq_prefix
  from public.companies
  where id = target_company_id;

  insert into public.invoice_sequences (company_id, sequence_year, prefix, next_value)
  values (target_company_id, seq_year, seq_prefix, 1)
  on conflict do nothing;

  update public.invoice_sequences
  set next_value = next_value + 1
  where company_id = target_company_id
    and sequence_year = seq_year
    and prefix = seq_prefix
  returning next_value - 1 into seq_value;

  return format('%s-%s-%06s', seq_prefix, seq_year, seq_value);
end;
$$;

create or replace function public.assign_invoice_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.kind = 'invoice' and new.number is null then
    new.number := public.next_invoice_number(new.company_id, new.issue_date);
  end if;

  return new;
end;
$$;

create trigger invoices_assign_number
before insert on public.invoices
for each row execute function public.assign_invoice_number();

create or replace function public.compute_invoice_line_totals()
returns trigger
language plpgsql
as $$
declare
  line_base numeric(18,2);
begin
  line_base := round((new.quantity * new.unit_price_ex_vat * (1 - new.discount_rate / 100.0))::numeric, 2);
  new.line_total_ex_vat := line_base;
  new.line_vat_total := round((line_base * new.vat_rate / 100.0)::numeric, 2);
  new.line_total_inc_vat := new.line_total_ex_vat + new.line_vat_total;
  return new;
end;
$$;

create trigger invoice_lines_compute_totals
before insert or update on public.invoice_lines
for each row execute function public.compute_invoice_line_totals();

create or replace function public.refresh_invoice_totals()
returns trigger
language plpgsql
as $$
declare
  target_invoice_id uuid;
begin
  target_invoice_id := coalesce(new.invoice_id, old.invoice_id);

  update public.invoices i
  set
    subtotal_ex_vat = coalesce((
      select sum(il.line_total_ex_vat)
      from public.invoice_lines il
      where il.invoice_id = target_invoice_id
    ), 0),
    vat_total = coalesce((
      select sum(il.line_vat_total)
      from public.invoice_lines il
      where il.invoice_id = target_invoice_id
    ), 0),
    total_inc_vat = coalesce((
      select sum(il.line_total_inc_vat)
      from public.invoice_lines il
      where il.invoice_id = target_invoice_id
    ), 0),
    updated_at = timezone('utc', now())
  where i.id = target_invoice_id;

  return null;
end;
$$;

create trigger invoice_lines_refresh_invoice_totals
after insert or update or delete on public.invoice_lines
for each row execute function public.refresh_invoice_totals();

create or replace function public.enforce_posted_entry_metadata()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'posted' and new.posted_at is null then
    new.posted_at := timezone('utc', now());
  end if;

  return new;
end;
$$;

create trigger journal_entries_posted_metadata
before insert or update on public.journal_entries
for each row execute function public.enforce_posted_entry_metadata();

create or replace function public.prevent_posted_journal_entry_update()
returns trigger
language plpgsql
as $$
begin
  if old.status in ('posted', 'reversed') then
    raise exception 'Posted journal entries are immutable';
  end if;

  return new;
end;
$$;

create trigger journal_entries_prevent_posted_update
before update on public.journal_entries
for each row execute function public.prevent_posted_journal_entry_update();

create or replace function public.prevent_posted_journal_mutation()
returns trigger
language plpgsql
as $$
declare
  target_status public.journal_entry_status;
begin
  select status into target_status
  from public.journal_entries
  where id = coalesce(new.journal_entry_id, old.journal_entry_id);

  if target_status in ('posted', 'reversed') then
    raise exception 'Posted journal entries are immutable';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger journal_lines_prevent_posted_update
before update on public.journal_lines
for each row execute function public.prevent_posted_journal_mutation();

create or replace function public.validate_journal_entry_balance()
returns trigger
language plpgsql
as $$
declare
  target_entry_id uuid;
  total_debit numeric(18,2);
  total_credit numeric(18,2);
  entry_status public.journal_entry_status;
begin
  target_entry_id := coalesce(new.journal_entry_id, old.journal_entry_id, new.id, old.id);

  select status into entry_status
  from public.journal_entries
  where id = target_entry_id;

  if entry_status is distinct from 'posted' then
    return null;
  end if;

  select
    coalesce(sum(debit), 0),
    coalesce(sum(credit), 0)
  into total_debit, total_credit
  from public.journal_lines
  where journal_entry_id = target_entry_id;

  if total_debit = 0 or total_credit = 0 or total_debit <> total_credit then
    raise exception 'Journal entry % is not balanced (debit %, credit %)', target_entry_id, total_debit, total_credit;
  end if;

  return null;
end;
$$;

create constraint trigger journal_lines_balance_check
after insert or update on public.journal_lines
deferrable initially deferred
for each row execute function public.validate_journal_entry_balance();

create constraint trigger journal_entries_balance_check
after insert or update on public.journal_entries
deferrable initially deferred
for each row execute function public.validate_journal_entry_balance();

create or replace function public.capture_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_company_id uuid;
  target_entity_id uuid;
begin
  target_company_id := coalesce(new.company_id, old.company_id);
  target_entity_id := coalesce(new.id, old.id);

  insert into public.audit_events (
    company_id,
    actor_user_id,
    entity_table,
    entity_id,
    action,
    before_state,
    after_state
  )
  values (
    target_company_id,
    auth.uid(),
    tg_table_name,
    target_entity_id,
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );

  return coalesce(new, old);
end;
$$;

create trigger invoices_audit_trigger
after insert or update on public.invoices
for each row execute function public.capture_audit_event();

create trigger expenses_audit_trigger
after insert or update on public.expenses
for each row execute function public.capture_audit_event();

create trigger bank_transactions_audit_trigger
after insert or update on public.bank_transactions
for each row execute function public.capture_audit_event();

create trigger journal_entries_audit_trigger
after insert or update on public.journal_entries
for each row execute function public.capture_audit_event();

create trigger journal_lines_audit_trigger
after insert or update on public.journal_lines
for each row execute function public.capture_audit_event();

create or replace view public.livre_des_recettes_export as
select
  i.company_id,
  coalesce(i.paid_at, i.issue_date) as receipt_date,
  c.display_name as client_name,
  i.number as reference,
  coalesce((
    select string_agg(il.description, ' | ' order by il.sort_order)
    from public.invoice_lines il
    where il.invoice_id = i.id
  ), i.notes, 'Facture') as nature,
  i.total_inc_vat as amount_ttc,
  i.payment_method,
  i.status
from public.invoices i
left join public.contacts c on c.id = i.contact_id
where i.kind = 'invoice'
  and i.status in ('sent', 'paid', 'overdue');

create or replace view public.registre_des_achats_export as
select
  e.company_id,
  coalesce(e.payment_date, e.expense_date) as purchase_date,
  e.supplier_name,
  e.description as nature,
  e.total_inc_vat as amount_ttc,
  e.payment_method,
  e.status
from public.expenses e
where e.status in ('issued', 'paid', 'overdue');

create or replace view public.vat_position_by_period as
select
  tp.id as tax_period_id,
  tp.company_id,
  tp.start_date,
  tp.end_date,
  coalesce(sum(case when je.source = 'invoice' then jl.credit else 0 end), 0) as vat_collected,
  coalesce(sum(case when je.source = 'expense' then jl.debit else 0 end), 0) as vat_deductible,
  coalesce(sum(case when je.source = 'invoice' then jl.credit else 0 end), 0)
    - coalesce(sum(case when je.source = 'expense' then jl.debit else 0 end), 0) as vat_due
from public.tax_periods tp
left join public.journal_entries je
  on je.company_id = tp.company_id
  and je.entry_date between tp.start_date and tp.end_date
  and je.status = 'posted'
left join public.journal_lines jl
  on jl.journal_entry_id = je.id
left join public.accounting_accounts aa
  on aa.company_id = jl.company_id
  and aa.code = jl.account_code
  and aa.tax_category in ('vat_collected', 'vat_deductible')
where tp.kind = 'vat_return'
group by tp.id, tp.company_id, tp.start_date, tp.end_date;

alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.accounting_accounts enable row level security;
alter table public.vat_codes enable row level security;
alter table public.contacts enable row level security;
alter table public.invoice_sequences enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_documents enable row level security;
alter table public.bank_accounts enable row level security;
alter table public.bank_transactions enable row level security;
alter table public.categorization_rules enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_lines enable row level security;
alter table public.reconciliation_matches enable row level security;
alter table public.tax_periods enable row level security;
alter table public.exports enable row level security;
alter table public.audit_events enable row level security;

create policy "profiles_select_self"
on public.profiles
for select
using (user_id = auth.uid());

create policy "profiles_insert_self"
on public.profiles
for insert
with check (user_id = auth.uid());

create policy "profiles_update_self"
on public.profiles
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "companies_select_member"
on public.companies
for select
using (public.has_company_access(id));

create policy "companies_insert_owner"
on public.companies
for insert
with check (created_by = auth.uid());

create policy "companies_update_admin"
on public.companies
for update
using (public.has_company_write_access(id))
with check (public.has_company_write_access(id));

create policy "company_members_select_member"
on public.company_members
for select
using (public.has_company_access(company_id));

create policy "company_members_manage_admin"
on public.company_members
for all
using (public.has_company_write_access(company_id))
with check (public.has_company_write_access(company_id));

create policy "accounts_member_access"
on public.accounting_accounts
for all
using (public.has_company_access(company_id))
with check (public.has_company_write_access(company_id));

create policy "vat_codes_member_access"
on public.vat_codes
for all
using (public.has_company_access(company_id))
with check (public.has_company_write_access(company_id));

create policy "contacts_member_access"
on public.contacts
for all
using (public.has_company_access(company_id))
with check (public.has_company_write_access(company_id));

create policy "invoice_sequences_member_access"
on public.invoice_sequences
for all
using (public.has_company_access(company_id))
with check (public.has_company_write_access(company_id));

create policy "invoices_member_access"
on public.invoices
for all
using (public.has_company_access(company_id))
with check (public.has_company_write_access(company_id));

create policy "invoice_lines_member_access"
on public.invoice_lines
for all
using (public.has_company_access(company_id))
with check (public.has_company_write_access(company_id));

create policy "expenses_member_access"
on public.expenses
for all
using (public.has_company_access(company_id))
with check (public.has_company_write_access(company_id));

create policy "expense_documents_member_access"
on public.expense_documents
for all
using (public.has_company_access(company_id))
with check (public.has_company_write_access(company_id));

create policy "bank_accounts_member_access"
on public.bank_accounts
for all
using (public.has_company_access(company_id))
with check (public.has_company_write_access(company_id));

create policy "bank_transactions_member_access"
on public.bank_transactions
for all
using (public.has_company_access(company_id))
with check (public.has_company_write_access(company_id));

create policy "categorization_rules_member_access"
on public.categorization_rules
for all
using (public.has_company_access(company_id))
with check (public.has_company_write_access(company_id));

create policy "journal_entries_member_access"
on public.journal_entries
for all
using (public.has_company_access(company_id))
with check (public.has_company_write_access(company_id));

create policy "journal_lines_member_access"
on public.journal_lines
for all
using (public.has_company_access(company_id))
with check (public.has_company_write_access(company_id));

create policy "reconciliation_matches_member_access"
on public.reconciliation_matches
for all
using (public.has_company_access(company_id))
with check (public.has_company_write_access(company_id));

create policy "tax_periods_member_access"
on public.tax_periods
for all
using (public.has_company_access(company_id))
with check (public.has_company_write_access(company_id));

create policy "exports_member_access"
on public.exports
for all
using (public.has_company_access(company_id))
with check (public.has_company_write_access(company_id));

create policy "audit_events_member_access"
on public.audit_events
for select
using (public.has_company_access(company_id));
