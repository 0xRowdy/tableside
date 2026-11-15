-- Test-only record types (seam 2, spec 2 *Testing Decisions › Registry*): the
-- server half of packages/account/src/testing/record-types.ts. They stand in
-- for later specs' types so the platform's kinds are proven here: spec 6's
-- sharing withdrawal and contributions, spec 5's allowance reconciliation and
-- transfer, spec 4's practice-session deletion (a purge), spec 3's challenge
-- attempts (per-device) and spec 5's experiment assignment (server-authored).
--
-- Never a migration: the harness installs this on the local stack only
-- (idempotently), so no beta or production project ever registers them.

create table if not exists private.test_sharing_withdrawals (
  account_id uuid not null references public.accounts (account_id),
  sharing_withdrawal_id text not null,
  scope text not null,
  primary key (account_id, sharing_withdrawal_id)
);
create table if not exists private.test_contributions (
  account_id uuid not null references public.accounts (account_id),
  contribution_id text not null,
  scope text not null,
  primary key (account_id, contribution_id)
);
create table if not exists private.test_reconciliations (
  account_id uuid not null references public.accounts (account_id),
  reconciliation_id text not null,
  grant_id text not null,
  primary key (account_id, reconciliation_id)
);
create table if not exists private.test_transfers (
  account_id uuid not null references public.accounts (account_id),
  transfer_id text not null,
  grant_id text not null,
  primary key (account_id, transfer_id)
);
-- A result's summary, its detail, and the account total it contributes to.
create table if not exists private.test_results (
  account_id uuid not null references public.accounts (account_id),
  result_id text not null,
  payload jsonb not null,
  primary key (account_id, result_id)
);
create table if not exists private.test_result_details (
  account_id uuid not null references public.accounts (account_id),
  result_id text not null,
  detail text not null,
  primary key (account_id, result_id)
);
create table if not exists private.test_totals (
  account_id uuid primary key references public.accounts (account_id),
  total bigint not null
);
create table if not exists private.test_attempts (
  account_id uuid not null references public.accounts (account_id),
  attempt_id text not null,
  payload jsonb not null,
  primary key (account_id, attempt_id)
);
create table if not exists private.test_experiment_assignments (
  account_id uuid not null references public.accounts (account_id),
  experiment text not null,
  assignment text not null,
  primary key (account_id, experiment)
);
revoke all on private.test_sharing_withdrawals, private.test_contributions, private.test_reconciliations, private.test_transfers,
  private.test_results, private.test_result_details, private.test_totals, private.test_attempts,
  private.test_experiment_assignments from public, anon, authenticated;

-- Whether the request's payload is an object whose `key` is the item, at version 1.
create or replace function private.test_payload_names_item(p_request jsonb, p_key text) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(p_request -> 'payload') = 'object'
    and (p_request #>> '{payload,version}') = '1'
    and (p_request #>> array['payload', p_key]) is not distinct from (p_request ->> 'item')
$$;

-- Sharing withdrawal (spec 6 stand-in): takes effect for its scope.
create or replace function private.accept_test_sharing_withdrawal_v1(p_account uuid, p_request jsonb, p_sequence bigint) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not private.test_payload_names_item(p_request, 'sharingWithdrawalId') or jsonb_typeof(p_request #> '{payload,scope}') is distinct from 'string' then
    return jsonb_build_object('status', 'rejected', 'code', 'invalid-payload');
  end if;
  insert into private.test_sharing_withdrawals values (p_account, p_request ->> 'item', p_request #>> '{payload,scope}');
  return jsonb_build_object('status', 'accepted', 'change', jsonb_build_object('record', p_request -> 'payload'));
end $$;

-- Public contribution (spec 6 stand-in): refused once its scope is withdrawn.
-- Serialized with sharing withdrawals under the head, so it sees every accepted one.
create or replace function private.accept_test_contribution_v1(p_account uuid, p_request jsonb, p_sequence bigint) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not private.test_payload_names_item(p_request, 'contributionId') or jsonb_typeof(p_request #> '{payload,scope}') is distinct from 'string' then
    return jsonb_build_object('status', 'rejected', 'code', 'invalid-payload');
  end if;
  if exists (select 1 from private.test_sharing_withdrawals where account_id = p_account and scope = p_request #>> '{payload,scope}') then
    return jsonb_build_object('status', 'rejected', 'code', 'sharing-withdrawn');
  end if;
  insert into private.test_contributions values (p_account, p_request ->> 'item', p_request #>> '{payload,scope}');
  return jsonb_build_object('status', 'accepted', 'change', jsonb_build_object('record', p_request -> 'payload'));
end $$;

-- Allowance reconciliation (spec 5 stand-in): the original device reports its grant's usage.
create or replace function private.accept_test_allowance_reconciliation_v1(p_account uuid, p_request jsonb, p_sequence bigint) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not private.test_payload_names_item(p_request, 'reconciliationId') or jsonb_typeof(p_request #> '{payload,grant}') is distinct from 'string' then
    return jsonb_build_object('status', 'rejected', 'code', 'invalid-payload');
  end if;
  insert into private.test_reconciliations values (p_account, p_request ->> 'item', p_request #>> '{payload,grant}');
  return jsonb_build_object('status', 'accepted', 'change', jsonb_build_object('record', p_request -> 'payload'));
end $$;

-- Allowance transfer (spec 5 stand-in): only once its grant is reconciled.
create or replace function private.accept_test_allowance_transfer_v1(p_account uuid, p_request jsonb, p_sequence bigint) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not private.test_payload_names_item(p_request, 'transferId') or jsonb_typeof(p_request #> '{payload,grant}') is distinct from 'string' then
    return jsonb_build_object('status', 'rejected', 'code', 'invalid-payload');
  end if;
  if not exists (select 1 from private.test_reconciliations where account_id = p_account and grant_id = p_request #>> '{payload,grant}') then
    return jsonb_build_object('status', 'rejected', 'code', 'unreconciled');
  end if;
  insert into private.test_transfers values (p_account, p_request ->> 'item', p_request #>> '{payload,grant}');
  return jsonb_build_object('status', 'accepted', 'change', jsonb_build_object('record', p_request -> 'payload'));
end $$;

-- An immutable result with a summary, a detail and a contribution to the account total.
create or replace function private.accept_test_result_v1(p_account uuid, p_request jsonb, p_sequence bigint) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_payload jsonb := p_request -> 'payload';
  v_existing jsonb;
begin
  if not private.test_payload_names_item(p_request, 'resultId')
    or jsonb_typeof(v_payload -> 'amount') is distinct from 'number' or jsonb_typeof(v_payload -> 'detail') is distinct from 'string' then
    return jsonb_build_object('status', 'rejected', 'code', 'invalid-payload');
  end if;
  select payload into v_existing from private.test_results where account_id = p_account and result_id = p_request ->> 'item';
  if found then
    return case when v_existing = v_payload
      then jsonb_build_object('status', 'accepted', 'sequence', (select sequence from private.sync_feed
             where account_id = p_account and record_type = 'test-result' and item_id = p_request ->> 'item' order by sequence limit 1))
      else jsonb_build_object('status', 'rejected', 'code', 'identity-reused') end;
  end if;
  insert into private.test_results values (p_account, p_request ->> 'item', v_payload - 'detail');
  insert into private.test_result_details values (p_account, p_request ->> 'item', v_payload ->> 'detail');
  insert into private.test_totals values (p_account, (v_payload ->> 'amount')::bigint)
    on conflict (account_id) do update set total = private.test_totals.total + excluded.total;
  return jsonb_build_object('status', 'accepted', 'change', jsonb_build_object('record', v_payload));
end $$;

-- Its purge hook: removes the summary, the detail and the contribution.
create or replace function private.purge_test_result(p_account uuid, p_item text) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_payload jsonb;
begin
  delete from private.test_results where account_id = p_account and result_id = p_item returning payload into v_payload;
  if v_payload is null then
    return false;
  end if;
  delete from private.test_result_details where account_id = p_account and result_id = p_item;
  update private.test_totals set total = total - (v_payload ->> 'amount')::bigint where account_id = p_account;
  return true;
end $$;

-- Purging a test result (spec 4's practice-session deletion stand-in).
create or replace function private.accept_test_result_purge_v1(p_account uuid, p_request jsonb, p_sequence bigint) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not private.test_payload_names_item(p_request, 'target') then
    return jsonb_build_object('status', 'rejected', 'code', 'invalid-payload');
  end if;
  return private.purge_result(p_account, 'test-result', p_request ->> 'item', p_sequence);
end $$;

-- A challenge attempt (spec 3 stand-in): per-device, so the platform holds its position.
create or replace function private.accept_test_attempt_v1(p_account uuid, p_request jsonb, p_sequence bigint) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not private.test_payload_names_item(p_request, 'attemptId') or jsonb_typeof(p_request #> '{payload,passed}') is distinct from 'boolean' then
    return jsonb_build_object('status', 'rejected', 'code', 'invalid-payload');
  end if;
  if exists (select 1 from private.test_attempts where account_id = p_account and attempt_id = p_request ->> 'item') then
    return jsonb_build_object('status', 'accepted', 'sequence', (select sequence from private.sync_feed
      where account_id = p_account and record_type = 'test-attempt' and item_id = p_request ->> 'item' order by sequence limit 1));
  end if;
  insert into private.test_attempts values (p_account, p_request ->> 'item', p_request -> 'payload');
  return jsonb_build_object('status', 'accepted', 'change', jsonb_build_object('record', p_request -> 'payload'));
end $$;

-- An experiment assignment (spec 5 stand-in), as a backend job writes it: the
-- feed entry first (it takes the head), then the state's own row.
create or replace function private.assign_test_experiment(p_account uuid, p_experiment text, p_group text) returns bigint
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_sequence bigint;
begin
  v_sequence := private.author_server_state(p_account, 'test-experiment-assignment', p_experiment,
    jsonb_build_object('record', jsonb_build_object('version', 1, 'experiment', p_experiment, 'group', p_group)));
  insert into private.test_experiment_assignments values (p_account, p_experiment, p_group)
    on conflict (account_id, experiment) do update set assignment = excluded.assignment;
  return v_sequence;
end $$;

revoke execute on function private.test_payload_names_item(jsonb, text), private.accept_test_sharing_withdrawal_v1(uuid, jsonb, bigint),
  private.accept_test_contribution_v1(uuid, jsonb, bigint), private.accept_test_allowance_reconciliation_v1(uuid, jsonb, bigint),
  private.accept_test_allowance_transfer_v1(uuid, jsonb, bigint), private.accept_test_result_v1(uuid, jsonb, bigint),
  private.purge_test_result(uuid, text), private.accept_test_result_purge_v1(uuid, jsonb, bigint),
  private.accept_test_attempt_v1(uuid, jsonb, bigint), private.assign_test_experiment(uuid, text, text) from public;

insert into private.record_types (record_type, payload_version, kind, accept, ordering, purge) values
  ('test-sharing-withdrawal', 1, 'account-state-operation', 'private.accept_test_sharing_withdrawal_v1(uuid,jsonb,bigint)', 'account', null),
  ('test-contribution', 1, 'account-state-operation', 'private.accept_test_contribution_v1(uuid,jsonb,bigint)', 'account', null),
  ('test-allowance-reconciliation', 1, 'account-state-operation', 'private.accept_test_allowance_reconciliation_v1(uuid,jsonb,bigint)', 'account', null),
  ('test-allowance-transfer', 1, 'account-state-operation', 'private.accept_test_allowance_transfer_v1(uuid,jsonb,bigint)', 'account', null),
  ('test-result', 1, 'immutable-result', 'private.accept_test_result_v1(uuid,jsonb,bigint)', 'account', 'private.purge_test_result(uuid,text)'),
  ('test-result-purge', 1, 'account-state-operation', 'private.accept_test_result_purge_v1(uuid,jsonb,bigint)', 'account', null),
  ('test-attempt', 1, 'immutable-result', 'private.accept_test_attempt_v1(uuid,jsonb,bigint)', 'per-device', null),
  ('test-experiment-assignment', 1, 'server-authored-state', null, 'account', null)
on conflict (record_type, payload_version) do update
  set kind = excluded.kind, accept = excluded.accept, ordering = excluded.ordering, purge = excluded.purge;
