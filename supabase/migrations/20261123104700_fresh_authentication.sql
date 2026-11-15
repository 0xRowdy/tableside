-- Fresh authentication and sign-in methods (spec 2, #100; S2-18).
--
-- Fresh authentication is a server-side record that one session's player
-- signed in again, by proving one of the account's own sign-in methods (an
-- emailed code, or an Apple or Google ID token), within the last five minutes.
-- Only the fresh-auth function writes it, after checking the proof. A token
-- refresh keeps the session and never writes it, so refreshing never makes a
-- session fresh. Being signed in already isn't enough either: a new session
-- has no record until its player confirms again.
--
-- Fresh authentication gates method changes, email change, revoking other
-- devices, server export and every deletion action. The operations here (and
-- later tickets' through private.require_fresh_authentication) check it for
-- the requesting session. Auth's own endpoints that would do the same are
-- covered in the database, since every one of them ends in a write to Auth's
-- tables:
--   * linking and unlinking (/user/identities): manual linking stays off
--     (config.toml), so Auth refuses them; methods change only here. A
--     trigger also refuses removing an account's last identity by any path.
--   * email change (PUT /user {email}): a trigger refuses it unless this
--     session's fresh, email-method account authorized that address first,
--     and the send-email hook sends nothing for an unauthorized change.
--     Secure Email Change (double_confirm_changes) stays on, so the current
--     and the new address both confirm.
--   * passwords (PUT /user {password}): Tableside has none; a trigger refuses
--     changing one. (Auth gives a user it creates a random password nobody
--     knows, so creating a user is not setting one.)
--   * signing out other devices (/logout?scope=others, scope=global): a
--     trigger refuses it unless the session that stays is fresh.

-- ---------------------------------------------------------------------------
-- Fresh authentication
-- ---------------------------------------------------------------------------

-- One row per session, replaced at each confirmation. It goes with its
-- session, and with the identity that proved it.
create table private.fresh_authentications (
  session_id uuid primary key references auth.sessions (id) on delete cascade,
  auth_user_id uuid not null,
  identity_id uuid not null references auth.identities (id) on delete cascade,
  authenticated_at timestamptz not null
);

-- How long a confirmation lasts: long enough to finish one change, short
-- enough that a device left signed in can't be used to change the account.
create function private.fresh_authentication_window() returns interval
language sql immutable set search_path = '' as $$
  select interval '5 minutes'
$$;

-- The identity that freshly authenticated this session of this Auth user, or null.
create function private.session_fresh_identity(session uuid, auth_user uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select f.identity_id
  from private.fresh_authentications f
  join auth.sessions s on s.id = f.session_id and s.user_id = f.auth_user_id
  where f.session_id = session
    and f.auth_user_id = auth_user
    and f.authenticated_at > now() - private.fresh_authentication_window()
$$;

-- The caller's session, when its token is from this environment.
create function private.caller_session() returns uuid
language sql stable security definer set search_path = '' as $$
  select s.id
  from auth.sessions s
  where s.id = nullif(auth.jwt() ->> 'session_id', '')::uuid
    and s.user_id = auth.uid()
    and auth.jwt() ->> 'environment' = private.environment()
$$;

-- The identity that freshly authenticated the caller's session, or null.
create function private.fresh_identity() returns uuid
language sql stable security definer set search_path = '' as $$
  select private.session_fresh_identity(private.caller_session(), auth.uid())
$$;

-- For every operation fresh authentication gates (this ticket's, and later
-- tickets': revoking devices, server export, deletion and its cancellation).
-- Refuses with 'fresh_authentication_required' unless the caller's session
-- confirmed within the window; returns the identity that confirmed it.
create function private.require_fresh_authentication() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  v_identity uuid := private.fresh_identity();
begin
  if v_identity is null then
    raise exception 'fresh_authentication_required' using errcode = '42501';
  end if;
  return v_identity;
end $$;

-- #90's signed-in account (private.signed_in_account) for a given session
-- rather than the caller's token: the session is the Auth user's and live,
-- and the account is active and this environment's, whatever its
-- eligibility. Fresh authentication works on the restricted paths too
-- (deletion, export), so it asks no more than this; the method changes
-- below are ordinary access and also need established 13+ eligibility.
create function private.session_account(session uuid, auth_user uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select a.account_id
  from public.accounts a
  join auth.sessions s on s.user_id = a.auth_user_id
  where s.id = session
    and a.auth_user_id = auth_user
    and a.state = 'active'
    and a.environment = private.environment()
$$;

-- Whether a session may change the account's sign-in methods: ordinary
-- access, as private.active_account() grants it.
create function private.session_has_ordinary_access(session uuid, auth_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.account_eligibility(private.session_account(session, auth_user)) in ('adult', 'teen'), false)
$$;

-- For the account functions (fresh-auth, link-method): who is calling, from
-- their own token, on #90's restricted-path gate (private.signed_in_account):
-- a live session, from this environment, of an active account. `email` is
-- the email method's address, if the account has that method.
create function public.caller_session_v1() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'session_id', private.caller_session(),
    'auth_user_id', u.id,
    'email', (select i.email from auth.identities i where i.user_id = u.id and i.provider = 'email' limit 1)
  )
  from auth.users u
  where u.id = auth.uid()
    and private.caller_session() is not null
    and private.signed_in_account() is not null
$$;

-- For the fresh-auth function, once it has checked the proof: records that
-- the session's player confirmed with this method (an email code, or a
-- provider identity's subject). 'not-a-method' when the account has no such
-- method: a different Apple ID, say.
create function public.record_fresh_authentication(session uuid, auth_user uuid, provider text, subject text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_identity uuid;
  v_at timestamptz := now();
begin
  if private.session_account(session, auth_user) is null then
    return jsonb_build_object('status', 'not-signed-in');
  end if;
  select i.id into v_identity from auth.identities i
    where i.user_id = auth_user
      and i.provider = record_fresh_authentication.provider
      and (record_fresh_authentication.provider = 'email' or i.provider_id = subject)
    limit 1;
  if v_identity is null then
    return jsonb_build_object('status', 'not-a-method');
  end if;
  insert into private.fresh_authentications (session_id, auth_user_id, identity_id, authenticated_at)
    values (session, auth_user, v_identity, v_at)
    on conflict (session_id) do update set identity_id = excluded.identity_id, authenticated_at = excluded.authenticated_at;
  return jsonb_build_object('status', 'confirmed', 'expires_at', v_at + private.fresh_authentication_window());
end $$;

-- ---------------------------------------------------------------------------
-- Proof nonces: an Apple or Google proof answers this request, once
-- ---------------------------------------------------------------------------

-- An ID token proves a fresh sign-in only when it was minted for a nonce the
-- server issued to this session for it, and only once: a token from an
-- earlier sign-in, or one already used, proves nothing. Only the hash is kept.
create table private.proof_nonces (
  nonce_hash bytea primary key,
  session_id uuid not null references auth.sessions (id) on delete cascade,
  expires_at timestamptz not null
);

-- A nonce for the caller's session, for the provider's sheet or page to mint
-- its ID token with. Long enough for Apple's web flow; one use.
create function public.issue_proof_nonce_v1() returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_session uuid := private.caller_session();
  v_nonce text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  if v_session is null or private.signed_in_account() is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  insert into private.proof_nonces (nonce_hash, session_id, expires_at)
    values (extensions.digest(v_nonce, 'sha256'), v_session, now() + interval '10 minutes');
  return v_nonce;
end $$;

-- For fresh-auth and link-method: uses up a nonce this session was issued.
-- False when it wasn't issued to this session, has expired or was used.
create function public.consume_proof_nonce(session uuid, nonce text) returns boolean
language sql volatile security definer set search_path = '' as $$
  with used as (
    delete from private.proof_nonces
    where nonce_hash = extensions.digest(coalesce(nonce, ''), 'sha256') and session_id = session and expires_at > now()
    returning 1
  )
  select exists (select 1 from used)
$$;

-- ---------------------------------------------------------------------------
-- Sign-in methods
-- ---------------------------------------------------------------------------

-- What Sign-in methods (S2-18) lists: each method with the address it goes
-- by, oldest first. Null when the gate denies.
create function public.sign_in_methods_v1() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select jsonb_agg(jsonb_build_object('id', i.id, 'provider', i.provider, 'email', i.email) order by i.created_at, i.id)
       from auth.identities i where i.user_id = auth.uid()),
    '[]'::jsonb)
  where private.active_account() is not null
$$;

-- For the link-method function, after it verified the identity's ID token:
-- adds the identity to the account of a freshly authenticated session.
--   'linked'          added; `email` is where the security notice goes
--   'already-linked'  it was this account's already
--   'conflict'        another account signs in with it: nothing changes, never a merge
--   'fresh-authentication-required'
--   'not-signed-in'   no such session, or the account has no ordinary access
create function public.link_provider_identity(session uuid, auth_user uuid, provider text, subject text, claims jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_owner uuid;
  v_email text;
begin
  if coalesce(provider, '') in ('', 'email') or coalesce(subject, '') = '' then
    raise exception 'not a provider identity' using errcode = '22023';
  end if;
  if not private.session_has_ordinary_access(session, auth_user) then
    return jsonb_build_object('status', 'not-signed-in');
  end if;
  -- Serialized with the account's other method changes.
  select u.email into v_email from auth.users u where u.id = auth_user for update;
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

-- For the link-method function: the address an email-code method would be
-- added for (the account's own sign-in email), before it sends that address
-- a code. Statuses as link_provider_identity's, plus 'ready'.
create function public.email_method_address(session uuid, auth_user uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_email text;
begin
  if not private.session_has_ordinary_access(session, auth_user) then
    return jsonb_build_object('status', 'not-signed-in');
  end if;
  if private.session_fresh_identity(session, auth_user) is null then
    return jsonb_build_object('status', 'fresh-authentication-required');
  end if;
  if exists (select 1 from auth.identities i where i.user_id = auth_user and i.provider = 'email') then
    return jsonb_build_object('status', 'already-linked');
  end if;
  select u.email into v_email from auth.users u where u.id = auth_user and u.email_confirmed_at is not null;
  if coalesce(v_email, '') = '' then
    return jsonb_build_object('status', 'no-address');
  end if;
  return jsonb_build_object('status', 'ready', 'email', v_email);
end $$;

-- For the link-method function, once the code it sent was entered: adds the
-- email-code method for the account's sign-in email. Statuses as above.
create function public.link_email_identity(session uuid, auth_user uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_ready jsonb;
begin
  perform 1 from auth.users u where u.id = auth_user for update;
  v_ready := public.email_method_address(session, auth_user);
  if v_ready ->> 'status' <> 'ready' then
    return v_ready;
  end if;
  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (auth_user::text, auth_user,
      jsonb_build_object('sub', auth_user::text, 'email', v_ready ->> 'email', 'email_verified', true, 'phone_verified', false),
      'email', null, now(), now());
  return jsonb_build_object('status', 'linked', 'email', v_ready ->> 'email');
end $$;

-- Removes one of the caller's sign-in methods. The caller must have freshly
-- authenticated with another method (so a method that remains is known to
-- work), and the account always keeps at least one.
--   'removed' | 'last-method' | 'confirm-with-another-method' | 'fresh-authentication-required'
create function public.remove_sign_in_method_v1(identity uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_fresh uuid;
  v_provider text;
begin
  if private.active_account() is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  -- Serialized with the account's other method changes, so two removals
  -- racing can't leave it with none.
  perform 1 from auth.users u where u.id = v_user for update;
  select i.provider into v_provider from auth.identities i where i.id = identity and i.user_id = v_user;
  if v_provider is null then
    raise exception 'not a method of this account' using errcode = '22023';
  end if;
  -- Said before asking anyone to confirm: confirming wouldn't change it.
  if (select count(*) from auth.identities i where i.user_id = v_user) <= 1 then
    return jsonb_build_object('status', 'last-method');
  end if;
  v_fresh := private.fresh_identity();
  if v_fresh is null then
    return jsonb_build_object('status', 'fresh-authentication-required');
  end if;
  if v_fresh = identity then
    return jsonb_build_object('status', 'confirm-with-another-method');
  end if;
  delete from auth.identities i where i.id = identity;
  -- A code already sent for the email method stops working with it.
  if v_provider = 'email' then
    delete from auth.one_time_tokens t
      where t.user_id = v_user and t.token_type in ('confirmation_token', 'recovery_token', 'reauthentication_token');
    update auth.users set recovery_token = '', confirmation_token = '', reauthentication_token = '' where id = v_user;
  end if;
  return jsonb_build_object('status', 'removed');
end $$;

-- The last method can't go by any path: Auth's own endpoints included.
-- Removing the Auth user itself (its identities go with it) is not this.
create function private.keep_a_sign_in_method() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from auth.users u where u.id = old.user_id)
    and not exists (select 1 from auth.identities i where i.user_id = old.user_id) then
    raise exception 'last_sign_in_method' using errcode = '42501';
  end if;
  return null;
end $$;

create trigger keep_a_sign_in_method after delete on auth.identities
  for each row execute function private.keep_a_sign_in_method();

-- ---------------------------------------------------------------------------
-- Email change (Secure Email Change: the current and new address both confirm)
-- ---------------------------------------------------------------------------

-- One pending authorization per Auth user: the address a freshly
-- authenticated session may change the email method to, briefly. Auth's
-- PUT /user reaches the database without its session, so the authorization
-- is the account's: only a fresh session can create one, and another session
-- can at most finish the change the fresh one asked for.
create table private.email_change_authorizations (
  auth_user_id uuid primary key references auth.users (id) on delete cascade,
  address text not null,
  expires_at timestamptz not null
);

-- Authorizes the caller to change the email method's address to
-- `new_email`; the app then asks Auth (PUT /user), which emails a code to
-- each address.
--   'authorized' | 'fresh-authentication-required' | 'no-email-method' | 'same-address' | 'invalid'
create function public.authorize_email_change_v1(new_email text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_address text := lower(btrim(coalesce(new_email, '')));
  v_current text;
begin
  if private.active_account() is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if v_address !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or length(v_address) > 254 then
    return jsonb_build_object('status', 'invalid');
  end if;
  if private.fresh_identity() is null then
    return jsonb_build_object('status', 'fresh-authentication-required');
  end if;
  select i.email into v_current from auth.identities i where i.user_id = v_user and i.provider = 'email';
  if v_current is null then
    return jsonb_build_object('status', 'no-email-method');
  end if;
  if v_current = v_address then
    return jsonb_build_object('status', 'same-address');
  end if;
  insert into private.email_change_authorizations (auth_user_id, address, expires_at)
    values (v_user, v_address, now() + private.fresh_authentication_window())
    on conflict (auth_user_id) do update set address = excluded.address, expires_at = excluded.expires_at;
  return jsonb_build_object('status', 'authorized');
end $$;

-- For the send-email hook: whether this change was authorized, before it
-- sends anything. (The trigger below consumes the authorization.)
create function public.email_change_authorized(auth_user uuid, address text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from private.email_change_authorizations a
    where a.auth_user_id = auth_user and a.address = lower(btrim(coalesce(address, ''))) and a.expires_at > now()
  )
$$;

-- Auth writes every email change request and every password change to
-- auth.users, whichever endpoint it came through. An email change needs the
-- authorization above (it is used up); a password is never changed.
create function private.guard_auth_user_changes() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- (Auth rewrites a provider user's row on each sign-in, an empty password as '' for null.)
  if coalesce(new.encrypted_password, '') <> '' and new.encrypted_password is distinct from old.encrypted_password then
    raise exception 'passwords_not_supported' using errcode = '42501';
  end if;
  if coalesce(new.email_change, '') <> '' and new.email_change is distinct from old.email_change then
    delete from private.email_change_authorizations a
      where a.auth_user_id = new.id and a.address = lower(new.email_change) and a.expires_at > now();
    if not found then
      raise exception 'fresh_authentication_required' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

create trigger guard_auth_user_changes before update on auth.users
  for each row execute function private.guard_auth_user_changes();

-- ---------------------------------------------------------------------------
-- Signing out other devices through Auth
-- ---------------------------------------------------------------------------

-- Auth's /logout deletes sessions with one of three statements: this session
-- (scope=local, `where id = $1`), every other one (scope=others,
-- `where id != $1 and user_id = $2`) or all of them (scope=global,
-- `where user_id = $1`). Only the last two reach other devices, and they are
-- told apart by the statement itself, since nothing else in the request
-- reaches the database. Signing out others needs the session that stays to
-- be fresh; signing out everywhere, which the app never does, is allowed only
-- when this was the account's one session. (Removing the Auth user takes its
-- sessions with it, which is not this.) Qualified against the pinned Auth at
-- launch gate 4.
create function private.guard_session_revocation() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid;
  v_others boolean := current_query() ~* '\mdelete\s+from\s+\S*sessions\S*\s+where\s+\S*id\S*\s*(!=|<>)';
  v_all boolean := current_query() ~* '\mdelete\s+from\s+\S*sessions\S*\s+where\s+\S*user_id\S*\s*=';
begin
  if not (v_others or v_all) then
    return null;
  end if;
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
  return null;
end $$;

create trigger guard_session_revocation after delete on auth.sessions
  referencing old table as gone
  for each statement execute function private.guard_session_revocation();

-- ---------------------------------------------------------------------------
-- Email: security notices and email-change codes
-- ---------------------------------------------------------------------------

-- New send-log types: the "method linked" security notice and email-change codes.
alter table private.email_sends drop constraint email_sends_type_check;
alter table private.email_sends add constraint email_sends_type_check
  check (type in ('code', 'no-account', 'method-linked', 'email-change'));

-- Replaces #88's lookup: an address reaches an account's sign-in codes only
-- while the account has the email-code method for it. 'other' is an account
-- that holds the address but signs in only with Apple or Google: it gets the
-- "No account for this address" email (which says to sign in with Apple or
-- Google instead), whichever way it was asked.
create or replace function public.email_code_recipient(address text) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when exists (
      select 1 from auth.users u
      join public.accounts a on a.auth_user_id = u.id
      join auth.identities i on i.user_id = u.id and i.provider = 'email'
      where lower(u.email) = lower(btrim(address)) and a.state <> 'deleted' and a.environment = private.environment()
    ) then 'account'
    when exists (
      select 1 from auth.users u join public.accounts a on a.auth_user_id = u.id
      where lower(u.email) = lower(btrim(address)) and a.state <> 'deleted' and a.environment = private.environment()
    ) then 'other'
    when exists (select 1 from auth.users u where lower(u.email) = lower(btrim(address))) then 'pending'
    else 'none'
  end
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke execute on function private.fresh_authentication_window() from public;
revoke execute on function private.session_fresh_identity(uuid, uuid) from public;
revoke execute on function private.caller_session() from public;
revoke execute on function private.fresh_identity() from public;
revoke execute on function private.require_fresh_authentication() from public;
revoke execute on function private.session_account(uuid, uuid) from public;
revoke execute on function private.session_has_ordinary_access(uuid, uuid) from public;
revoke execute on function private.keep_a_sign_in_method() from public;
revoke execute on function private.guard_auth_user_changes() from public;
revoke execute on function private.guard_session_revocation() from public;
grant execute on function private.require_fresh_authentication() to authenticated;

revoke execute on function public.caller_session_v1(), public.sign_in_methods_v1(), public.remove_sign_in_method_v1(uuid),
  public.authorize_email_change_v1(text), public.issue_proof_nonce_v1() from public, anon;
grant execute on function public.caller_session_v1(), public.sign_in_methods_v1(), public.remove_sign_in_method_v1(uuid),
  public.authorize_email_change_v1(text), public.issue_proof_nonce_v1() to authenticated;

revoke execute on function public.record_fresh_authentication(uuid, uuid, text, text), public.link_provider_identity(uuid, uuid, text, text, jsonb),
  public.email_method_address(uuid, uuid), public.link_email_identity(uuid, uuid), public.email_change_authorized(uuid, text),
  public.consume_proof_nonce(uuid, text)
  from public, anon, authenticated;
grant execute on function public.record_fresh_authentication(uuid, uuid, text, text), public.link_provider_identity(uuid, uuid, text, text, jsonb),
  public.email_method_address(uuid, uuid), public.link_email_identity(uuid, uuid), public.email_change_authorized(uuid, text),
  public.consume_proof_nonce(uuid, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Jobs
-- ---------------------------------------------------------------------------

-- Confirmations and authorizations past their window can never pass again.
create function private.expire_fresh_authentications() returns void
language sql security definer set search_path = '' as $$
  delete from private.fresh_authentications where authenticated_at <= now() - private.fresh_authentication_window();
  delete from private.email_change_authorizations where expires_at <= now();
  delete from private.proof_nonces where expires_at <= now();
$$;

select cron.schedule('expire-fresh-authentications', '*/15 * * * *', 'select private.expire_fresh_authentications()');
