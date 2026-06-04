alter table public.companies
  add column if not exists registered_address text,
  add column if not exists rcs_number text,
  add column if not exists ape_code text,
  add column if not exists activity_description text;
