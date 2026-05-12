alter table public.contracts
drop constraint if exists contracts_contract_type_check;

alter table public.contracts
add constraint contracts_contract_type_check
check (
  contract_type in (
    'artist_booking',
    'video_production_assistant',
    'event_organizing',
    'venue_rental',
    'equipment_rental',
    'service_agreement',
    'nda',
    'consulting_agreement',
    'licensing_agreement',
    'sponsorship_agreement',
    'partnership_agreement',
    'influencer_agreement',
    'work_for_hire',
    'commission_agreement',
    'distribution_agreement',
    'custom_agreement'
  )
);
