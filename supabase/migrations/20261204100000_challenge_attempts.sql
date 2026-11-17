-- Challenge attempts (spec 3, #142; *Synchronized record types*, Amendments
-- 1 C8 and 4 §1): an ended attempt's immutable result, ordered per device.
-- The client half is packages/account/src/challenge-attempt-record.ts.
--
-- - Written once at ending (completed, abandoned, insufficient funds,
--   unusable); an unfinished attempt is never accepted.
-- - Its identity is the attempt's random ID, the originating installation and
--   its device sequence: the platform holds the sequence as the record's
--   per-device position (private.device_positions), and the record must carry
--   the same installation and sequence.
-- - The summary (everything but the review facts) is in every bootstrap
--   snapshot; the review facts are the detail, fetched on demand.
-- - No contribution to practice totals. Exported as JSON; erased with the account.
--
-- Lock order is #91's: the synchronization head, then the type's rows, then the feed.

create table private.challenge_attempts (
  account_id uuid not null references public.accounts (account_id),
  attempt_id text not null,
  payload jsonb not null,
  -- Amendment 1 C8: the record without its review facts
  summary jsonb generated always as (payload - 'review') stored,
  installation_id text not null,
  device_sequence bigint not null,
  operation_id text not null,
  sequence bigint not null,
  primary key (account_id, attempt_id)
);

revoke all on private.challenge_attempts from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Challenge attempt: immutable result, payload version 1, per device
-- ---------------------------------------------------------------------------

create function private.accept_challenge_attempt_v1(p_account uuid, p_request jsonb, p_sequence bigint) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_payload jsonb := p_request -> 'payload';
  v_item text := p_request ->> 'item';
  v_existing private.challenge_attempts;
begin
  if jsonb_typeof(v_payload) is distinct from 'object'
    or v_payload ->> 'recordVersion' is distinct from '1'
    or jsonb_typeof(v_payload -> 'attemptId') is distinct from 'string'
    or jsonb_typeof(v_payload -> 'deviceSequence') is distinct from 'number'
    or jsonb_typeof(v_payload -> 'groupKey') is distinct from 'object'
    or jsonb_typeof(v_payload -> 'identities') is distinct from 'object'
    or jsonb_typeof(v_payload -> 'metrics') is distinct from 'object'
    or jsonb_typeof(v_payload -> 'review') is distinct from 'array'
    or jsonb_typeof(v_payload -> 'interrupted') is distinct from 'boolean'
    -- Amendment 4 §1: the metering basis and the allowance-policy version in force
    or v_payload ->> 'meteringBasis' is null or v_payload ->> 'meteringBasis' not in ('challenge-attempt', 'premium')
    or jsonb_typeof(v_payload -> 'allowancePolicyVersion') not in ('string', 'null')
    or jsonb_typeof(v_payload -> 'startedAt') is distinct from 'number'
    or jsonb_typeof(v_payload -> 'endedAt') is distinct from 'number' then
    return jsonb_build_object('status', 'rejected', 'code', 'invalid-payload');
  end if;
  -- Only an ended attempt: an unfinished one never syncs.
  if v_payload ->> 'endingReason' is null or v_payload ->> 'endingReason' not in ('completed', 'abandoned', 'insufficient-funds', 'unusable') then
    return jsonb_build_object('status', 'rejected', 'code', 'not-ended');
  end if;
  -- The item is the attempt's own ID; the owner is the authenticated account;
  -- the installation and device sequence are the sender's and the position it sent.
  if v_payload ->> 'attemptId' is distinct from v_item then
    return jsonb_build_object('status', 'rejected', 'code', 'item-mismatch');
  end if;
  if v_payload ->> 'owner' is distinct from p_account::text then
    return jsonb_build_object('status', 'rejected', 'code', 'owner-mismatch');
  end if;
  if v_payload ->> 'installation' is distinct from p_request ->> 'installation' then
    return jsonb_build_object('status', 'rejected', 'code', 'device-mismatch');
  end if;
  if (v_payload ->> 'deviceSequence') is distinct from (p_request ->> 'position') then
    return jsonb_build_object('status', 'rejected', 'code', 'position-mismatch');
  end if;

  select * into v_existing from private.challenge_attempts where account_id = p_account and attempt_id = v_item;
  if found then
    if v_existing.payload = v_payload then
      return jsonb_build_object('status', 'accepted', 'sequence', v_existing.sequence);
    end if;
    return jsonb_build_object('status', 'rejected', 'code', 'identity-reused');
  end if;

  insert into private.challenge_attempts (account_id, attempt_id, payload, installation_id, device_sequence, operation_id, sequence)
    values (p_account, v_item, v_payload, p_request ->> 'installation', (p_request ->> 'position')::bigint, p_request ->> 'operation', p_sequence);
  return jsonb_build_object('status', 'accepted', 'change', jsonb_build_object('record', v_payload));
end $$;

-- Bootstrap (Amendment 1 C8): every accepted attempt's summary, with its
-- originating-device position, at its acceptance.
create function private.snapshot_challenge_attempts(p_account uuid, p_record_type text)
returns table (item_id text, sequence bigint, change jsonb)
language sql stable security definer set search_path = '' as $$
  select a.attempt_id, a.sequence,
         jsonb_build_object('record', a.summary, 'origin', jsonb_build_object('installation', a.installation_id, 'position', a.device_sequence))
  from private.challenge_attempts a where a.account_id = p_account
$$;

-- Detail: the accepted record whole, review facts included, with its
-- originating-device position, at its acceptance.
create function private.detail_challenge_attempts(p_account uuid, p_record_type text, p_item text)
returns table (sequence bigint, change jsonb)
language sql stable security definer set search_path = '' as $$
  select a.sequence,
         jsonb_build_object('record', a.payload, 'origin', jsonb_build_object('installation', a.installation_id, 'position', a.device_sequence))
  from private.challenge_attempts a where a.account_id = p_account and a.attempt_id = p_item
$$;

-- Export: each accepted record whole, oldest first.
create function private.export_challenge_attempts(p_account uuid, p_record_type text)
returns table (item_id text, record jsonb)
language sql stable security definer set search_path = '' as $$
  select a.attempt_id, a.payload from private.challenge_attempts a
  where a.account_id = p_account
  order by (a.payload ->> 'endedAt')::bigint, a.attempt_id
$$;

-- Deletion coverage: the type's own table (positions, the feed and receipts are the platform's).
create function private.erase_challenge_attempts(p_account uuid) returns void
language sql volatile security definer set search_path = '' as $$
  delete from private.challenge_attempts where account_id = p_account
$$;

revoke execute on function private.accept_challenge_attempt_v1(uuid, jsonb, bigint), private.snapshot_challenge_attempts(uuid, text),
  private.detail_challenge_attempts(uuid, text, text), private.export_challenge_attempts(uuid, text),
  private.erase_challenge_attempts(uuid) from public;

insert into private.record_types (record_type, payload_version, kind, accept, ordering, snapshot, detail, export, export_file, erase)
  values ('challenge-attempt', 1, 'immutable-result', 'private.accept_challenge_attempt_v1(uuid,jsonb,bigint)', 'per-device',
    'private.snapshot_challenge_attempts(uuid,text)', 'private.detail_challenge_attempts(uuid,text,text)',
    'private.export_challenge_attempts(uuid,text)', 'challenge-attempts', 'private.erase_challenge_attempts(uuid)');

insert into private.retention_rules (subject, endpoint, dependency, owner) values
  ('private.challenge_attempts', 'Accepted challenge attempts: kept while the account exists.', null, null);
