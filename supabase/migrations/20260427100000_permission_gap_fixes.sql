drop policy if exists "approval_requests_insert_writer" on public.approval_requests;

create policy "approval_requests_insert_writer"
on public.approval_requests
for insert
with check (public.has_company_permission(company_id, 'request_approval'));

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
where public.has_company_permission(aa.company_id, 'view_reports')
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
