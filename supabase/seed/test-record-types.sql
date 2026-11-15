-- Test-only record types (local stacks only; beta and production never run
-- seeds). Seam 2 proves the platform's behavior for each kind with these, so
-- the specs that register real types (spec 4's casino sessions and private
-- strategies) inherit it and test only their own rules. The client half is
-- packages/account/src/testing/record-types.ts.

-- A revisioned item shaped like a small casino session: a game, a real
-- currency and an exact net result, contributing to casino totals.
create function private.test_revisioned_item_valid_v1(p_value jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(p_value) = 'object'
    and (select count(*) from jsonb_object_keys(p_value)) = 3
    and jsonb_typeof(p_value -> 'game') = 'string'
    and coalesce(p_value ->> 'currency' ~ '^[A-Z]{3}$', false)
    and jsonb_typeof(p_value -> 'net') = 'string'
    and private.money_canonical(p_value ->> 'net')
$$;

create function private.accept_test_revisioned_item_v1(p_account uuid, p_request jsonb, p_sequence bigint) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
begin
  return private.accept_revisioned_item(p_account, p_request, p_sequence, to_regprocedure('private.test_revisioned_item_valid_v1(jsonb)'));
end $$;

create function private.contribution_test_revisioned_item(p_payload jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('total', 'casino', 'game', p_payload ->> 'game', 'currency', p_payload ->> 'currency', 'amount', p_payload ->> 'net')
$$;

-- The seed runs as one batch, so the names resolve when each insert runs, not when the batch is read.
insert into private.record_types (record_type, payload_version, kind, accept)
  values ('test-revisioned-item', 1, 'revisioned-item', to_regprocedure('private.accept_test_revisioned_item_v1(uuid,jsonb,bigint)'));
insert into private.record_contributions (record_type, contribute)
  values ('test-revisioned-item', to_regprocedure('private.contribution_test_revisioned_item(jsonb)'));

-- ---------------------------------------------------------------------------
-- Account-state operations, server-authored state, purges and per-device
-- ordering (#95): stand-ins for spec 6's sharing withdrawal and contributions,
-- spec 5's allowance reconciliation and transfer and experiment assignment,
-- spec 4's practice-session deletion (a purge) and spec 3's challenge attempts.
-- ---------------------------------------------------------------------------

create table private.test_sharing_withdrawals (
  account_id uuid not null references public.accounts (account_id),
  sharing_withdrawal_id text not null,
  scope text not null,
  primary key (account_id, sharing_withdrawal_id)
);
create table private.test_contributions (
  account_id uuid not null references public.accounts (account_id),
  contribution_id text not null,
  scope text not null,
  primary key (account_id, contribution_id)
);
create table private.test_reconciliations (
  account_id uuid not null references public.accounts (account_id),
  reconciliation_id text not null,
  grant_id text not null,
  primary key (account_id, reconciliation_id)
);
create table private.test_transfers (
  account_id uuid not null references public.accounts (account_id),
  transfer_id text not null,
  grant_id text not null,
  primary key (account_id, transfer_id)
);
-- A result's summary and its detail; it contributes to the account's practice total.
create table private.test_results (
  account_id uuid not null references public.accounts (account_id),
  result_id text not null,
  payload jsonb not null,
  primary key (account_id, result_id)
);
create table private.test_result_details (
  account_id uuid not null references public.accounts (account_id),
  result_id text not null,
  detail text not null,
  primary key (account_id, result_id)
);
create table private.test_attempts (
  account_id uuid not null references public.accounts (account_id),
  attempt_id text not null,
  payload jsonb not null,
  primary key (account_id, attempt_id)
);
create table private.test_experiment_assignments (
  account_id uuid not null references public.accounts (account_id),
  experiment text not null,
  assignment text not null,
  primary key (account_id, experiment)
);
revoke all on private.test_sharing_withdrawals, private.test_contributions, private.test_reconciliations, private.test_transfers,
  private.test_results, private.test_result_details, private.test_attempts,
  private.test_experiment_assignments from public, anon, authenticated;

-- Whether the request's payload is an object whose `key` is the item, at version 1.
create function private.test_payload_names_item(p_request jsonb, p_key text) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(p_request -> 'payload') = 'object'
    and (p_request #>> '{payload,version}') = '1'
    and (p_request #>> array['payload', p_key]) is not distinct from (p_request ->> 'item')
$$;

-- Sharing withdrawal (spec 6 stand-in): takes effect for its scope.
create function private.accept_test_sharing_withdrawal_v1(p_account uuid, p_request jsonb, p_sequence bigint) returns jsonb
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
create function private.accept_test_contribution_v1(p_account uuid, p_request jsonb, p_sequence bigint) returns jsonb
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
create function private.accept_test_allowance_reconciliation_v1(p_account uuid, p_request jsonb, p_sequence bigint) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not private.test_payload_names_item(p_request, 'reconciliationId') or jsonb_typeof(p_request #> '{payload,grant}') is distinct from 'string' then
    return jsonb_build_object('status', 'rejected', 'code', 'invalid-payload');
  end if;
  insert into private.test_reconciliations values (p_account, p_request ->> 'item', p_request #>> '{payload,grant}');
  return jsonb_build_object('status', 'accepted', 'change', jsonb_build_object('record', p_request -> 'payload'));
end $$;

-- Allowance transfer (spec 5 stand-in): only once its grant is reconciled.
create function private.accept_test_allowance_transfer_v1(p_account uuid, p_request jsonb, p_sequence bigint) returns jsonb
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

-- An immutable result with a summary, a detail and a contribution to the practice total.
create function private.accept_test_result_v1(p_account uuid, p_request jsonb, p_sequence bigint) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_payload jsonb := p_request -> 'payload';
  v_existing jsonb;
begin
  if not private.test_payload_names_item(p_request, 'resultId')
    or jsonb_typeof(v_payload -> 'amount') is distinct from 'string' or not private.money_canonical(v_payload ->> 'amount')
    or jsonb_typeof(v_payload -> 'detail') is distinct from 'string' then
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
  return jsonb_build_object('status', 'accepted', 'change', jsonb_build_object('record', v_payload));
end $$;

-- Its contribution, kept by a trigger on its accepted rows as #94's types are.
create function private.contribution_test_result(p_payload jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('total', 'practice', 'game', 'test', 'currency', 'simulated', 'amount', p_payload ->> 'amount')
$$;

create function private.test_results_contribution() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform private.apply_contribution(old.account_id, 'test-result', old.payload, -1);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform private.apply_contribution(new.account_id, 'test-result', new.payload, 1);
  end if;
  return null;
end $$;

create trigger test_results_contribution after insert or update or delete on private.test_results
  for each row execute function private.test_results_contribution();

-- Its purge hook: removes the summary (and with it the contribution) and the detail.
create function private.purge_test_result(p_account uuid, p_item text) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
begin
  delete from private.test_results where account_id = p_account and result_id = p_item;
  if not found then
    return false;
  end if;
  delete from private.test_result_details where account_id = p_account and result_id = p_item;
  return true;
end $$;

-- Purging a test result (spec 4's practice-session deletion stand-in).
create function private.accept_test_result_purge_v1(p_account uuid, p_request jsonb, p_sequence bigint) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not private.test_payload_names_item(p_request, 'target') then
    return jsonb_build_object('status', 'rejected', 'code', 'invalid-payload');
  end if;
  return private.purge_result(p_account, 'test-result', p_request ->> 'item', p_sequence);
end $$;

-- A challenge attempt (spec 3 stand-in): per-device, so the platform holds its position.
create function private.accept_test_attempt_v1(p_account uuid, p_request jsonb, p_sequence bigint) returns jsonb
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
create function private.assign_test_experiment(p_account uuid, p_experiment text, p_group text) returns bigint
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
  private.purge_test_result(uuid, text), private.contribution_test_result(jsonb), private.test_results_contribution(),
  private.accept_test_result_purge_v1(uuid, jsonb, bigint),
  private.accept_test_attempt_v1(uuid, jsonb, bigint), private.assign_test_experiment(uuid, text, text) from public;

insert into private.record_types (record_type, payload_version, kind, accept, ordering, purge) values
  ('test-sharing-withdrawal', 1, 'account-state-operation', to_regprocedure('private.accept_test_sharing_withdrawal_v1(uuid,jsonb,bigint)'), 'account', null),
  ('test-contribution', 1, 'account-state-operation', to_regprocedure('private.accept_test_contribution_v1(uuid,jsonb,bigint)'), 'account', null),
  ('test-allowance-reconciliation', 1, 'account-state-operation', to_regprocedure('private.accept_test_allowance_reconciliation_v1(uuid,jsonb,bigint)'), 'account', null),
  ('test-allowance-transfer', 1, 'account-state-operation', to_regprocedure('private.accept_test_allowance_transfer_v1(uuid,jsonb,bigint)'), 'account', null),
  ('test-result', 1, 'immutable-result', to_regprocedure('private.accept_test_result_v1(uuid,jsonb,bigint)'), 'account', to_regprocedure('private.purge_test_result(uuid,text)')),
  ('test-result-purge', 1, 'account-state-operation', to_regprocedure('private.accept_test_result_purge_v1(uuid,jsonb,bigint)'), 'account', null),
  ('test-attempt', 1, 'immutable-result', to_regprocedure('private.accept_test_attempt_v1(uuid,jsonb,bigint)'), 'per-device', null),
  ('test-experiment-assignment', 1, 'server-authored-state', null, 'account', null);
insert into private.record_contributions (record_type, contribute)
  values ('test-result', to_regprocedure('private.contribution_test_result(jsonb)'));
