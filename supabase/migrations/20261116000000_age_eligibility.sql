-- Age eligibility (spec 2, *Age eligibility*; #90). The account's one current
-- record now covers every state (an established band, unresolved, or under 13)
-- with its source, check time and policy version; it is replaced, never kept as
-- a history. Ordinary access needs an established 13+ band: unresolved and
-- ineligible accounts keep only the restricted paths, which go through
-- private.signed_in_account() instead of the authorization gate.

-- ---------------------------------------------------------------------------
-- The record
-- ---------------------------------------------------------------------------

-- Unresolved: no sufficient evidence is on record (support may also set it).
-- A missing record reads as unresolved too. A required platform check that is
-- pending or can't be met restricts only the device that owes it, so it is
-- never recorded here.
alter table public.eligibility drop constraint eligibility_band_check;
alter table public.eligibility add constraint eligibility_band_check
  check (band in ('under-13', '13-15', '16-17', '18+', 'unresolved'));

-- The policy the decision was made under. Raised when the eligibility rules change.
create function private.eligibility_policy_version() returns integer
language sql immutable set search_path = '' as $$ select 1 $$;

-- The account's eligibility as its consumers need it: 'adult', 'teen',
-- 'unresolved' or 'ineligible'. Spec 5 (no teen or unresolved ads), spec 7 (no
-- teen or unresolved analytics opt-in, #105) and the gate below read it.
create function private.account_eligibility(p_account uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case e.band
    when '18+' then 'adult'
    when '16-17' then 'teen'
    when '13-15' then 'teen'
    when 'under-13' then 'ineligible'
    else 'unresolved'
  end
  from (select 1) one
  left join public.eligibility e on e.account_id = p_account
$$;

-- ---------------------------------------------------------------------------
-- Creating an account: the assertion carries the evidence's source
-- ---------------------------------------------------------------------------

alter table private.eligibility_assertions add column source text not null default 'declaration'
  check (source in ('declaration', 'platform-signal'));
alter table private.pending_eligibility add column source text not null default 'declaration'
  check (source in ('declaration', 'platform-signal'));

-- #84's age step, now naming where the range came from: the fallback question
-- or the platform's age signal. Under 13 still gets no assertion.
drop function public.issue_eligibility_assertion(text);
create function public.issue_eligibility_assertion(age_range text, source text default 'declaration') returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_expires timestamptz := now() + interval '10 minutes';
begin
  if age_range is null or age_range not in ('13-15', '16-17', '18+') then
    raise exception 'no eligibility assertion for this age range' using errcode = '22023';
  end if;
  if source is null or source not in ('declaration', 'platform-signal') then
    raise exception 'unknown eligibility source' using errcode = '22023';
  end if;
  insert into private.eligibility_assertions (token_hash, band, source, expires_at)
    values (extensions.digest(v_token, 'sha256'), age_range, source, v_expires);
  return jsonb_build_object('assertion', v_token, 'expires_at', v_expires);
end $$;

revoke execute on function public.issue_eligibility_assertion(text, text) from public;
grant execute on function public.issue_eligibility_assertion(text, text) to anon, authenticated;

-- #87's version (20261114000000_environment_isolation.sql), also holding the source.
create or replace function private.consume_eligibility_assertion() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_band text;
  v_source text;
begin
  if (new.raw_user_meta_data ->> 'environment') is distinct from private.environment() then
    raise exception 'environment_mismatch' using errcode = '42501';
  end if;
  update private.eligibility_assertions
    set consumed_at = now()
    where token_hash = extensions.digest(coalesce(new.raw_user_meta_data ->> 'eligibility_assertion', ''), 'sha256')
      and consumed_at is null
      and expires_at > now()
    returning band, source into v_band, v_source;
  if v_band is null then
    raise exception 'eligibility assertion required' using errcode = '42501';
  end if;
  insert into private.pending_eligibility (auth_user_id, band, source) values (new.id, v_band, v_source);
  return new;
end $$;

-- #88's version (20261115000000_email_codes.sql): the newest age answer decides
-- a pending Create's band, and now its source too.
create or replace function public.renew_pending_eligibility(address text, assertion text) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user uuid;
  v_made_by text;
  v_band text;
  v_source text;
begin
  select u.id, u.raw_user_meta_data ->> 'eligibility_assertion' into v_user, v_made_by
    from auth.users u join private.pending_eligibility p on p.auth_user_id = u.id
    where lower(u.email) = lower(btrim(address))
    for update of u;
  if v_user is null then
    return false;
  end if;
  if v_made_by = assertion then
    return true;
  end if;
  update private.eligibility_assertions
    set consumed_at = now()
    where token_hash = extensions.digest(coalesce(assertion, ''), 'sha256') and consumed_at is null and expires_at > now()
    returning band, source into v_band, v_source;
  if v_band is null then
    return false;
  end if;
  update private.pending_eligibility set band = v_band, source = v_source where auth_user_id = v_user;
  update auth.users set raw_user_meta_data = raw_user_meta_data || jsonb_build_object('eligibility_assertion', assertion) where id = v_user;
  return true;
end $$;

-- #84's version (20261113000000_account_authority.sql), recording the held source.
create or replace function private.open_account_when_confirmed() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_band text;
  v_source text;
  v_account uuid;
begin
  if new.email_confirmed_at is null or (tg_op = 'UPDATE' and old.email_confirmed_at is not null) then
    return null;
  end if;
  delete from private.pending_eligibility where auth_user_id = new.id returning band, source into v_band, v_source;
  if v_band is null then
    return null;
  end if;
  insert into public.accounts (auth_user_id) values (new.id) returning account_id into v_account;
  insert into public.eligibility (account_id, band, source, checked_at, policy_version)
    values (v_account, v_band, v_source, now(), private.eligibility_policy_version());
  return null;
end $$;

-- ---------------------------------------------------------------------------
-- The gates
-- ---------------------------------------------------------------------------

-- The caller's account when it is active, the session in the caller's JWT has
-- not been revoked, and both belong to this environment, whatever its
-- eligibility: the restricted paths (eligibility, deletion, export, support)
-- and lifecycle answers. #87's authorization gate, unchanged, under a new name.
create function private.signed_in_account() returns uuid
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

grant execute on function private.signed_in_account() to authenticated;

-- The authorization gate for ordinary access, now also requiring established
-- 13+ eligibility. RLS, storage policies and every sync operation go through
-- it, so an unresolved or ineligible account is denied all of them.
create or replace function private.active_account() returns uuid
language sql stable security definer set search_path = '' as $$
  select account_id from (select private.signed_in_account() as account_id) signed_in
  where account_id is not null and private.account_eligibility(account_id) in ('adult', 'teen')
$$;

-- #84's version: the signed-in account and its current record, whatever its
-- eligibility, so a restricted account learns its state. 'unresolved' when no
-- record exists.
create or replace function public.current_account() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'account_id', a.account_id,
    'eligibility', coalesce(e.band, 'unresolved'),
    'source', coalesce(e.source, 'declaration'))
  from public.accounts a
  left join public.eligibility e on e.account_id = a.account_id
  where a.account_id = private.signed_in_account()
$$;

-- ---------------------------------------------------------------------------
-- Recording a new decision
-- ---------------------------------------------------------------------------

-- A device reports the range a platform age signal established
-- ('platform-signal': a band or under 13), or the fallback answer
-- ('declaration'). It replaces the one current record. A declaration is
-- accepted only while nothing sufficient is on record (no record, or
-- unresolved without a platform signal), so it never overrides a platform's
-- answer, and nothing ever promotes a band by itself. No report raises an
-- under-13 record: that goes to manual support review (#42). Returns the
-- current record and whether this report replaced it. Raw platform responses
-- never reach the server.
--
-- A platform signal can't be verified here (the platforms answer on the
-- device only), so a modified client could report a false range, as with any
-- device-authoritative input (#16); only the under-13 rule is enforced on it.
create function public.record_eligibility_v1(band text, source text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_account uuid := private.signed_in_account();
  v_current public.eligibility;
  v_accepted boolean;
begin
  if v_account is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if source is null or source not in ('declaration', 'platform-signal')
    or band is null or band not in ('under-13', '13-15', '16-17', '18+') then
    raise exception 'malformed eligibility report' using errcode = '22023';
  end if;
  -- One decision at a time per account.
  perform 1 from public.accounts where account_id = v_account for update;
  select * into v_current from public.eligibility e where e.account_id = v_account;
  v_accepted := v_current.account_id is null
    or (v_current.band is distinct from 'under-13' and source = 'platform-signal')
    or (v_current.band = 'unresolved' and v_current.source = 'declaration');
  if v_accepted then
    insert into public.eligibility as e (account_id, band, source, checked_at, policy_version)
      values (v_account, band, source, now(), private.eligibility_policy_version())
      on conflict (account_id) do update
        set band = excluded.band, source = excluded.source, checked_at = excluded.checked_at, policy_version = excluded.policy_version;
  end if;
  return (
    select jsonb_build_object('accepted', v_accepted, 'eligibility', coalesce(e.band, 'unresolved'), 'source', coalesce(e.source, 'declaration'))
    from (select 1) one left join public.eligibility e on e.account_id = v_account
  );
end $$;

revoke execute on function public.record_eligibility_v1(text, text) from public, anon;
grant execute on function public.record_eligibility_v1(text, text) to authenticated;
