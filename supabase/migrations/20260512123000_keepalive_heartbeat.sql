create table if not exists public.app_keepalive (
  id text primary key default 'supabase-free-plan-heartbeat',
  last_ping_at timestamptz not null default now(),
  ping_count bigint not null default 0,
  last_ping_source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.app_keepalive (id, last_ping_source)
values ('supabase-free-plan-heartbeat', 'migration')
on conflict (id) do nothing;

alter table public.app_keepalive enable row level security;

create or replace function public.keepalive_ping(source text default 'cloudflare-cron')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  heartbeat public.app_keepalive%rowtype;
begin
  update public.app_keepalive
  set
    last_ping_at = now(),
    last_ping_source = coalesce(nullif(source, ''), 'cloudflare-cron'),
    ping_count = ping_count + 1,
    updated_at = now()
  where id = 'supabase-free-plan-heartbeat'
  returning * into heartbeat;

  if heartbeat.id is null then
    insert into public.app_keepalive (id, last_ping_source, ping_count)
    values ('supabase-free-plan-heartbeat', coalesce(nullif(source, ''), 'cloudflare-cron'), 1)
    returning * into heartbeat;
  end if;

  return jsonb_build_object(
    'ok', true,
    'id', heartbeat.id,
    'last_ping_at', heartbeat.last_ping_at,
    'last_ping_source', heartbeat.last_ping_source,
    'ping_count', heartbeat.ping_count
  );
end;
$$;

revoke all on function public.keepalive_ping(text) from public;
grant execute on function public.keepalive_ping(text) to anon, authenticated;
