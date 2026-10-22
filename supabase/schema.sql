-- MLBB Draft Companion · optional cloud profile backup
-- Applied to the Supabase project referenced by SUPABASE_URL.
-- Tables are prefixed with mlbb_ so they can safely coexist with other apps.
--
-- Privacy model:
--   * The table is not directly readable or writable by anon/authenticated.
--   * Access is only through two SECURITY DEFINER functions.
--   * The sync code is a 10-character secret (32^10 possibilities).
--   * There is no list/enumerate endpoint exposed to the client.

create table if not exists public.mlbb_profiles (
  sync_code text primary key,
  profile jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mlbb_sync_code_format check (sync_code ~ '^[A-Z2-9]{5}-[A-Z2-9]{5}$'),
  constraint mlbb_profile_size check (pg_column_size(profile) <= 200000)
);

alter table public.mlbb_profiles enable row level security;

revoke all on table public.mlbb_profiles from anon, authenticated;

comment on table public.mlbb_profiles is 'Encrypted-in-transit JSON profiles for the MLBB Draft Companion. Access via RPC only.';

create or replace function public.mlbb_save_profile(p_code text, p_profile jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if upper(p_code) !~ '^[A-Z2-9]{5}-[A-Z2-9]{5}$' then
    raise exception 'Invalid sync code';
  end if;
  if p_profile is null or jsonb_typeof(p_profile) <> 'object' then
    raise exception 'Invalid profile payload';
  end if;
  if pg_column_size(p_profile) > 180000 then
    raise exception 'Profile payload is too large';
  end if;

  insert into public.mlbb_profiles (sync_code, profile, updated_at)
  values (upper(p_code), p_profile, now())
  on conflict (sync_code) do update
    set profile = excluded.profile,
        updated_at = now();
end;
$$;

create or replace function public.mlbb_get_profile(p_code text)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select profile
  from public.mlbb_profiles
  where sync_code = upper(p_code)
  limit 1;
$$;

revoke all on function public.mlbb_save_profile(text, jsonb) from public;
revoke all on function public.mlbb_get_profile(text) from public;
grant execute on function public.mlbb_save_profile(text, jsonb) to anon, authenticated;
grant execute on function public.mlbb_get_profile(text) to anon, authenticated;

comment on function public.mlbb_save_profile(text, jsonb) is 'Upsert a Draft Companion profile by secret sync code.';
comment on function public.mlbb_get_profile(text) is 'Fetch a Draft Companion profile by secret sync code.';
