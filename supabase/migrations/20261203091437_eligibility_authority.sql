-- Age eligibility the server can stand behind (spec 2, *Age eligibility*;
-- #52 review, from #90). A report's source is the client's own claim: the
-- server can't verify a platform signal (the platforms answer on the device
-- only), so it never lets a claim of either source do more than the spec
-- allows a declaration and the accepted risk (#16) allows a device's own
-- platform check:
--
-- - No report raises an established band (teen to adult, or anything from
--   under 13). A platform range may establish a band where none is (no
--   record, or unresolved), or lower one (credible younger-age information);
--   a declaration only establishes. Raising a band is support review's, with
--   its own tools (#42).
-- - A required platform check a device owes ("pending" or "can't be met") is
--   now kept on the server for that installation. While any of the account's
--   installations owes one, a declaration is refused, and so is establishing
--   a band from any other session: only the installation that owes the check
--   may resolve it, by reporting its own platform's range (a modified client
--   could report a false one: #90's accepted risk, for its own check only).
--
-- issue_eligibility_assertion stays granted to anon: the age step runs before
-- any account exists (Amendment 3 §1), and an assertion only establishes a
-- band for a new account, exactly as the fallback question does. Its source is
-- kept as a label and grants nothing: under the rules above a record's source
-- never lets a later report raise it.

-- ---------------------------------------------------------------------------
-- The required check each installation owes
-- ---------------------------------------------------------------------------

-- Null when the installation's platform requires no check. Kept with the
-- installation, so it has the installation's retention and deletion.
alter table private.installations add column age_check text check (age_check in ('pending', 'unmet'));

-- Whether any installation of the account owes a required check, other than `p_except`.
create function private.age_check_owed(p_account uuid, p_except text default null) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from private.installations i
    where i.account_id = p_account and i.age_check is not null
      and i.installation_id is distinct from p_except)
$$;

revoke execute on function private.age_check_owed(uuid, text) from public;

-- The caller's own registered installation, or null when its session hasn't registered one.
create function private.caller_installation(p_account uuid) returns text
language sql stable security definer set search_path = '' as $$
  select r.installation_id from private.account_sessions r
  where r.session_id = private.caller_session() and r.account_id = p_account and r.revoked_at is null
$$;

revoke execute on function private.caller_installation(uuid) from public;

-- A device reports the required check its platform says it owes ('pending' or
-- 'unmet'), or null once it owes none. It is no age information: it never
-- changes the account's record. Only the caller's own registered installation.
--   { status: 'recorded' } | { status: 'not-registered' }
create function public.record_age_check_v1(age_check text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_account uuid := private.signed_in_account();
  v_installation text;
begin
  if v_account is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if age_check is not null and age_check not in ('pending', 'unmet') then
    raise exception 'malformed age check' using errcode = '22023';
  end if;
  -- Serialized with the account's eligibility reports.
  perform 1 from public.accounts where account_id = v_account for update;
  v_installation := private.caller_installation(v_account);
  if v_installation is null then
    return jsonb_build_object('status', 'not-registered');
  end if;
  update private.installations i set age_check = record_age_check_v1.age_check
    where i.account_id = v_account and i.installation_id = v_installation;
  return jsonb_build_object('status', 'recorded');
end $$;

revoke execute on function public.record_age_check_v1(text) from public, anon;
grant execute on function public.record_age_check_v1(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Recording a new decision
-- ---------------------------------------------------------------------------

-- How old a band says the person is, lowest first, so "raises" can be compared.
create function private.band_rank(p_band text) returns integer
language sql immutable set search_path = '' as $$
  select case p_band when 'under-13' then 0 when '13-15' then 1 when '16-17' then 2 when '18+' then 3 end
$$;

-- #90's report, as #103 left it (20261130114217_deletion_scheduling.sql),
-- under the rules above. A platform range from the installation that owes a
-- check also clears that installation's check, in the same transaction.
create or replace function public.record_eligibility_v1(band text, source text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_account uuid := private.signed_in_account();
  v_current public.eligibility;
  v_installation text;
  v_established boolean;
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
  if (select state from public.accounts where account_id = v_account) <> 'active' then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  select * into v_current from public.eligibility e where e.account_id = v_account;
  v_installation := private.caller_installation(v_account);
  v_established := v_current.account_id is not null and v_current.band <> 'unresolved';

  if source = 'declaration' then
    -- Only while nothing sufficient is on record and no installation owes a check.
    v_accepted := (v_current.account_id is null or (v_current.band = 'unresolved' and v_current.source = 'declaration'))
      and not private.age_check_owed(v_account);
  elsif v_established then
    -- Never raising an established band; lowering it only restricts.
    v_accepted := v_current.band <> 'under-13' and private.band_rank(band) <= private.band_rank(v_current.band);
  else
    -- Establishing one: never past a check another installation (or, unregistered, any) owes.
    v_accepted := not private.age_check_owed(v_account, v_installation);
  end if;

  if v_accepted then
    insert into public.eligibility as e (account_id, band, source, checked_at, policy_version)
      values (v_account, band, source, now(), private.eligibility_policy_version())
      on conflict (account_id) do update
        set band = excluded.band, source = excluded.source, checked_at = excluded.checked_at, policy_version = excluded.policy_version;
    if source = 'platform-signal' and v_installation is not null then
      update private.installations i set age_check = null where i.account_id = v_account and i.installation_id = v_installation;
    end if;
  end if;
  return (
    select jsonb_build_object('accepted', v_accepted, 'eligibility', coalesce(e.band, 'unresolved'), 'source', coalesce(e.source, 'declaration'))
    from (select 1) one left join public.eligibility e on e.account_id = v_account
  );
end $$;
