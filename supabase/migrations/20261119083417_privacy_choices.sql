-- Privacy choices (spec 2 Amendment 8 §1, #105): the account-state record
-- spec 7's analytics and ad-data controls, support and the web account page
-- write to. The client half is packages/account/src/privacy.ts.
--
-- - Restrictive changes (withdraw analytics consent, limit ad data) are
--   queued on devices and always apply to the current state when they arrive,
--   so a late consent withdrawal from an offline device fails closed.
-- - Enabling changes (grant consent, allow ad data) are online only and name
--   the account's last privacy change they were made from (`basis`): refused
--   as stale when the choices changed since, so a stale device can't re-enable
--   a withdrawn choice or clear an opt-out.
-- - Each grant starts a new generation with its own analytics ID, drawn here
--   at random: never the account ID or email, and never chosen by a client.
-- - Consent is granted only to an established adult. The authorization gate
--   already denies an unresolved or ineligible account, and one with no
--   eligibility record, every sync operation; the acceptance refuses a teen.

-- The current choices: one row per account, from its first privacy change.
create table private.privacy_choices (
  account_id uuid primary key references public.accounts (account_id),
  analytics_consent text not null default 'never-granted'
    check (analytics_consent in ('never-granted', 'granted', 'withdrawn')),
  analytics_generation integer not null default 0 check (analytics_generation >= 0),
  -- The ad-data opt-out's source; null while ad data isn't limited.
  ad_data_opt_out_source text check (ad_data_opt_out_source in ('in-app', 'support', 'gpc')),
  -- The account sequence of the last privacy change: an enabling change's basis.
  last_sequence bigint not null default 0
);

-- Every analytics ID the account has had, one per generation: what export
-- lists (Amendment 8 §2) and what the deletion job asks the analytics
-- provider to erase, every one of them (Amendment 8 §3), so the job reads
-- them before it clears the account's rows.
create table private.analytics_ids (
  account_id uuid not null references public.accounts (account_id),
  generation integer not null check (generation >= 1),
  analytics_id text not null unique check (analytics_id ~ '^[0-9a-f]{32}$'),
  primary key (account_id, generation)
);

revoke all on private.privacy_choices, private.analytics_ids from public, anon, authenticated;

-- Applies one privacy change to the account's choices, as the account's
-- change at `p_sequence`, and returns the change as accepted (a grant with its
-- generation and new analytics ID), or a refusal code. Called with the
-- account's synchronization head held, so changes apply in sequence order.
create function private.apply_privacy_choice(p_account uuid, p_choice text, p_change jsonb, p_sequence bigint) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_current private.privacy_choices;
  v_kind text := p_change ->> 'change';
  v_id text;
  v_record jsonb := jsonb_build_object('version', 1, 'choiceId', p_choice, 'change', v_kind);
begin
  insert into private.privacy_choices (account_id) values (p_account) on conflict do nothing;
  select * into v_current from private.privacy_choices where account_id = p_account for update;
  -- Only an established adult may grant consent, whatever it was made from.
  if v_kind = 'grant-analytics' and private.account_eligibility(p_account) is distinct from 'adult' then
    return jsonb_build_object('code', 'not-eligible');
  end if;
  if v_kind in ('grant-analytics', 'allow-ad-data') and (p_change ->> 'basis')::bigint is distinct from v_current.last_sequence then
    return jsonb_build_object('code', 'stale');
  end if;
  case v_kind
    when 'withdraw-analytics' then
      update private.privacy_choices
        set analytics_consent = case when analytics_consent = 'granted' then 'withdrawn' else analytics_consent end
        where account_id = p_account;
    when 'limit-ad-data' then
      update private.privacy_choices set ad_data_opt_out_source = p_change ->> 'source' where account_id = p_account;
      v_record := v_record || jsonb_build_object('source', p_change ->> 'source');
    when 'grant-analytics' then
      if v_current.analytics_consent = 'granted' then
        return jsonb_build_object('code', 'unchanged');
      end if;
      v_id := encode(extensions.gen_random_bytes(16), 'hex');
      insert into private.analytics_ids (account_id, generation, analytics_id)
        values (p_account, v_current.analytics_generation + 1, v_id);
      update private.privacy_choices
        set analytics_consent = 'granted', analytics_generation = analytics_generation + 1
        where account_id = p_account;
      v_record := v_record || jsonb_build_object('generation', v_current.analytics_generation + 1, 'analyticsId', v_id);
    when 'allow-ad-data' then
      if v_current.ad_data_opt_out_source is null then
        return jsonb_build_object('code', 'unchanged');
      end if;
      update private.privacy_choices set ad_data_opt_out_source = null where account_id = p_account;
  end case;
  update private.privacy_choices set last_sequence = p_sequence where account_id = p_account;
  return jsonb_build_object('record', v_record);
end $$;

-- A device's privacy change (protocol 1, through sync_upload_v1). A device
-- may only limit ad data with source 'in-app': support and GPC write through
-- private.record_ad_data_opt_out. A grant names no generation or ID: both are
-- the server's.
create function private.accept_privacy_choice_v1(p_account uuid, p_request jsonb, p_sequence bigint) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_payload jsonb := p_request -> 'payload';
  v_kind text := v_payload ->> 'change';
  v_keys text[];
  v_shaped boolean;
  v_applied jsonb;
begin
  if jsonb_typeof(v_payload) is distinct from 'object' then
    return jsonb_build_object('status', 'rejected', 'code', 'invalid-payload');
  end if;
  select array_agg(k order by k) into v_keys from jsonb_object_keys(v_payload) k;
  -- Exactly the change's keys; an enabling change's basis is an account sequence.
  v_shaped := case
    when v_kind = 'withdraw-analytics' then v_keys = array['change', 'choiceId', 'version']
    when v_kind = 'limit-ad-data' then v_keys = array['change', 'choiceId', 'source', 'version'] and (v_payload ->> 'source') = 'in-app'
    when v_kind in ('grant-analytics', 'allow-ad-data') then v_keys = array['basis', 'change', 'choiceId', 'version']
      and jsonb_typeof(v_payload -> 'basis') = 'number' and (v_payload ->> 'basis') ~ '^(0|[1-9][0-9]{0,14})$'
    else false
  end;
  if not v_shaped or (v_payload ->> 'version') is distinct from '1'
    or jsonb_typeof(v_payload -> 'choiceId') is distinct from 'string'
    or (v_payload ->> 'choiceId') is distinct from (p_request ->> 'item')
    or (v_payload ->> 'choiceId') !~ '^[0-9a-f]{32}$' then
    return jsonb_build_object('status', 'rejected', 'code', 'invalid-payload');
  end if;
  v_applied := private.apply_privacy_choice(p_account, p_request ->> 'item', v_payload, p_sequence);
  if v_applied ? 'code' then
    return jsonb_build_object('status', 'rejected', 'code', v_applied ->> 'code');
  end if;
  return jsonb_build_object('status', 'accepted', 'change', v_applied);
end $$;

-- The ad-data opt-out from support or from the web account page's Global
-- Privacy Control (Amendment 8 §5; #106 calls it for a signed-in visitor
-- whose browser sends GPC). Privileged: no client can call it. It takes the
-- account's synchronization head first, as every authoritative change does,
-- and reaches every device through the feed. Returns the change's sequence.
-- (Not private.author_server_state, which writes only server-authored types:
-- this type is also written by devices.)
create function private.record_ad_data_opt_out(p_account uuid, p_source text) returns bigint
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_head bigint;
  v_choice text := encode(extensions.gen_random_bytes(16), 'hex');
  v_applied jsonb;
begin
  if p_source is null or p_source not in ('support', 'gpc') then
    raise exception 'unknown ad-data opt-out source' using errcode = '22023';
  end if;
  insert into private.sync_heads (account_id)
    select account_id from public.accounts where account_id = p_account and state <> 'deleted'
    on conflict do nothing;
  select sequence into v_head from private.sync_heads where account_id = p_account for update;
  if not found or not exists (select 1 from public.accounts where account_id = p_account and state <> 'deleted') then
    raise exception 'no such account' using errcode = '22023';
  end if;
  v_applied := private.apply_privacy_choice(p_account, v_choice,
    jsonb_build_object('change', 'limit-ad-data', 'source', p_source), v_head + 1);
  update private.sync_heads set sequence = v_head + 1 where account_id = p_account;
  insert into private.sync_feed (account_id, sequence, record_type, item_id, change)
    values (p_account, v_head + 1, 'privacy-choice', v_choice, v_applied);
  perform realtime.send('{}'::jsonb, 'account-changed', 'account:' || p_account::text, true);
  return v_head + 1;
end $$;

revoke execute on function private.apply_privacy_choice(uuid, text, jsonb, bigint), private.accept_privacy_choice_v1(uuid, jsonb, bigint),
  private.record_ad_data_opt_out(uuid, text) from public;

insert into private.record_types (record_type, payload_version, kind, accept, ordering)
  values ('privacy-choice', 1, 'account-state-operation', 'private.accept_privacy_choice_v1(uuid,jsonb,bigint)'::regprocedure, 'account');
