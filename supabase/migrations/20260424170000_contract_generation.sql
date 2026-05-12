create type public.contract_status as enum ('draft', 'finalized', 'signed', 'cancelled');
create type public.contract_compliance_status as enum ('pending', 'verified', 'needs_review', 'non_compliant');

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  contact_id uuid references public.contacts(id),
  title text not null,
  contract_type text not null check (
    contract_type in (
      'artist_booking',
      'video_production_assistant',
      'event_organizing',
      'venue_rental',
      'equipment_rental',
      'service_agreement'
    )
  ),
  status public.contract_status not null default 'draft',
  country text not null default 'France',
  language text not null default 'en',
  party_a_name text not null,
  party_a_address text,
  party_a_email text,
  party_b_name text not null,
  party_b_address text,
  party_b_email text,
  start_date date,
  end_date date,
  fee_amount numeric(18,2) not null default 0,
  fee_currency text not null default 'EUR',
  payment_terms text,
  deliverables text not null,
  special_terms text,
  generated_content text not null,
  compliance_status public.contract_compliance_status not null default 'needs_review',
  compliance_notes text,
  legal_provisions jsonb not null default '{}'::jsonb,
  source_payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index contracts_company_status_idx on public.contracts (company_id, status, created_at desc);
create index contracts_company_type_idx on public.contracts (company_id, contract_type);

create trigger contracts_set_updated_at
before update on public.contracts
for each row execute function public.set_updated_at();

alter table public.contracts enable row level security;

create policy "contracts_member_access"
on public.contracts
for all
using (public.has_company_access(company_id))
with check (public.has_company_write_access(company_id));
