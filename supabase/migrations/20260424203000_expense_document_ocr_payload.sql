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
