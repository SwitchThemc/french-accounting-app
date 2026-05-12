insert into public.account_templates (country_code, code, label, account_class, tax_category, allow_manual_posting)
values
  ('FR', '101000', 'Capital social', 'equity', null, false),
  ('FR', '401000', 'Fournisseurs', 'liability', null, true),
  ('FR', '411000', 'Clients', 'asset', null, true),
  ('FR', '445660', 'TVA deductible sur autres biens et services', 'asset', 'vat_deductible', false),
  ('FR', '445710', 'TVA collectee', 'liability', 'vat_collected', false),
  ('FR', '445670', 'Credit de TVA a reporter', 'asset', 'vat_credit', false),
  ('FR', '512000', 'Banque', 'asset', null, true),
  ('FR', '530000', 'Caisse', 'asset', null, true),
  ('FR', '606300', 'Fournitures d entretien et petit equipement', 'expense', null, true),
  ('FR', '613200', 'Locations immobilieres', 'expense', null, true),
  ('FR', '623000', 'Publicite, publications, relations publiques', 'expense', null, true),
  ('FR', '625100', 'Voyages et deplacements', 'expense', null, true),
  ('FR', '625700', 'Receptions', 'expense', null, true),
  ('FR', '626000', 'Frais postaux et telecom', 'expense', null, true),
  ('FR', '628100', 'Cotisations', 'expense', null, true),
  ('FR', '641000', 'Remunerations du personnel', 'expense', null, true),
  ('FR', '644000', 'Remuneration du travail de l exploitant', 'expense', null, true),
  ('FR', '645000', 'Charges de securite sociale et de prevoyance', 'expense', null, true),
  ('FR', '706000', 'Prestations de services', 'revenue', null, true),
  ('FR', '707000', 'Ventes de marchandises', 'revenue', null, true),
  ('FR', '708500', 'Ports et frais accessoires factures', 'revenue', null, true)
on conflict (country_code, code) do update
set
  label = excluded.label,
  account_class = excluded.account_class,
  tax_category = excluded.tax_category,
  allow_manual_posting = excluded.allow_manual_posting;

insert into public.vat_code_templates (
  country_code,
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
values
  ('FR', 'FR_EXEMPT', 'TVA non applicable, art. 293 B du CGI', 0.00, 0.00, true, true, '445710', '445660', null),
  ('FR', 'FR_VAT_20', 'TVA 20%', 20.00, 100.00, true, true, '445710', '445660', null),
  ('FR', 'FR_VAT_10', 'TVA 10%', 10.00, 100.00, true, true, '445710', '445660', null),
  ('FR', 'FR_VAT_55', 'TVA 5.5%', 5.50, 100.00, true, true, '445710', '445660', null),
  ('FR', 'FR_VAT_21', 'TVA 2.1%', 2.10, 100.00, true, true, '445710', '445660', null),
  ('FR', 'FR_ND_RESTAURANT', 'Restaurant non deductible', 10.00, 0.00, false, true, '445710', null, '625700')
on conflict (country_code, code) do update
set
  label = excluded.label,
  rate = excluded.rate,
  deductible_percent = excluded.deductible_percent,
  applies_to_sales = excluded.applies_to_sales,
  applies_to_purchases = excluded.applies_to_purchases,
  collected_account_code = excluded.collected_account_code,
  deductible_account_code = excluded.deductible_account_code,
  nondeductible_account_code = excluded.nondeductible_account_code;
