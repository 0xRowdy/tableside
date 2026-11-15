-- Apple and Google sign-in (spec 2, #89; Amendment 3 §1). Sign in never
-- creates an account: Auth's before-user-created hook refuses a new provider
-- identity that has no eligibility assertion bound to it, so a Sign in that
-- finds no account leaves no Auth user. Create runs the age step, and the
-- bind-provider-assertion function, having verified the provider's ID token
-- itself, binds the single-use assertion to that one identity (provider and
-- subject). Auth then creates the user for that identity only, and the insert
-- trigger consumes the assertion in the same transaction.
--
-- A provider sign-up can't carry the assertion in user metadata as an email
-- Create does: Auth fills a provider user's metadata from the ID token's
-- claims, which the app doesn't control. The hook and trigger see the token's
-- subject there (user_metadata.sub) and the provider in app_metadata.

-- ---------------------------------------------------------------------------
-- Assertions bound to a provider identity
-- ---------------------------------------------------------------------------

-- A bound assertion can create only that identity's Auth user, and never an
-- email account. `consumed_by` records which Auth user used it, so the client
-- can tell a new account from an existing one Auth returned (verified
-- same-email linking) without comparing emails.
alter table private.eligibility_assertions
  add column provider text,
  add column provider_subject text,
  add column consumed_by uuid,
  add constraint eligibility_assertions_bound check ((provider is null) = (provider_subject is null));

create index eligibility_assertions_identity on private.eligibility_assertions (provider, provider_subject)
  where provider is not null and consumed_at is null;

-- Binds an assertion to a provider identity, for the bind-provider-assertion
-- function after it has verified the identity's ID token:
--   'existing'  the identity already has an Auth user, so Create signs in instead (nothing bound)
--   'bound'     the assertion now covers this identity, and only it (binding it again to the same identity is a no-op)
--   'unusable'  no such assertion, or it is used, expired or bound to another identity
create function public.bind_provider_assertion(assertion text, provider text, subject text) returns text
language plpgsql volatile security definer set search_path = '' as $$
begin
  if coalesce(provider, '') = '' or coalesce(subject, '') = '' then
    return 'unusable';
  end if;
  if exists (select 1 from auth.identities i where i.provider = bind_provider_assertion.provider and i.provider_id = subject) then
    return 'existing';
  end if;
  update private.eligibility_assertions a
    set provider = bind_provider_assertion.provider, provider_subject = subject
    where a.token_hash = extensions.digest(coalesce(assertion, ''), 'sha256')
      and a.consumed_at is null
      and a.expires_at > now()
      and (a.provider is null or (a.provider = bind_provider_assertion.provider and a.provider_subject = subject));
  return case when found then 'bound' else 'unusable' end;
end $$;

-- Whether the caller's Auth user was created with this assertion: true only
-- for the account a Create just made, never for one Auth returned.
create function public.account_created_by(assertion text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from private.eligibility_assertions a
    where a.token_hash = extensions.digest(coalesce(assertion, ''), 'sha256')
      and a.consumed_by = auth.uid()
      and private.active_account() is not null
  )
$$;

-- ---------------------------------------------------------------------------
-- Auth's hook and the insert trigger, now covering provider identities
-- ---------------------------------------------------------------------------

-- Replaces #84's hook. An email sign-up still needs an unbound assertion in
-- its metadata; a provider sign-up needs one bound to its identity, and
-- nothing in its token's claims can stand in for that.
create or replace function private.before_user_created(event jsonb) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case
    when coalesce(event #>> '{user,app_metadata,provider}', 'email') = 'email' and exists (
      select 1 from private.eligibility_assertions
      where token_hash = extensions.digest(coalesce(event #>> '{user,user_metadata,eligibility_assertion}', ''), 'sha256')
        and provider is null
        and consumed_at is null
        and expires_at > now()
    ) then '{}'::jsonb
    when coalesce(event #>> '{user,app_metadata,provider}', 'email') <> 'email' and exists (
      select 1 from private.eligibility_assertions
      where provider = event #>> '{user,app_metadata,provider}'
        and provider_subject = coalesce(event #>> '{user,user_metadata,sub}', event #>> '{user,user_metadata,provider_id}')
        and consumed_at is null
        and expires_at > now()
    ) then '{}'::jsonb
    else jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'eligibility_assertion_required'))
  end
$$;

-- Replaces #87's trigger (as #99 left it, holding the assertion's currency
-- beside its band), in the same transaction as the Auth user insert.
-- An email sign-up consumes the unbound assertion in its metadata and must
-- name this environment. A provider sign-up consumes the newest assertion
-- bound to its identity; its environment was checked when the assertion was
-- bound (the bind request named it, and the pre-request hook refuses another).
create or replace function private.consume_eligibility_assertion() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_band text;
  v_currency text;
  v_provider text := coalesce(new.raw_app_meta_data ->> 'provider', 'email');
begin
  if v_provider = 'email' then
    if (new.raw_user_meta_data ->> 'environment') is distinct from private.environment() then
      raise exception 'environment_mismatch' using errcode = '42501';
    end if;
    update private.eligibility_assertions
      set consumed_at = now(), consumed_by = new.id
      where token_hash = extensions.digest(coalesce(new.raw_user_meta_data ->> 'eligibility_assertion', ''), 'sha256')
        and provider is null
        and consumed_at is null
        and expires_at > now()
      returning band, currency into v_band, v_currency;
  else
    update private.eligibility_assertions
      set consumed_at = now(), consumed_by = new.id
      where token_hash = (
        select token_hash from private.eligibility_assertions
        where provider = v_provider
          and provider_subject = coalesce(new.raw_user_meta_data ->> 'sub', new.raw_user_meta_data ->> 'provider_id')
          and consumed_at is null
          and expires_at > now()
        order by expires_at desc
        limit 1
        for update
      )
      returning band, currency into v_band, v_currency;
  end if;
  if v_band is null then
    raise exception 'eligibility assertion required' using errcode = '42501';
  end if;
  insert into private.pending_eligibility (auth_user_id, band, currency) values (new.id, v_band, v_currency);
  return new;
end $$;

-- Replaces #88's check: an assertion bound to a provider identity never
-- covers an email Create.
create or replace function public.eligibility_assertion_usable(assertion text, address text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from private.eligibility_assertions a
    where a.token_hash = extensions.digest(coalesce(assertion, ''), 'sha256')
      and a.provider is null
      and a.expires_at > now()
      and (
        a.consumed_at is null
        or exists (
          select 1 from auth.users u
          where lower(u.email) = lower(btrim(address)) and u.raw_user_meta_data ->> 'eligibility_assertion' = assertion
        )
      )
  )
$$;

-- Replaces #88's renewal (as #99 left it, bringing the newest Create's
-- currency) the same way: only an unbound assertion renews a pending email Create.
create or replace function public.renew_pending_eligibility(address text, assertion text) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user uuid;
  v_made_by text;
  v_band text;
  v_currency text;
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
    set consumed_at = now(), consumed_by = v_user
    where token_hash = extensions.digest(coalesce(assertion, ''), 'sha256') and provider is null and consumed_at is null and expires_at > now()
    returning band, currency into v_band, v_currency;
  if v_band is null then
    return false;
  end if;
  update private.pending_eligibility set band = v_band, currency = v_currency where auth_user_id = v_user;
  update auth.users set raw_user_meta_data = raw_user_meta_data || jsonb_build_object('eligibility_assertion', assertion) where id = v_user;
  return true;
end $$;

-- ---------------------------------------------------------------------------
-- Apple's web flow (Android): the callback, bound to the request that began it
-- ---------------------------------------------------------------------------

-- Apple posts its answer to the provider-callback function, which keeps the
-- verified ID token here under the flow's challenge (the SHA-256 of a verifier
-- only the initiating app holds) and redirects the browser back to the app
-- with the state alone. The app redeems the token once with the verifier, so
-- an intercepted redirect, or a logged URL, can't collect it.
create table private.provider_flows (
  challenge bytea primary key,
  id_token text not null,
  expires_at timestamptz not null
);

-- For the provider-callback function. A challenge is stored once: a replayed
-- callback for the same flow changes nothing.
create function public.store_provider_flow(challenge text, id_token text) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
begin
  if challenge !~ '^[0-9a-f]{64}$' or coalesce(id_token, '') = '' then
    return false;
  end if;
  insert into private.provider_flows (challenge, id_token, expires_at)
    values (decode(challenge, 'hex'), id_token, now() + interval '5 minutes')
    on conflict do nothing;
  return found;
end $$;

-- The app collecting its flow's ID token, once, with the verifier.
create function public.redeem_provider_flow(verifier text) returns text
language sql volatile security definer set search_path = '' as $$
  delete from private.provider_flows
  where challenge = extensions.digest(coalesce(verifier, ''), 'sha256') and expires_at > now()
  returning id_token
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke execute on function public.bind_provider_assertion(text, text, text) from public, anon, authenticated;
revoke execute on function public.store_provider_flow(text, text) from public, anon, authenticated;
revoke execute on function public.redeem_provider_flow(text) from public;
revoke execute on function public.account_created_by(text) from public, anon;
grant execute on function public.bind_provider_assertion(text, text, text) to service_role;
grant execute on function public.store_provider_flow(text, text) to service_role;
grant execute on function public.redeem_provider_flow(text) to anon, authenticated;
grant execute on function public.account_created_by(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Jobs
-- ---------------------------------------------------------------------------

-- An unredeemed flow's token can go once it can no longer be redeemed.
create function private.expire_provider_flows() returns void
language sql security definer set search_path = '' as $$
  delete from private.provider_flows where expires_at <= now()
$$;

select cron.schedule('expire-provider-flows', '*/5 * * * *', 'select private.expire_provider_flows()');
