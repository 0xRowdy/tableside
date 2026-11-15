-- Environment isolation (spec 2 Amendment 1 A2, #87): beta and production are
-- separate projects, and each refuses what belongs to another environment.
-- Every API request names its environment, every access token carries the
-- environment that issued it, and every account is stamped with the
-- environment it was created in. A mismatch anywhere is refused, so neither a
-- client-side flag nor a token from another project (or a restore of another
-- environment's data) is enough to reach an account.

-- ---------------------------------------------------------------------------
-- This project's environment
-- ---------------------------------------------------------------------------

-- Set once when a project is provisioned (docs/environments.md), and by the
-- seed on a local stack. Without it, every request is refused.
create table private.deployment (
  singleton boolean primary key default true check (singleton),
  environment text not null check (environment in ('local', 'beta', 'production'))
);

create function private.environment() returns text
language sql stable security definer set search_path = '' as $$
  select environment from private.deployment
$$;

revoke execute on function private.environment() from public;
grant execute on function private.environment() to anon, authenticated, service_role, supabase_auth_admin;

-- ---------------------------------------------------------------------------
-- Requests: every API request names its environment
-- ---------------------------------------------------------------------------

-- PostgREST's pre-request hook: runs before every table, view and function
-- request, for every role. A request naming another environment, or none, is
-- refused with 403 before anything else runs.
create function private.check_request_environment() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if (nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-tableside-environment') is distinct from private.environment()
    or private.environment() is null then
    raise exception 'environment_mismatch' using errcode = 'PT403';
  end if;
end $$;

-- The hook runs as the request's role, so every API role needs the schema.
-- Nothing else in it is reachable: each function revokes execute from public,
-- and so does every function created here from now on.
alter default privileges in schema private revoke execute on functions from public;
grant usage on schema private to anon, service_role;
revoke execute on function private.check_request_environment() from public;
grant execute on function private.check_request_environment() to anon, authenticated, service_role;

alter role authenticator set pgrst.db_pre_request to 'private.check_request_environment';
notify pgrst, 'reload config';

-- ---------------------------------------------------------------------------
-- Tokens: every access token carries the environment that issued it
-- ---------------------------------------------------------------------------

-- Auth's custom access token hook. With no environment set, no token is issued.
create function private.custom_access_token(event jsonb) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case
    when private.environment() is null
      then jsonb_build_object('error', jsonb_build_object('http_code', 500, 'message', 'environment_not_configured'))
    else jsonb_build_object('claims', (event -> 'claims') || jsonb_build_object('environment', private.environment()))
  end
$$;

revoke execute on function private.custom_access_token(jsonb) from public;
grant execute on function private.custom_access_token(jsonb) to supabase_auth_admin;

-- ---------------------------------------------------------------------------
-- Accounts: stamped with the environment they were created in
-- ---------------------------------------------------------------------------

-- Never changed, and never null: with no environment set, no account opens.
alter table public.accounts add column environment text not null default private.environment()
  check (environment in ('local', 'beta', 'production'));

-- Sign-up must name this environment too (the client sends it with the
-- eligibility assertion). Replaces #84's version, adding that check.
create or replace function private.consume_eligibility_assertion() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_band text;
begin
  if (new.raw_user_meta_data ->> 'environment') is distinct from private.environment() then
    raise exception 'environment_mismatch' using errcode = '42501';
  end if;
  update private.eligibility_assertions
    set consumed_at = now()
    where token_hash = extensions.digest(coalesce(new.raw_user_meta_data ->> 'eligibility_assertion', ''), 'sha256')
      and consumed_at is null
      and expires_at > now()
    returning band into v_band;
  if v_band is null then
    raise exception 'eligibility assertion required' using errcode = '42501';
  end if;
  insert into private.pending_eligibility (auth_user_id, band) values (new.id, v_band);
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- The authorization gate, environment-bound
-- ---------------------------------------------------------------------------

-- #84's gate, now also requiring that the account and the caller's token both
-- belong to this project's environment. RLS, storage policies and every
-- function go through it, so storage (which has no pre-request hook) is bound
-- by the token too.
create or replace function private.active_account() returns uuid
language sql stable security definer set search_path = '' as $$
  select a.account_id
  from public.accounts a
  join auth.sessions s on s.user_id = a.auth_user_id
  where a.auth_user_id = auth.uid()
    and a.state = 'active'
    and s.id = nullif(auth.jwt() ->> 'session_id', '')::uuid
    and a.environment = private.environment()
    and auth.jwt() ->> 'environment' = private.environment()
$$;
