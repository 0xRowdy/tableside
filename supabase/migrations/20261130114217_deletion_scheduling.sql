-- Scheduling deletion with a 30-day undo (spec 2, #103; S2-22, S2-23;
-- *Deletion*, Amendments 1 A1, B2, B3, C1–C3, 3 §3–4, 5 §2, 7 §4 and 9 §1).
--
-- A player who confirmed it's them (fresh authentication) schedules deletion
-- through the schedule-deletion function, which sends the "deletion
-- scheduled" email. One transaction, serialized with uploads, revocation and
-- export requests (the account's synchronization head, which spec 5's
-- purchases take too) and with linking (the Auth user's row):
--   * the account becomes 'deletion_scheduled' with a server-set deadline 30
--     days out;
--   * ordinary access ends: the authorization gate (private.active_account)
--     now requires an active account, so RLS, storage, sync and method changes
--     deny it, while the restricted paths stay: Cancel deletion, deletion
--     status, the lifecycle status, export after fresh authentication
--     (Amendment 1 B2), and the fresh authentication those need;
--   * owned public content is hidden through spec 6's hook, which also holds
--     (never cancels) evaluation requests (Amendment 7 §4);
--   * every live export ends (private.invalidate_exports);
--   * a durable receipt answers a retry of the same request.
-- Sessions, sign-in methods and data stay; nothing is purged, no provider is
-- called and no device is wiped. Those are the irreversible boundary's
-- (#104): at the deadline, or on Delete permanently now.
--
-- Cancel deletion (cancel_deletion_v1) needs fresh authentication too, and
-- only the server decides it: before the deadline it restores the same
-- account, with its data, and runs spec 5's current-store check (no grant is
-- issued or refilled); at or past the deadline, or once deleted, it changes
-- nothing. Signing in or renewing a token never cancels.

-- ---------------------------------------------------------------------------
-- The schedule
-- ---------------------------------------------------------------------------

-- When the current scheduling was accepted (deletion_deadline is #101's).
alter table public.accounts add column deletion_scheduled_at timestamptz;
alter table public.accounts add constraint accounts_deletion_schedule check (
  (state = 'deletion_scheduled') = (deletion_deadline is not null)
  and (deletion_deadline is null) = (deletion_scheduled_at is null));

-- How long the undo window lasts.
create function private.deletion_window() returns interval
language sql immutable set search_path = '' as $$
  select interval '30 days'
$$;

-- One receipt per accepted request (schedule or cancel): a retry with the same
-- operation ID gets the same answer, never a second acceptance. A different
-- request under the same ID is refused.
create table private.deletion_receipts (
  account_id uuid not null references public.accounts (account_id),
  operation_id text not null check (operation_id ~ '^[0-9a-f]{32}$'),
  action text not null check (action in ('schedule', 'cancel')),
  disposition jsonb not null,
  accepted_at timestamptz not null default now(),
  primary key (account_id, operation_id)
);

revoke all on private.deletion_receipts from public, anon, authenticated;

insert into private.retention_rules (subject, endpoint, dependency, owner) values
  ('private.deletion_receipts',
   'Each accepted Schedule or Cancel deletion request''s answer, so a retry gets it again: kept while the account exists; removed by permanent deletion (#104).',
   null, null);

-- The account-state control now carries the deadline, so a restore can be
-- fenced with the schedule as it was acknowledged (Amendment 1 A5).
-- (#98's version: 20261126101753_compaction_stale_devices.sql.)
create or replace function private.journal_account_state() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.record_control(new.account_id, 'account-state', new.account_id::text,
    jsonb_build_object('state', new.state) || case when new.deletion_deadline is not null
      then jsonb_build_object('deadline', new.deletion_deadline) else '{}'::jsonb end);
  return null;
end $$;

-- ---------------------------------------------------------------------------
-- The gates
-- ---------------------------------------------------------------------------

-- #90's restricted-path gate (20261118000000_age_eligibility.sql), now also
-- open to an account whose deletion is scheduled: the caller's live session,
-- from this environment, of an account that isn't deleted. Its callers are the
-- restricted paths (current_account, the lifecycle answers, device
-- registration, fresh authentication, export) and nothing ordinary.
create or replace function private.signed_in_account() returns uuid
language sql stable security definer set search_path = '' as $$
  select a.account_id
  from public.accounts a
  join auth.sessions s on s.user_id = a.auth_user_id
  where a.auth_user_id = auth.uid()
    and a.state in ('active', 'deletion_scheduled')
    and s.id = nullif(auth.jwt() ->> 'session_id', '')::uuid
    and a.environment = private.environment()
    and auth.jwt() ->> 'environment' = private.environment()
$$;

-- The authorization gate for ordinary access (#90's,
-- 20261118000000_age_eligibility.sql): the signed-in account, active, with
-- established 13+ eligibility. Deletion scheduled is denied it.
create or replace function private.active_account() returns uuid
language sql stable security definer set search_path = '' as $$
  select a.account_id
  from public.accounts a
  where a.account_id = private.signed_in_account()
    and a.state = 'active'
    and private.account_eligibility(a.account_id) in ('adult', 'teen')
$$;

-- #100's session gate (20261123104700_fresh_authentication.sql), opened the
-- same way: fresh authentication and export work for a deletion-scheduled
-- account (Amendment 1 B2; Amendment 3 §4: Cancel deletion needs it).
create or replace function private.session_account(session uuid, auth_user uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select a.account_id
  from public.accounts a
  join auth.sessions s on s.user_id = a.auth_user_id
  where s.id = session
    and a.auth_user_id = auth_user
    and a.state in ('active', 'deletion_scheduled')
    and a.environment = private.environment()
$$;

-- Ordinary access for a given session (#100's): an active account only.
create or replace function private.session_has_ordinary_access(session uuid, auth_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select a.state = 'active' and private.account_eligibility(a.account_id) in ('adult', 'teen')
       from public.accounts a where a.account_id = private.session_account(session, auth_user)),
    false)
$$;

-- #99's and #90's current account (20261118000000_age_eligibility.sql), now
-- with the deletion deadline while deletion is scheduled (the key is absent
-- otherwise), so a device signing in to a deletion-scheduled account opens it
-- locked at once.
create or replace function public.current_account() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'account_id', a.account_id,
    'eligibility', coalesce(e.band, 'unresolved'),
    'source', coalesce(e.source, 'declaration'),
    'currency', a.currency)
    || case when a.deletion_deadline is not null then jsonb_build_object('deletion_deadline', a.deletion_deadline) else '{}'::jsonb end
  from public.accounts a
  left join public.eligibility e on e.account_id = a.account_id
  where a.account_id = private.signed_in_account()
$$;

-- #90's eligibility report (20261118000000_age_eligibility.sql), refused while
-- deletion is scheduled: it is no restricted path of that state.
create or replace function public.record_eligibility_v1(band text, source text) returns jsonb
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
  if (select state from public.accounts where account_id = v_account) <> 'active' then
    raise exception 'not signed in' using errcode = '42501';
  end if;
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

-- #100's provider linking (20261123104700_fresh_authentication.sql), now
-- checking ordinary access after it takes the Auth user's row, so it is
-- serialized with deletion scheduling: a link waiting on a scheduling that
-- commits is refused, never added to a deletion-scheduled account.
create or replace function public.link_provider_identity(session uuid, auth_user uuid, provider text, subject text, claims jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_owner uuid;
  v_email text;
begin
  if coalesce(provider, '') in ('', 'email') or coalesce(subject, '') = '' then
    raise exception 'not a provider identity' using errcode = '22023';
  end if;
  -- Serialized with the account's other method changes and with deletion scheduling.
  select u.email into v_email from auth.users u where u.id = auth_user for update;
  if not private.session_has_ordinary_access(session, auth_user) then
    return jsonb_build_object('status', 'not-signed-in');
  end if;
  if private.session_fresh_identity(session, auth_user) is null then
    return jsonb_build_object('status', 'fresh-authentication-required');
  end if;
  select i.user_id into v_owner from auth.identities i
    where i.provider = link_provider_identity.provider and i.provider_id = subject;
  if v_owner = auth_user then
    return jsonb_build_object('status', 'already-linked');
  elsif v_owner is not null then
    return jsonb_build_object('status', 'conflict');
  end if;
  begin
    insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (subject, auth_user, coalesce(claims, '{}'::jsonb) || jsonb_build_object('sub', subject), provider, null, now(), now());
  exception when unique_violation then
    -- Another account took the identity between the check and the insert: still a conflict, never a merge.
    return jsonb_build_object('status', 'conflict');
  end;
  return jsonb_build_object('status', 'linked', 'email', v_email);
end $$;

-- ---------------------------------------------------------------------------
-- Hooks for later specs (stubs until they land)
-- ---------------------------------------------------------------------------

-- Spec 6's contract: hide the account's owned listings, profile, ratings,
-- contributions and cached aggregates, and hold its evaluation requests
-- without cancelling them (Amendment 7 §4), in the scheduling transaction.
-- Hide, don't destroy: the irreversible boundary (#104) removes. Tableside
-- has no public content yet, so there is nothing to hide.
create function private.hide_public_content(p_account uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform p_account;
end $$;

-- Spec 6's contract, on Cancel deletion: what scheduling hid shows again and
-- held evaluation requests resume.
create function private.restore_public_content(p_account uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform p_account;
end $$;

-- Spec 5's contract, on Cancel deletion (Amendment 5 §2): ask for a current
-- store check, so only currently verified premium returns. It never issues or
-- refills an allowance grant. No purchases exist yet.
create function private.request_current_store_check(p_account uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform p_account;
end $$;

-- ---------------------------------------------------------------------------
-- Scheduling, cancelling and status
-- ---------------------------------------------------------------------------

-- The schedule as the player sees it.
create function private.deletion_view(p_account uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when a.state = 'deletion_scheduled'
    then jsonb_build_object('status', 'scheduled', 'deadline', a.deletion_deadline, 'scheduledAt', a.deletion_scheduled_at)
    else jsonb_build_object('status', 'none') end
  from public.accounts a where a.account_id = p_account
$$;

-- For the schedule-deletion function: schedules deletion of the account of a
-- freshly authenticated session.
--   'scheduled' { deadline, scheduledAt, accepted, email }
--       `accepted` is true only for the request that scheduled it (the
--       function then sends the email to `email`); a retry of it, or a request
--       while deletion is already scheduled, answers the schedule as it stands
--   'fresh-authentication-required'
--   'not-signed-in'   no such session, or the account is deleted
create function public.schedule_deletion(session uuid, auth_user uuid, operation_id text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_account uuid := private.session_account(session, auth_user);
  v_receipt private.deletion_receipts;
  v_state text;
  v_at timestamptz := now();
  v_disposition jsonb;
begin
  if coalesce(operation_id, '') !~ '^[0-9a-f]{32}$' then
    raise exception 'malformed operation' using errcode = '22023';
  end if;
  if v_account is null then
    return jsonb_build_object('status', 'not-signed-in');
  end if;
  -- Serialized with uploads, revocation, export requests and purchases (the
  -- head, #91's lock order), then with linking and method changes.
  perform private.lock_sync_head(v_account);
  perform 1 from auth.users u where u.id = auth_user for update;
  select state into v_state from public.accounts where account_id = v_account for update;
  if private.session_account(session, auth_user) is distinct from v_account then
    return jsonb_build_object('status', 'not-signed-in');
  end if;
  -- A retry gets the answer its request got: never a second acceptance.
  select * into v_receipt from private.deletion_receipts r where r.account_id = v_account and r.operation_id = schedule_deletion.operation_id;
  if found then
    if v_receipt.action <> 'schedule' then
      raise exception 'operation reused' using errcode = '22023';
    end if;
    return (v_receipt.disposition - 'email') || jsonb_build_object('accepted', false);
  end if;
  if private.session_fresh_identity(session, auth_user) is null then
    return jsonb_build_object('status', 'fresh-authentication-required');
  end if;
  if v_state = 'deletion_scheduled' then
    return private.deletion_view(v_account) || jsonb_build_object('accepted', false);
  end if;
  update public.accounts
    set state = 'deletion_scheduled', deletion_deadline = v_at + private.deletion_window(), deletion_scheduled_at = v_at
    where account_id = v_account;
  perform private.invalidate_exports(v_account, 'deletion-scheduled');
  perform private.hide_public_content(v_account);
  v_disposition := private.deletion_view(v_account) || jsonb_build_object('accepted', true);
  insert into private.deletion_receipts (account_id, operation_id, action, disposition)
    values (v_account, schedule_deletion.operation_id, 'schedule', v_disposition);
  return v_disposition || jsonb_build_object('email', (select u.email from auth.users u where u.id = auth_user));
end $$;

-- Cancel deletion, for the caller's freshly authenticated session.
--   'cancelled'      the account is active again, the same account with its data
--   'too-late'       the deadline has passed: the irreversible boundary is the server's to run
--   'not-scheduled'  deletion isn't scheduled (a retry after a cancel gets 'cancelled')
--   'fresh-authentication-required'
-- A deleted account's session is no longer signed in: refused.
create function public.cancel_deletion_v1(operation_id text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_session uuid := private.caller_session();
  v_account uuid := private.signed_in_account();
  v_receipt private.deletion_receipts;
  v_account_row public.accounts;
  v_disposition jsonb := jsonb_build_object('status', 'cancelled');
begin
  if coalesce(operation_id, '') !~ '^[0-9a-f]{32}$' then
    raise exception 'malformed operation' using errcode = '22023';
  end if;
  if v_account is null or v_session is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  perform private.lock_sync_head(v_account);
  select * into v_account_row from public.accounts where account_id = v_account for update;
  if private.signed_in_account() is distinct from v_account then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  select * into v_receipt from private.deletion_receipts r where r.account_id = v_account and r.operation_id = cancel_deletion_v1.operation_id;
  if found then
    if v_receipt.action <> 'cancel' then
      raise exception 'operation reused' using errcode = '22023';
    end if;
    return v_receipt.disposition;
  end if;
  if private.session_fresh_identity(v_session, auth.uid()) is null then
    return jsonb_build_object('status', 'fresh-authentication-required');
  end if;
  if v_account_row.state <> 'deletion_scheduled' then
    return jsonb_build_object('status', 'not-scheduled');
  end if;
  if v_account_row.deletion_deadline <= now() then
    return jsonb_build_object('status', 'too-late');
  end if;
  update public.accounts set state = 'active', deletion_deadline = null, deletion_scheduled_at = null
    where account_id = v_account;
  perform private.restore_public_content(v_account);
  perform private.request_current_store_check(v_account);
  insert into private.deletion_receipts (account_id, operation_id, action, disposition)
    values (v_account, cancel_deletion_v1.operation_id, 'cancel', v_disposition);
  return v_disposition;
end $$;

-- Deletion status, a restricted view that grants no record access:
-- {"status":"none"} or {"status":"scheduled","deadline","scheduledAt"}.
-- (Processing and completed, and their delays, are #104's.)
create function public.deletion_status_v1() returns jsonb
language sql stable security definer set search_path = '' as $$
  select private.deletion_view(account_id)
  from (select private.signed_in_account() as account_id) signed_in
  where account_id is not null
$$;

-- ---------------------------------------------------------------------------
-- Email: "deletion scheduled"
-- ---------------------------------------------------------------------------

alter table private.email_sends drop constraint email_sends_type_check;
alter table private.email_sends add constraint email_sends_type_check
  check (type in ('code', 'no-account', 'method-linked', 'email-change', 'device-revoked', 'export-ready', 'deletion-scheduled'));

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke execute on function private.deletion_window(), private.deletion_view(uuid), private.hide_public_content(uuid),
  private.restore_public_content(uuid), private.request_current_store_check(uuid) from public;

revoke execute on function public.schedule_deletion(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.schedule_deletion(uuid, uuid, text) to service_role;

revoke execute on function public.cancel_deletion_v1(text), public.deletion_status_v1() from public, anon;
grant execute on function public.cancel_deletion_v1(text), public.deletion_status_v1() to authenticated;
