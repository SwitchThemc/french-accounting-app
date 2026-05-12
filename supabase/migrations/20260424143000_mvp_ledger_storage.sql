insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'expense-documents',
  'expense-documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "expense_documents_storage_select"
on storage.objects
for select
using (
  bucket_id = 'expense-documents'
  and public.has_company_access((storage.foldername(name))[1]::uuid)
);

create policy "expense_documents_storage_insert"
on storage.objects
for insert
with check (
  bucket_id = 'expense-documents'
  and public.has_company_write_access((storage.foldername(name))[1]::uuid)
);

create policy "expense_documents_storage_update"
on storage.objects
for update
using (
  bucket_id = 'expense-documents'
  and public.has_company_write_access((storage.foldername(name))[1]::uuid)
)
with check (
  bucket_id = 'expense-documents'
  and public.has_company_write_access((storage.foldername(name))[1]::uuid)
);

create or replace function public.assert_company_write_access(target_company_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_company_write_access(target_company_id) then
    raise exception 'Not allowed for company %', target_company_id;
  end if;
end;
$$;

create or replace function public.post_invoice_journal(target_invoice_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invoice_record public.invoices%rowtype;
  entry_id uuid;
  line_no integer := 1;
begin
  select *
  into invoice_record
  from public.invoices
  where id = target_invoice_id;

  if invoice_record.id is null then
    raise exception 'Invoice % not found', target_invoice_id;
  end if;

  perform public.assert_company_write_access(invoice_record.company_id);

  select id
  into entry_id
  from public.journal_entries
  where company_id = invoice_record.company_id
    and source = 'invoice'
    and source_id = invoice_record.id
  limit 1;

  if entry_id is not null then
    return entry_id;
  end if;

  insert into public.journal_entries (
    company_id,
    source,
    source_id,
    entry_date,
    status,
    reference,
    memo,
    currency_code,
    created_by
  )
  values (
    invoice_record.company_id,
    'invoice',
    invoice_record.id,
    invoice_record.issue_date,
    'draft',
    invoice_record.number,
    'Invoice posting',
    invoice_record.currency_code,
    auth.uid()
  )
  returning id into entry_id;

  insert into public.journal_lines (
    journal_entry_id,
    company_id,
    line_no,
    account_code,
    contact_id,
    description,
    debit,
    credit,
    currency_code
  )
  values (
    entry_id,
    invoice_record.company_id,
    line_no,
    '411000',
    invoice_record.contact_id,
    'Customer receivable',
    invoice_record.total_inc_vat,
    0,
    invoice_record.currency_code
  );

  line_no := line_no + 1;

  insert into public.journal_lines (
    journal_entry_id,
    company_id,
    line_no,
    account_code,
    contact_id,
    description,
    debit,
    credit,
    currency_code
  )
  select
    entry_id,
    invoice_record.company_id,
    line_no + row_number() over (order by il.sort_order) - 1,
    il.account_code,
    invoice_record.contact_id,
    il.description,
    0,
    il.line_total_ex_vat,
    invoice_record.currency_code
  from public.invoice_lines il
  where il.invoice_id = invoice_record.id
    and il.line_total_ex_vat > 0;

  select coalesce(max(jl.line_no), line_no)
  into line_no
  from public.journal_lines jl
  where jl.journal_entry_id = entry_id;

  if invoice_record.vat_total > 0 then
    insert into public.journal_lines (
      journal_entry_id,
      company_id,
      line_no,
      account_code,
      contact_id,
      description,
      debit,
      credit,
      currency_code
    )
    values (
      entry_id,
      invoice_record.company_id,
      line_no + 1,
      '445710',
      invoice_record.contact_id,
      'Collected VAT',
      0,
      invoice_record.vat_total,
      invoice_record.currency_code
    );
  end if;

  update public.journal_entries
  set status = 'posted'
  where id = entry_id;

  return entry_id;
end;
$$;

create or replace function public.post_expense_journal(target_expense_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  expense_record public.expenses%rowtype;
  entry_id uuid;
  line_no integer := 1;
begin
  select *
  into expense_record
  from public.expenses
  where id = target_expense_id;

  if expense_record.id is null then
    raise exception 'Expense % not found', target_expense_id;
  end if;

  perform public.assert_company_write_access(expense_record.company_id);

  select id
  into entry_id
  from public.journal_entries
  where company_id = expense_record.company_id
    and source = 'expense'
    and source_id = expense_record.id
  limit 1;

  if entry_id is not null then
    return entry_id;
  end if;

  insert into public.journal_entries (
    company_id,
    source,
    source_id,
    entry_date,
    status,
    reference,
    memo,
    currency_code,
    created_by
  )
  values (
    expense_record.company_id,
    'expense',
    expense_record.id,
    expense_record.expense_date,
    'draft',
    expense_record.supplier_name,
    expense_record.description,
    expense_record.currency_code,
    auth.uid()
  )
  returning id into entry_id;

  insert into public.journal_lines (
    journal_entry_id,
    company_id,
    line_no,
    account_code,
    description,
    debit,
    credit,
    currency_code
  )
  values (
    entry_id,
    expense_record.company_id,
    line_no,
    expense_record.category_account_code,
    expense_record.description,
    expense_record.total_ex_vat,
    0,
    expense_record.currency_code
  );

  line_no := line_no + 1;

  if expense_record.vat_total > 0 then
    insert into public.journal_lines (
      journal_entry_id,
      company_id,
      line_no,
      account_code,
      vat_code_id,
      description,
      debit,
      credit,
      currency_code
    )
    values (
      entry_id,
      expense_record.company_id,
      line_no,
      '445660',
      expense_record.vat_code_id,
      'Deductible VAT',
      expense_record.vat_total,
      0,
      expense_record.currency_code
    );

    line_no := line_no + 1;
  end if;

  insert into public.journal_lines (
    journal_entry_id,
    company_id,
    line_no,
    account_code,
    description,
    debit,
    credit,
    currency_code
  )
  values (
    entry_id,
    expense_record.company_id,
    line_no,
    '401000',
    'Supplier payable',
    0,
    expense_record.total_inc_vat,
    expense_record.currency_code
  );

  update public.journal_entries
  set status = 'posted'
  where id = entry_id;

  return entry_id;
end;
$$;

create or replace function public.create_expense_document(
  target_expense_id uuid,
  target_storage_path text,
  target_original_filename text default null,
  target_content_type text default null,
  target_ocr_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  expense_record public.expenses%rowtype;
  document_id uuid;
begin
  select *
  into expense_record
  from public.expenses
  where id = target_expense_id;

  if expense_record.id is null then
    raise exception 'Expense % not found', target_expense_id;
  end if;

  perform public.assert_company_write_access(expense_record.company_id);

  insert into public.expense_documents (
    expense_id,
    company_id,
    storage_path,
    original_filename,
    content_type,
    ocr_payload
  )
  values (
    expense_record.id,
    expense_record.company_id,
    target_storage_path,
    target_original_filename,
    target_content_type,
    coalesce(target_ocr_payload, '{}'::jsonb)
  )
  returning id into document_id;

  return document_id;
end;
$$;

drop view if exists public.livre_des_recettes_export;
drop view if exists public.registre_des_achats_export;

create view public.livre_des_recettes_export as
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
  i.subtotal_ex_vat as amount_ht,
  i.vat_total as vat_amount,
  i.total_inc_vat as amount_ttc,
  i.payment_method,
  i.status
from public.invoices i
left join public.contacts c on c.id = i.contact_id
where i.kind = 'invoice'
  and i.status in ('sent', 'paid', 'overdue');

create view public.registre_des_achats_export as
select
  e.company_id,
  coalesce(e.payment_date, e.expense_date) as purchase_date,
  e.supplier_name,
  e.description as nature,
  e.total_ex_vat as amount_ht,
  e.vat_total as vat_amount,
  e.total_inc_vat as amount_ttc,
  e.payment_method,
  e.status
from public.expenses e
where e.status in ('issued', 'paid', 'overdue');
