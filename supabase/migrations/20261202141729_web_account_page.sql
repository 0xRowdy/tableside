-- The web account page (spec 2, #106; S2-24): a lifecycle-only page, reachable
-- without the app, where a player signs in with an email code, schedules or
-- cancels deletion, deletes permanently now and checks deletion status. It
-- uses the app's own operations and fresh-authentication rules; this adds
-- only what a browser needs that a device didn't:
--
-- - A browser registers its session like a device does, as platform 'web',
--   so it holds a status credential and can still show the deletion's
--   progress after the account is gone (deletion_progress_v1). Devices lists
--   it with the label it gave ("Web browser").
-- - When a signed-in visitor's browser sends Global Privacy Control, the
--   record-gpc function records the ad-data opt-out with source GPC
--   (Amendment 8 §5) through record_gpc_opt_out.

-- ---------------------------------------------------------------------------
-- A browser as a registered installation
-- ---------------------------------------------------------------------------

alter table private.installations drop constraint installations_platform_check;
alter table private.installations add constraint installations_platform_check check (platform in ('ios', 'android', 'web'));

-- #101's registration (20261124163517_devices_revocation.sql), now also taking
-- the web account page's browser (platform 'web').
create or replace function public.register_device_v1(installation text, secret text, platform text, label text) returns jsonb
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
  if coalesce(installation, '') !~ '^[A-Za-z0-9_-]{1,128}$' or coalesce(platform, '') not in ('ios', 'android', 'web') or v_label = ''
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

-- ---------------------------------------------------------------------------
-- Global Privacy Control
-- ---------------------------------------------------------------------------

-- For the record-gpc function, once it has seen the browser's Sec-GPC signal:
-- records the ad-data opt-out with source GPC for the session's account
-- (active or deletion scheduled, in any age state: an opt-out only
-- restricts). An account whose ad data is already limited, from any source,
-- keeps its choice as it is, so a visit never writes again.
--   'recorded' | 'already-limited' | 'not-signed-in'
create function public.record_gpc_opt_out(session uuid, auth_user uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_account uuid := private.session_account(session, auth_user);
begin
  if v_account is null then
    return jsonb_build_object('status', 'not-signed-in');
  end if;
  -- Serialized with the account's other privacy changes, as every authoritative change is.
  perform private.lock_sync_head(v_account);
  if exists (select 1 from private.privacy_choices c where c.account_id = v_account and c.ad_data_opt_out_source is not null) then
    return jsonb_build_object('status', 'already-limited');
  end if;
  perform private.record_ad_data_opt_out(v_account, 'gpc');
  return jsonb_build_object('status', 'recorded');
end $$;

revoke execute on function public.record_gpc_opt_out(uuid, uuid) from public, anon, authenticated;
grant execute on function public.record_gpc_opt_out(uuid, uuid) to service_role;
