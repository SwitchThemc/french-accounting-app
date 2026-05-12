create table if not exists public.invoice_documents (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  storage_bucket text not null default 'invoice-documents',
  storage_path text not null,
  original_filename text,
  content_type text,
  ocr_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists invoice_documents_invoice_idx on public.invoice_documents (invoice_id);

alter table public.invoice_documents enable row level security;

drop policy if exists "invoice_documents_member_access" on public.invoice_documents;
create policy "invoice_documents_member_access"
on public.invoice_documents
for all
using (public.has_company_access(company_id))
with check (public.has_company_write_access(company_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'invoice-documents',
  'invoice-documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "invoice_documents_storage_select"
on storage.objects
for select
using (
  bucket_id = 'invoice-documents'
  and public.has_company_access((storage.foldername(name))[1]::uuid)
);

create policy "invoice_documents_storage_insert"
on storage.objects
for insert
with check (
  bucket_id = 'invoice-documents'
  and public.has_company_write_access((storage.foldername(name))[1]::uuid)
);

create policy "invoice_documents_storage_update"
on storage.objects
for update
using (
  bucket_id = 'invoice-documents'
  and public.has_company_write_access((storage.foldername(name))[1]::uuid)
)
with check (
  bucket_id = 'invoice-documents'
  and public.has_company_write_access((storage.foldername(name))[1]::uuid)
);

create or replace function public.create_invoice_document(
  target_invoice_id uuid,
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
  invoice_record public.invoices%rowtype;
  document_id uuid;
begin
  select *
  into invoice_record
  from public.invoices
  where id = target_invoice_id;

  if invoice_record.id is null then
    raise exception 'Invoice % not found', target_invoice_id;
  end if;

  perform public.assert_company_write_access(invoice_record.company_id);

  insert into public.invoice_documents (
    invoice_id,
    company_id,
    storage_path,
    original_filename,
    content_type,
    ocr_payload
  )
  values (
    invoice_record.id,
    invoice_record.company_id,
    target_storage_path,
    target_original_filename,
    target_content_type,
    coalesce(target_ocr_payload, '{}'::jsonb)
  )
  returning id into document_id;

  return document_id;
end;
$$;
