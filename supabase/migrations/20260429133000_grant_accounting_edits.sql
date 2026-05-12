alter table public.grant_funding_projects
add column if not exists accounting_notes text;

alter table public.grant_funding_projects
add column if not exists pricing_decision text;
