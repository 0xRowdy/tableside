-- Apple and Google grant revocation at permanent deletion (spec 2,
-- *Deletion*: "Revoke the Sign in with Apple token and the appropriate Google
-- grant, then remove the Auth identity"; #52 review, from #104).
--
-- When a provider gives the app an authorization code at sign-in, Create or
-- linking, the provider-grant function exchanges it for the provider's
-- revocable credential (a refresh token) and keeps it here, sealed: the
-- function encrypts it with a key only the functions hold
-- (TABLESIDE_PROVIDER_GRANT_KEY), so the database never sees it in the clear.
-- One per identity, replaced by the next. At the irreversible boundary the
-- deletion job's providers step unseals and revokes each, then the Auth
-- identity goes. An identity with no grant held (a flow that gives no code,
-- such as Google's native ID-token sign-in on Android) is reported as a
-- provider exception, never as revoked.

create table private.provider_grants (
  account_id uuid not null references public.accounts (account_id),
  provider text not null check (provider ~ '^[a-z]+$'),
  subject text not null check (length(subject) between 1 and 255),
  sealed text not null check (length(sealed) between 1 and 8192),
  captured_at timestamptz not null default now(),
  primary key (account_id, provider, subject)
);

revoke all on private.provider_grants from public, anon, authenticated;

insert into private.retention_rules (subject, endpoint, dependency, owner) values
  ('private.provider_grants',
   'A sign-in identity''s sealed provider grant: replaced at its next capture, and revoked and removed at the permanent deletion''s providers step (#104).',
   null, null);

-- For the provider-grant function: keeps the sealed grant for one of the
-- session's own Apple or Google identities, replacing the last.
--   'held' | 'not-a-method' (not one of this account's identities) | 'not-signed-in'
create function public.store_provider_grant(session uuid, auth_user uuid, provider text, subject text, sealed text) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_account uuid := private.session_account(session, auth_user);
begin
  if v_account is null then
    return 'not-signed-in';
  end if;
  if coalesce(provider, '') in ('', 'email') or not exists (
    select 1 from auth.identities i where i.user_id = auth_user and i.provider = store_provider_grant.provider and i.provider_id = subject) then
    return 'not-a-method';
  end if;
  insert into private.provider_grants (account_id, provider, subject, sealed)
    values (v_account, provider, subject, sealed)
    on conflict on constraint provider_grants_pkey do update set sealed = excluded.sealed, captured_at = now();
  return 'held';
end $$;

revoke execute on function public.store_provider_grant(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.store_provider_grant(uuid, uuid, text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- The deletion's providers step
-- ---------------------------------------------------------------------------

-- #104's step (20261201103842_permanent_deletion.sql), now naming each
-- identity's sealed grant, and every identity other than the email code's
-- (a local stack's test identity provider stands in for Apple and Google).
-- A grant whose identity was unlinked since is revoked too.
create or replace function public.advance_deletion(account uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v private.deletions;
  v_user uuid;
  v_ids jsonb;
begin
  select * into v from private.deletions d where d.account_id = advance_deletion.account for update skip locked;
  if not found then
    return jsonb_build_object('step', 'busy');
  end if;
  if v.completed_at is not null then
    return jsonb_build_object('step', 'complete');
  end if;
  if v.leased_until > now() or v.retry_at > now() then
    return jsonb_build_object('step', 'busy');
  end if;
  v_user := (select auth_user_id from public.accounts where account_id = v.account_id);
  if v.mail_sent_at is null then
    update private.deletions set leased_until = now() + private.deletion_step_lease() where account_id = v.account_id;
    return jsonb_build_object('step', 'mail', 'email', (select u.email from auth.users u where u.id = v_user), 'cleanupBy', v.cleanup_by);
  end if;
  if v.exports_removed_at is null then
    if exists (select 1 from private.exports e where e.account_id = v.account_id and e.object_pending) then
      perform private.wake_export_job();
      return jsonb_build_object('step', 'waiting');
    end if;
    delete from private.exports where account_id = v.account_id;
    update private.deletions set exports_removed_at = now(), failures = 0 where account_id = v.account_id;
  end if;
  if v.objects_removed_at is null then
    select coalesce(jsonb_agg(o.name), '[]'::jsonb) into v_ids
      from (select name from storage.objects
            where bucket_id = 'account-private' and (storage.foldername(name))[1] = v.account_id::text
            order by name limit 100) o;
    if jsonb_array_length(v_ids) > 0 then
      update private.deletions set leased_until = now() + private.deletion_step_lease() where account_id = v.account_id;
      return jsonb_build_object('step', 'objects', 'paths', v_ids);
    end if;
    update private.deletions set objects_removed_at = now(), failures = 0 where account_id = v.account_id;
  end if;
  if v.analytics_requested_at is null then
    select coalesce(jsonb_agg(i.analytics_id order by i.generation), '[]'::jsonb) into v_ids
      from private.analytics_ids i where i.account_id = v.account_id;
    if jsonb_array_length(v_ids) = 0 then
      update private.deletions set analytics_requested_at = now(), analytics_ids = 0, analytics_completed_at = now(), failures = 0
        where account_id = v.account_id;
    else
      update private.deletions set leased_until = now() + private.deletion_step_lease() where account_id = v.account_id;
      return jsonb_build_object('step', 'analytics', 'ids', v_ids);
    end if;
  end if;
  if v.purchases_cleaned_at is null then
    perform private.purchase_cleanup(v.account_id);
    update private.deletions set leased_until = now() + private.deletion_step_lease() where account_id = v.account_id;
    return jsonb_build_object('step', 'purchases', 'customer', v.account_id);
  end if;
  if v.public_content_removed_at is null then
    perform private.remove_public_content(v.account_id);
    update private.deletions set public_content_removed_at = now(), failures = 0 where account_id = v.account_id;
  end if;
  if v.records_purged_at is null then
    perform private.purge_account_records(v.account_id);
    update private.deletions set records_purged_at = now(), failures = 0 where account_id = v.account_id;
  end if;
  if v.providers_revoked_at is null then
    select coalesce(jsonb_agg(jsonb_build_object('provider', x.provider, 'subject', x.subject, 'sealed', x.sealed) order by x.provider, x.subject), '[]'::jsonb)
      into v_ids
      from (
        select i.provider, i.provider_id as subject, g.sealed
          from auth.identities i
          left join private.provider_grants g on g.account_id = v.account_id and g.provider = i.provider and g.subject = i.provider_id
          where i.user_id = v_user and i.provider <> 'email'
        union
        select g.provider, g.subject, g.sealed from private.provider_grants g
          where g.account_id = v.account_id
            and not exists (select 1 from auth.identities i where i.user_id = v_user and i.provider = g.provider and i.provider_id = g.subject)
      ) x;
    if jsonb_array_length(v_ids) = 0 then
      update private.deletions set providers_revoked_at = now(), providers_outcome = 'none', failures = 0 where account_id = v.account_id;
    else
      update private.deletions set leased_until = now() + private.deletion_step_lease() where account_id = v.account_id;
      return jsonb_build_object('step', 'providers', 'identities', v_ids);
    end if;
  end if;
  perform private.remove_account_identity(v.account_id);
  update private.deletions set completed_at = now(), failures = 0, retry_at = null, leased_until = null where account_id = v.account_id;
  return jsonb_build_object('step', 'complete');
end $$;

-- #104's report (20261201103842_permanent_deletion.sql); the providers step now
-- also removes the sealed grants it dealt with.
create or replace function public.deletion_step_done(account uuid, step text, outcome jsonb default '{}'::jsonb) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v private.deletions;
begin
  select * into v from private.deletions d where d.account_id = deletion_step_done.account for update;
  if not found or v.completed_at is not null then
    return;
  end if;
  if step = 'mail' and v.mail_sent_at is null then
    update private.deletions set mail_sent_at = now() where account_id = v.account_id;
  elsif step = 'objects' and v.exports_removed_at is not null and v.objects_removed_at is null then
    -- A page is gone; the next advance looks again, and marks the step once none is left.
    null;
  elsif step = 'analytics' and v.objects_removed_at is not null and v.analytics_requested_at is null then
    update private.deletions
      set analytics_requested_at = now(),
          analytics_ids = (select count(*) from private.analytics_ids i where i.account_id = v.account_id),
          analytics_completed_at = case when (outcome ->> 'completed')::boolean then now() end
      where account_id = v.account_id;
    delete from private.analytics_ids where account_id = v.account_id;
  elsif step = 'purchases' and v.analytics_requested_at is not null and v.purchases_cleaned_at is null then
    update private.deletions set purchases_cleaned_at = now() where account_id = v.account_id;
  elsif step = 'providers' and v.records_purged_at is not null and v.providers_revoked_at is null
    and outcome ->> 'outcome' in ('revoked', 'not-held') then
    update private.deletions set providers_revoked_at = now(), providers_outcome = outcome ->> 'outcome' where account_id = v.account_id;
    delete from private.provider_grants where account_id = v.account_id;
  else
    return;
  end if;
  update private.deletions set failures = 0, retry_at = null, leased_until = null where account_id = v.account_id;
end $$;

-- ---------------------------------------------------------------------------
-- Apple's web flow keeps its authorization code too
-- ---------------------------------------------------------------------------

-- The code Apple posts with the ID token (response_type 'code id_token'), kept
-- with it for the app to collect once, like the token, and exchange for a grant.
alter table private.provider_flows add column code text check (code is null or length(code) between 1 and 2048);

-- #89's store (20261117000000_provider_sign_in.sql), with the code.
create function public.store_provider_flow(challenge text, id_token text, code text) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
begin
  if challenge !~ '^[0-9a-f]{64}$' or coalesce(id_token, '') = '' then
    return false;
  end if;
  insert into private.provider_flows (challenge, id_token, code, expires_at)
    values (decode(challenge, 'hex'), id_token, nullif(code, ''), now() + interval '5 minutes')
    on conflict do nothing;
  return found;
end $$;

-- The app collecting its flow's ID token and code, once, with the verifier:
-- { idToken, code } (code null when the provider sent none), or null. (Not
-- named *_v2: that names a sync protocol's operations, which the pre-request
-- hook serves by protocol.)
create function public.redeem_provider_flow_code(verifier text) returns jsonb
language sql volatile security definer set search_path = '' as $$
  with redeemed as (
    delete from private.provider_flows
    where challenge = extensions.digest(coalesce(verifier, ''), 'sha256') and expires_at > now()
    returning id_token, code
  )
  select jsonb_build_object('idToken', id_token, 'code', code) from redeemed
$$;

revoke execute on function public.store_provider_flow(text, text, text) from public, anon, authenticated;
grant execute on function public.store_provider_flow(text, text, text) to service_role;
revoke execute on function public.redeem_provider_flow_code(text) from public;
grant execute on function public.redeem_provider_flow_code(text) to anon, authenticated;
