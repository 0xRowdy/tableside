-- Devices and revocation (spec 2, #101; S2-19).
--
-- Each Supabase session maps to a registered installation. A device registers
-- each session it signs in with (register_device_v1), naming its installation
-- and proving it with the installation's secret, which only the installation
-- that first registered it holds. So a session can't pass itself off as
-- another device of the account, and the envelope of every upload must name
-- the caller's own registered installation. The platform and label are the
-- device's own words, shown to the account owner only: they say what a
-- device called itself, never which physical device it is.
--
-- Revoking a device ends every session registered to its installation;
-- signing out all other devices ends every session but the caller's. Both
-- need fresh authentication (private.session_fresh_identity), go through the
-- revoke-devices function, which sends the security email, and take the
-- account's synchronization head first. That is the transaction boundary:
-- an upload that holds the head when revocation comes completes, and every
-- later request of a revoked session is denied, since the authorization
-- gate (private.active_account, private.signed_in_account) requires the
-- caller's session to exist and revocation deletes it with its refresh
-- tokens. An unexpired access token is then not enough.
--
-- A revoked session's record stays, so the device learns of its revocation
-- from the lifecycle status operation, with the status credential it was
-- given when it registered: the only evidence that moves its gate to
-- Revoked. Provider revocation (Apple's server-to-server notifications,
-- Google's security events) arrives at the provider-notifications function,
-- which verifies it and calls apply_provider_revocation.

-- ---------------------------------------------------------------------------
-- The deletion deadline the lifecycle status answers with
-- ---------------------------------------------------------------------------

-- Server-set when deletion is scheduled (#103 writes it); null otherwise.
alter table public.accounts add column deletion_deadline timestamptz;

-- ---------------------------------------------------------------------------
-- Installations and the sessions registered to them
-- ---------------------------------------------------------------------------

-- One row per installation the account has signed in on. `device_id` is how
-- Devices names it to the app; the installation ID itself is never listed.
create table private.installations (
  account_id uuid not null references public.accounts (account_id),
  installation_id text not null check (installation_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  device_id uuid not null default gen_random_uuid() unique,
  secret_hash bytea not null,
  platform text not null check (platform in ('ios', 'android')),
  label text not null check (char_length(label) between 1 and 64),
  registered_at timestamptz not null default now(),
  primary key (account_id, installation_id)
);

-- One row per registered session. It outlives its session when the session
-- is revoked (revoked_at set), so the lifecycle status can say so, and when
-- the Auth user is removed (deletion, #104); a session that simply ended
-- (signed out, expired) loses its row with it. Only hashes of the status
-- credential are kept.
create table private.account_sessions (
  session_id uuid primary key,
  account_id uuid not null,
  installation_id text not null,
  status_hash bytea not null unique,
  registered_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  foreign key (account_id, installation_id) references private.installations (account_id, installation_id)
);

create index account_sessions_account on private.account_sessions (account_id);

-- Provider events already applied, so a replayed notification does nothing.
create table private.provider_events (
  event_hash bytea primary key,
  received_at timestamptz not null default now()
);

revoke all on private.installations, private.account_sessions, private.provider_events from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Devices
-- ---------------------------------------------------------------------------

-- The account's devices, as Devices (S2-19) lists them: one entry per
-- installation with a live session, and one per live session that never
-- registered (shown as an unknown device, so nothing signed in hides). Last
-- activity is the latest of the sessions' sign-in, token refresh and status
-- check. `this_device` is the installation (or session) of `p_session`.
create function private.account_devices(p_account uuid, p_user uuid, p_session uuid)
returns table (id uuid, platform text, label text, last_active_at timestamptz, this_device boolean)
language sql stable security definer set search_path = '' as $$
  select coalesce(i.device_id, s.id),
         i.platform,
         i.label,
         max(greatest(s.created_at, s.updated_at, s.refreshed_at at time zone 'UTC', r.last_seen_at)),
         bool_or(s.id = p_session)
  from auth.sessions s
  left join private.account_sessions r on r.session_id = s.id and r.account_id = p_account and r.revoked_at is null
  left join private.installations i on i.account_id = r.account_id and i.installation_id = r.installation_id
  where s.user_id = p_user
  group by coalesce(i.device_id, s.id), i.platform, i.label
$$;

-- Registers the caller's session to its installation, and answers its status
-- credential (a new one each time). The first session to register an
-- installation for the account gets its secret; every later one must prove
-- it, so a session can't claim another device's installation. A session is
-- registered to one installation only. Works on the restricted paths too,
-- so a restricted device still learns of its revocation.
--   'registered' { secret, status_token } | 'installation-claimed' | 'session-bound'
create function public.register_device_v1(installation text, secret text, platform text, label text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_account uuid := private.signed_in_account();
  v_session uuid := private.caller_session();
  v_label text := left(btrim(regexp_replace(coalesce(label, ''), '[[:cntrl:]]', '', 'g')), 64);
  v_installation private.installations;
  v_secret text := secret;
  v_bound text;
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  if v_account is null or v_session is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if coalesce(installation, '') !~ '^[A-Za-z0-9_-]{1,128}$' or coalesce(platform, '') not in ('ios', 'android') or v_label = ''
    or (secret is not null and secret !~ '^[0-9a-f]{64}$') then
    raise exception 'malformed device registration' using errcode = '22023';
  end if;
  -- One registration at a time per account.
  perform 1 from public.accounts where account_id = v_account for update;
  select * into v_installation from private.installations i where i.account_id = v_account and i.installation_id = installation;
  if found then
    if secret is null or extensions.digest(secret, 'sha256') <> v_installation.secret_hash then
      return jsonb_build_object('status', 'installation-claimed');
    end if;
    update private.installations i set platform = register_device_v1.platform, label = v_label
      where i.account_id = v_account and i.installation_id = installation;
  else
    v_secret := coalesce(secret, encode(extensions.gen_random_bytes(32), 'hex'));
    insert into private.installations (account_id, installation_id, secret_hash, platform, label)
      values (v_account, installation, extensions.digest(v_secret, 'sha256'), platform, v_label);
  end if;
  select r.installation_id into v_bound from private.account_sessions r where r.session_id = v_session;
  if v_bound is not null and v_bound <> installation then
    return jsonb_build_object('status', 'session-bound');
  end if;
  insert into private.account_sessions (session_id, account_id, installation_id, status_hash)
    values (v_session, v_account, installation, extensions.digest(v_token, 'sha256'))
    on conflict (session_id) do update set status_hash = excluded.status_hash, last_seen_at = now();
  return jsonb_build_object('status', 'registered', 'secret', v_secret, 'status_token', v_token);
end $$;

-- What Devices (S2-19) lists: this device first, then the most recently active.
-- Null when the gate denies.
create function public.devices_v1() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select jsonb_agg(jsonb_build_object('id', d.id, 'platform', d.platform, 'label', d.label,
                                         'last_active_at', d.last_active_at, 'this_device', d.this_device)
                      order by d.this_device desc, d.last_active_at desc nulls last, d.id)
       from private.account_devices(private.active_account(), auth.uid(), private.caller_session()) d),
    '[]'::jsonb)
  where private.active_account() is not null
$$;

-- #99's summary (20261116120000_account_settings.sql), counting devices (as
-- Devices lists them) rather than sessions: a device's earlier session left
-- open by an offline sign-out is the same device.
create or replace function public.account_summary_v1() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'email', u.email,
    'methods', coalesce((select jsonb_agg(distinct i.provider) from auth.identities i where i.user_id = u.id), '[]'::jsonb),
    'currency', a.currency,
    'currency_changeable', private.account_casino_sessions(a.account_id) = 0,
    'devices', (select count(*) from private.account_devices(a.account_id, u.id, private.caller_session()))
  )
  from public.accounts a
  join auth.users u on u.id = a.auth_user_id
  where a.account_id = private.active_account()
$$;

-- ---------------------------------------------------------------------------
-- Revocation
-- ---------------------------------------------------------------------------

-- Ends sessions as a revocation: they're marked revoked (by the trigger below)
-- rather than forgotten. The caller holds the account's synchronization head.
create function private.revoke_sessions(p_sessions uuid[], p_reason text) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform set_config('tableside.revocation', p_reason, true);
  delete from auth.sessions s where s.id = any (p_sessions);
  perform set_config('tableside.revocation', '', true);
end $$;

-- Takes the account's synchronization head: revocation waits for an upload
-- holding it, and every later upload sees the revocation.
create function private.lock_sync_head(p_account uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  insert into private.sync_heads (account_id) values (p_account) on conflict do nothing;
  perform 1 from private.sync_heads where account_id = p_account for update;
end $$;

-- For the revoke-devices function: signs out one device (`target`, a device
-- ID from devices_v1: every session registered to it) or every other device
-- ('others': every session but the caller's), for a freshly authenticated
-- session with ordinary access.
--   'signed-out' { devices, email }  `devices` other devices signed out; the security email goes to `email`
--   'this-device'                    the caller's own device: that is Sign out
--   'not-found' | 'fresh-authentication-required' | 'not-signed-in'
create function public.revoke_devices(session uuid, auth_user uuid, target text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_account uuid := private.session_account(session, auth_user);
  v_device uuid;
  v_this boolean;
  v_sessions uuid[];
  v_devices integer;
begin
  if v_account is null or not private.session_has_ordinary_access(session, auth_user) then
    return jsonb_build_object('status', 'not-signed-in');
  end if;
  perform private.lock_sync_head(v_account);
  if private.session_fresh_identity(session, auth_user) is null then
    return jsonb_build_object('status', 'fresh-authentication-required');
  end if;
  if target = 'others' then
    select array_agg(s.id) into v_sessions from auth.sessions s where s.user_id = auth_user and s.id <> session;
    select count(*) into v_devices from private.account_devices(v_account, auth_user, session) d where not d.this_device;
  else
    if coalesce(target, '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      return jsonb_build_object('status', 'not-found');
    end if;
    v_device := target::uuid;
    select d.this_device into v_this from private.account_devices(v_account, auth_user, session) d where d.id = v_device;
    if v_this is null then
      return jsonb_build_object('status', 'not-found');
    elsif v_this then
      return jsonb_build_object('status', 'this-device');
    end if;
    select array_agg(s.id) into v_sessions
      from auth.sessions s
      left join private.account_sessions r on r.session_id = s.id and r.account_id = v_account and r.revoked_at is null
      left join private.installations i on i.account_id = r.account_id and i.installation_id = r.installation_id
      where s.user_id = auth_user and coalesce(i.device_id, s.id) = v_device;
    v_devices := 1;
  end if;
  perform private.revoke_sessions(coalesce(v_sessions, '{}'), 'device');
  return jsonb_build_object('status', 'signed-out', 'devices', v_devices,
    'email', (select u.email from auth.users u where u.id = auth_user));
end $$;

-- #100's guard (20261123104700_fresh_authentication.sql), now also recording
-- how each registered session ended. Auth's /logout with scope=others, and
-- private.revoke_sessions, are revocations: the account's synchronization
-- head is taken and the sessions are marked revoked. Any other end (this
-- device's own sign-out, scope=global for an account's one session, expiry)
-- forgets them; removing the Auth user keeps them for #104's deletion status.
create or replace function private.guard_session_revocation() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid;
  v_others boolean := current_query() ~* '\mdelete\s+from\s+\S*sessions\S*\s+where\s+\S*id\S*\s*(!=|<>)';
  v_all boolean := current_query() ~* '\mdelete\s+from\s+\S*sessions\S*\s+where\s+\S*user_id\S*\s*=';
  v_reason text := nullif(current_setting('tableside.revocation', true), '');
begin
  if v_others or v_all then
    for v_user in select distinct g.user_id from gone g loop
      continue when not exists (select 1 from auth.users u where u.id = v_user);
      if v_others then
        if not exists (
          select 1 from auth.sessions s
          where s.user_id = v_user and private.session_fresh_identity(s.id, v_user) is not null
        ) then
          raise exception 'fresh_authentication_required' using errcode = '42501';
        end if;
      elsif (select count(*) from gone g where g.user_id = v_user) > 1 then
        raise exception 'fresh_authentication_required' using errcode = '42501';
      end if;
    end loop;
  end if;
  if v_others then
    v_reason := coalesce(v_reason, 'device');
  end if;
  if v_reason is not null then
    perform 1 from private.sync_heads h
      where h.account_id in (select a.account_id from public.accounts a where a.auth_user_id in (select g.user_id from gone g))
      for update;
    update private.account_sessions r set revoked_at = now()
      where r.session_id in (select g.id from gone g) and r.revoked_at is null;
  else
    delete from private.account_sessions r
      where r.session_id in (select g.id from gone g where exists (select 1 from auth.users u where u.id = g.user_id));
  end if;
  return null;
end $$;

-- ---------------------------------------------------------------------------
-- Lifecycle status
-- ---------------------------------------------------------------------------

-- The caller's own account and session, by the status credential its device
-- was given when it registered the session: 'active', 'revoked' (with when),
-- 'deletion-scheduled' (with the deadline) or 'deleted'. Nothing else, and it
-- restores no access. The credential is the device's, not a token: it still
-- answers after the session and its tokens are gone, and after the Auth user
-- is removed (the account row and the session's record outlive it). An
-- unknown credential, or a session that simply ended, gets no answer.
create function public.lifecycle_status_v1(token text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_record private.account_sessions;
  v_state text;
  v_deadline timestamptz;
begin
  if coalesce(token, '') ~ '^[0-9a-f]{64}$' then
    select r.* into v_record from private.account_sessions r where r.status_hash = extensions.digest(token, 'sha256');
    select a.state, a.deletion_deadline into v_state, v_deadline
      from public.accounts a where a.account_id = v_record.account_id and a.environment = private.environment();
  end if;
  if v_state = 'deleted' then
    return jsonb_build_object('status', 'deleted');
  elsif v_record.revoked_at is not null and v_state is not null then
    return jsonb_build_object('status', 'revoked', 'at', v_record.revoked_at);
  elsif v_state = 'deletion_scheduled' then
    return jsonb_build_object('status', 'deletion-scheduled', 'deadline', v_deadline);
  elsif v_state = 'active' and exists (select 1 from auth.sessions s where s.id = v_record.session_id) then
    update private.account_sessions r set last_seen_at = now()
      where r.session_id = v_record.session_id and r.last_seen_at < now() - interval '30 seconds';
    return jsonb_build_object('status', 'active');
  end if;
  raise exception 'not authorized' using errcode = '42501';
end $$;

-- ---------------------------------------------------------------------------
-- Provider revocation
-- ---------------------------------------------------------------------------

-- For the provider-notifications function, once it verified the event:
--   'consent-revoked'  the player stopped using the provider identity with
--                      Tableside (Apple consent revoked or Apple ID deleted;
--                      Google tokens or sessions revoked, account disabled or purged)
--   'relay-disabled'   Apple stopped forwarding to the private relay address
--                      `address`, so the email code method at it can't receive codes
-- It disables that method (removed from the account, unless it's the
-- account's only method, which the account must keep) and revokes the
-- sessions signed in with that kind of method: provider sessions for consent,
-- email-code sessions for the relay. The account is never deleted, and an
-- allowance grant is never revived or moved (spec 5). `event_id` makes a
-- replay do nothing.
--   'applied' { devices, email } | 'duplicate' | 'unknown'
create function public.apply_provider_revocation(provider text, subject text, event text, event_id text, address text default null) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user uuid;
  v_account uuid;
  v_method uuid;
  v_amr text;
  v_sessions uuid[];
  v_devices integer;
begin
  if event not in ('consent-revoked', 'relay-disabled') or coalesce(event_id, '') = '' or coalesce(subject, '') = '' then
    raise exception 'not a provider revocation' using errcode = '22023';
  end if;
  insert into private.provider_events (event_hash) values (extensions.digest(provider || ':' || event_id, 'sha256'))
    on conflict do nothing;
  if not found then
    return jsonb_build_object('status', 'duplicate');
  end if;
  select i.user_id into v_user from auth.identities i
    where i.provider = apply_provider_revocation.provider and i.provider_id = subject;
  select a.account_id into v_account from public.accounts a
    where a.auth_user_id = v_user and a.state <> 'deleted' and a.environment = private.environment();
  if v_account is null then
    return jsonb_build_object('status', 'unknown');
  end if;
  perform private.lock_sync_head(v_account);
  -- Serialized with the account's method changes.
  perform 1 from auth.users u where u.id = v_user for update;
  if event = 'consent-revoked' then
    select i.id into v_method from auth.identities i where i.user_id = v_user and i.provider = apply_provider_revocation.provider and i.provider_id = subject;
    v_amr := 'oauth';
  else
    select i.id into v_method from auth.identities i
      where i.user_id = v_user and i.provider = 'email' and lower(i.email) = lower(btrim(coalesce(address, '')));
    v_amr := 'otp';
  end if;
  -- Auth records how each session signed in; a session with no record could be either, so it goes too.
  select array_agg(s.id) into v_sessions from auth.sessions s
    where s.user_id = v_user
      and (exists (select 1 from auth.mfa_amr_claims c where c.session_id = s.id and c.authentication_method = v_amr)
        or not exists (select 1 from auth.mfa_amr_claims c where c.session_id = s.id));
  select count(*) into v_devices from (
    select distinct coalesce(i.device_id, s.id)
    from auth.sessions s
    left join private.account_sessions r on r.session_id = s.id and r.revoked_at is null
    left join private.installations i on i.account_id = r.account_id and i.installation_id = r.installation_id
    where s.id = any (coalesce(v_sessions, '{}'))) d;
  perform private.revoke_sessions(coalesce(v_sessions, '{}'), 'provider');
  if v_method is not null and (select count(*) from auth.identities i where i.user_id = v_user) > 1 then
    delete from auth.identities i where i.id = v_method;
  end if;
  return jsonb_build_object('status', 'applied', 'devices', v_devices,
    'email', (select u.email from auth.users u where u.id = v_user));
end $$;

-- ---------------------------------------------------------------------------
-- Synchronization: the envelope names the caller's own installation
-- ---------------------------------------------------------------------------

-- #95's sync_upload_v1 (20261117120000_account_state_operations.sql), now
-- refusing an envelope whose installation isn't the one the caller's session
-- registered: per-device positions and a record's device come from it. Same
-- arguments, answers and encoding, so protocol 1 is unchanged.
create or replace function public.sync_upload_v1(request text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_account uuid := private.active_account();
  v_request jsonb;
  v_hash text;
  v_operation text;
  v_item text;
  v_installation text;
  v_position bigint;
  v_head bigint;
  v_receipt private.sync_receipts;
  v_type private.record_types;
  v_result jsonb;
  v_change jsonb;
  v_disposition jsonb;
  v_assembly jsonb;
begin
  if octet_length(request) > 131072 then
    return jsonb_build_object('status', 'malformed');
  end if;
  if v_account is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  -- Contention on the head waits a bounded time; the client retries a bounded number of times.
  perform set_config('lock_timeout', '5s', true);

  begin
    v_request := request::jsonb;
  exception when others then
    return jsonb_build_object('status', 'malformed');
  end;
  if jsonb_typeof(v_request) is distinct from 'object' or jsonb_typeof(v_request -> 'protocol') is distinct from 'number' then
    return jsonb_build_object('status', 'malformed');
  end if;
  if (v_request ->> 'protocol') <> '1' then
    return jsonb_build_object('status', 'incompatible', 'supported', jsonb_build_array(1));
  end if;
  v_operation := v_request ->> 'operation';
  v_item := v_request ->> 'item';
  v_installation := v_request ->> 'installation';
  if v_operation is null or v_operation !~ '^[0-9a-f]{32}$'
    or coalesce(v_installation, '') !~ '^[A-Za-z0-9_-]{1,128}$'
    or coalesce(v_item, '') !~ '^[A-Za-z0-9_:/.-]{1,200}$'
    or jsonb_typeof(v_request -> 'recordType') is distinct from 'string'
    or coalesce(v_request ->> 'payloadVersion', '') !~ '^[1-9][0-9]{0,8}$'
    or (v_request ? 'after' and (jsonb_typeof(v_request -> 'after') is distinct from 'array'
      or jsonb_array_length(v_request -> 'after') not between 1 and 100
      or exists (select 1 from jsonb_array_elements(v_request -> 'after') a
                 where jsonb_typeof(a) is distinct from 'string' or (a #>> '{}') !~ '^[0-9a-f]{32}$')))
    or (v_request ? 'position' and (jsonb_typeof(v_request -> 'position') is distinct from 'number'
      or (v_request ->> 'position') !~ '^[1-9][0-9]{0,14}$')) then
    return jsonb_build_object('status', 'malformed');
  end if;
  v_position := (v_request ->> 'position')::bigint;
  v_hash := encode(extensions.digest(request, 'sha256'), 'hex');

  insert into private.sync_heads (account_id) values (v_account) on conflict do nothing;
  select sequence into v_head from private.sync_heads where account_id = v_account for update;
  -- The gate again, now that the head serializes this upload with every other
  -- authoritative change: a deletion scheduled or a session revoked while this
  -- upload waited is seen here, and the upload is denied.
  if private.active_account() is distinct from v_account then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  -- Only the caller's own registered installation: a session can't upload as another device.
  if not exists (
    select 1 from private.account_sessions r
    where r.session_id = private.caller_session() and r.account_id = v_account
      and r.installation_id = v_installation and r.revoked_at is null) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select * into v_receipt from private.sync_receipts where account_id = v_account and operation_id = v_operation;
  if found then
    if v_receipt.request_hash = v_hash then
      return v_receipt.disposition;
    end if;
    -- Not a receipt: the operation's real receipt stays as it is.
    return jsonb_build_object('status', 'operation-reused', 'operation', v_operation);
  end if;

  -- Barriers: under the head, every operation it waits for must already have
  -- its receipt. Not a receipt either: nothing is recorded.
  if exists (select 1 from jsonb_array_elements_text(coalesce(v_request -> 'after', '[]'::jsonb)) a (operation_id)
             where not exists (select 1 from private.sync_receipts r where r.account_id = v_account and r.operation_id = a.operation_id)) then
    return jsonb_build_object('status', 'waiting', 'operation', v_operation);
  end if;

  -- A manifest (#93): the payload is rebuilt from the staged chunks it names.
  -- Until every one is staged nothing is decided, so the client stages them
  -- and sends the identical request again.
  if v_request ? 'content' then
    v_assembly := private.assemble_content(v_account, v_request);
    if v_assembly ->> 'status' in ('malformed', 'chunks-missing') then
      return v_assembly;
    end if;
    if v_assembly ->> 'status' = 'assembled' then
      v_request := v_request || jsonb_build_object('payload', v_assembly -> 'payload');
    else
      v_result := v_assembly;
    end if;
  end if;

  select * into v_type from private.record_types
    where record_type = v_request ->> 'recordType' and payload_version = (v_request ->> 'payloadVersion')::integer;
  if v_result is not null then
    null;
  elsif not found then
    v_result := jsonb_build_object('status', 'rejected', 'code', 'unknown-record-type');
  elsif v_type.kind = 'server-authored-state' then
    v_result := jsonb_build_object('status', 'rejected', 'code', 'server-authored');
  elsif exists (select 1 from private.purged_results where account_id = v_account and record_type = v_type.record_type and item_id = v_item) then
    v_result := jsonb_build_object('status', 'rejected', 'code', 'purged');
  elsif (v_type.ordering = 'per-device') is distinct from (v_position is not null) then
    v_result := jsonb_build_object('status', 'rejected', 'code', case when v_position is null then 'position-required' else 'position-unexpected' end);
  elsif v_position is not null and exists (
      select 1 from private.device_positions p
      where p.account_id = v_account and p.record_type = v_type.record_type
        and ((p.installation_id = v_installation and p.position = v_position and p.item_id <> v_item)
          or (p.item_id = v_item and (p.installation_id <> v_installation or p.position <> v_position)))) then
    v_result := jsonb_build_object('status', 'rejected', 'code', 'position-reused');
  else
    execute format('select %s($1, $2, $3)', v_type.accept::regproc) into v_result using v_account, v_request, v_head + 1;
  end if;

  if v_result ->> 'status' = 'accepted' and v_result ? 'change' then
    v_change := v_result -> 'change';
    if v_position is not null then
      insert into private.device_positions (account_id, installation_id, record_type, position, item_id)
        values (v_account, v_installation, v_type.record_type, v_position, v_item);
      -- The platform's part of the change: where the record sits on its device.
      v_change := v_change || jsonb_build_object('origin', jsonb_build_object('installation', v_installation, 'position', v_position));
    end if;
    update private.sync_heads set sequence = v_head + 1 where account_id = v_account;
    insert into private.sync_feed (account_id, sequence, record_type, item_id, change)
      values (v_account, v_head + 1, v_request ->> 'recordType', v_item, v_change);
    v_disposition := jsonb_build_object('status', 'accepted', 'sequence', v_head + 1);
    -- Only a hint: devices read the change through the feed. Delivered on commit.
    perform realtime.send('{}'::jsonb, 'account-changed', 'account:' || v_account::text, true);
  elsif v_result ->> 'status' = 'accepted' then
    v_disposition := jsonb_build_object('status', 'accepted', 'sequence', (v_result ->> 'sequence')::bigint);
  else
    v_disposition := jsonb_build_object('status', 'rejected', 'code', v_result ->> 'code');
  end if;
  v_disposition := v_disposition || jsonb_build_object('operation', v_operation, 'requestHash', v_hash);

  insert into private.sync_receipts (account_id, operation_id, request_hash, installation_id, record_type, item_id, disposition)
    values (v_account, v_operation, v_hash, v_installation, v_request ->> 'recordType', v_item, v_disposition);
  -- The manifest's chunks have served: the receipt answers every retry from now on.
  if v_assembly is not null then
    delete from private.staged_chunks
      where account_id = v_account and record_type = v_request ->> 'recordType' and item_id = v_request ->> 'item'
        and sha256 in (select jsonb_array_elements_text(v_request -> 'content' -> 'chunks'));
  end if;
  return v_disposition;
end $$;

-- ---------------------------------------------------------------------------
-- Email: the "devices signed out" security notice
-- ---------------------------------------------------------------------------

alter table private.email_sends drop constraint email_sends_type_check;
alter table private.email_sends add constraint email_sends_type_check
  check (type in ('code', 'no-account', 'method-linked', 'email-change', 'device-revoked'));

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke execute on function private.account_devices(uuid, uuid, uuid), private.revoke_sessions(uuid[], text),
  private.lock_sync_head(uuid) from public;

revoke execute on function public.register_device_v1(text, text, text, text), public.devices_v1() from public, anon;
grant execute on function public.register_device_v1(text, text, text, text), public.devices_v1() to authenticated;

revoke execute on function public.lifecycle_status_v1(text) from public;
grant execute on function public.lifecycle_status_v1(text) to anon, authenticated;

revoke execute on function public.revoke_devices(uuid, uuid, text), public.apply_provider_revocation(text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.revoke_devices(uuid, uuid, text), public.apply_provider_revocation(text, text, text, text, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Jobs
-- ---------------------------------------------------------------------------

-- A replayed provider event older than this is refused by its age anyway.
create function private.expire_provider_events() returns void
language sql security definer set search_path = '' as $$
  delete from private.provider_events where received_at <= now() - interval '2 days';
$$;

revoke execute on function private.expire_provider_events() from public;

select cron.schedule('expire-provider-events', '17 * * * *', 'select private.expire_provider_events()');
