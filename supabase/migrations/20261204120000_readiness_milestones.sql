-- Readiness milestones (spec 3, #148; *Synchronized record types* and *Comparison
-- groups* (Readiness streak), Amendment 1 B3 and C2): two consecutive advancing
-- Check attempts on one installation in one comparison group. The client half is
-- packages/account/src/readiness-milestone-record.ts.
--
-- - Its identity is the originating installation and the two cited attempt IDs
--   (which fix the group key); the item is "<installation>/<first>/<second>".
-- - Barrier: every attempt of that installation from the first to the second
--   cited device position must be accepted first. The device names their
--   operations in "after"; here the streak is re-checked over the accepted
--   attempts and rejected with a reason, never stitched across installations
--   and never across a gap or a breaking attempt. One per installation and group.
-- - Summary data: the whole milestone is in every bootstrap snapshot; no detail.
-- - No contribution to practice totals. Exported as JSON; erased with the account.
--
-- Lock order is #91's: the synchronization head, then the type's rows, then the feed.

create table private.readiness_milestones (
  account_id uuid not null references public.accounts (account_id),
  item_id text not null,
  payload jsonb not null,
  installation_id text not null,
  group_key jsonb not null,
  operation_id text not null,
  sequence bigint not null,
  primary key (account_id, item_id),
  unique (account_id, installation_id, group_key)
);

revoke all on private.readiness_milestones from public, anon, authenticated;

-- Spec 3 Comparison groups (Readiness streak); Amendment 1 C2, C3: what one
-- ended attempt does to the streak of its base configuration.
create function private.readiness_streak_effect(p_attempt jsonb) returns text
language sql immutable set search_path = '' as $$
  select case
    when p_attempt #>> '{groupKey,variant}' is distinct from 'check' then 'neutral'
    when p_attempt ->> 'endingReason' in ('abandoned', 'insufficient-funds') then 'breaks'
    when p_attempt ->> 'endingReason' is distinct from 'completed' then 'neutral'
    when p_attempt #>> '{groupKey,assistanceClass}' is distinct from 'unassisted-check' then 'neutral'
    when (select count(*) > 0 and bool_and((m.value ->> 'correct')::numeric >= 0.95 * (m.value ->> 'total')::numeric)
          from jsonb_each(p_attempt -> 'metrics') m
          where m.key in ('card-values', 'running-count', 'true-count')
            and jsonb_typeof(m.value -> 'correct') = 'number' and jsonb_typeof(m.value -> 'total') = 'number'
            and (m.value ->> 'total')::numeric > 0) then 'advances'
    else 'breaks'
  end
$$;

-- Amendment 1 C2
create function private.readiness_base_configuration(p_group_key jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select p_group_key - 'assistanceClass' - 'countRevealed'
$$;

-- ---------------------------------------------------------------------------
-- Readiness milestone: immutable result with barrier, payload version 1
-- ---------------------------------------------------------------------------

create function private.accept_readiness_milestone_v1(p_account uuid, p_request jsonb, p_sequence bigint) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_payload jsonb := p_request -> 'payload';
  v_item text := p_request ->> 'item';
  v_installation text := p_request -> 'payload' ->> 'installation';
  v_existing private.readiness_milestones;
  v_first private.challenge_attempts;
  v_second private.challenge_attempts;
  v_effects text[];
begin
  if jsonb_typeof(v_payload) is distinct from 'object'
    or v_payload ->> 'recordVersion' is distinct from '1'
    or jsonb_typeof(v_payload -> 'owner') is distinct from 'string'
    or jsonb_typeof(v_payload -> 'installation') is distinct from 'string'
    or jsonb_typeof(v_payload -> 'groupKey') is distinct from 'object'
    or not v_payload @? '$ ? (@.attempts.type() == "array" && @.attempts.size() == 2)'
    or v_payload @? '$.attempts[*] ? (@.type() != "string")'
    or not v_payload @? '$ ? (@.deviceSequences.type() == "array" && @.deviceSequences.size() == 2)'
    or v_payload @? '$.deviceSequences[*] ? (@.type() != "number" || @ < 1 || @ != @.floor())'
    or not v_payload @? '$ ? (@.deviceSequences[0] < @.deviceSequences[1])'
    or jsonb_typeof(v_payload -> 'earnedAt') is distinct from 'number' then
    return jsonb_build_object('status', 'rejected', 'code', 'invalid-payload');
  end if;
  if v_item is distinct from v_installation || '/' || (v_payload #>> '{attempts,0}') || '/' || (v_payload #>> '{attempts,1}') then
    return jsonb_build_object('status', 'rejected', 'code', 'item-mismatch');
  end if;
  if v_payload ->> 'owner' is distinct from p_account::text then
    return jsonb_build_object('status', 'rejected', 'code', 'owner-mismatch');
  end if;
  -- A device claims only its own streak (Amendment 1 B3).
  if v_installation is distinct from p_request ->> 'installation' then
    return jsonb_build_object('status', 'rejected', 'code', 'device-mismatch');
  end if;

  select * into v_existing from private.readiness_milestones where account_id = p_account and item_id = v_item;
  if found then
    if v_existing.payload = v_payload then
      return jsonb_build_object('status', 'accepted', 'sequence', v_existing.sequence);
    end if;
    return jsonb_build_object('status', 'rejected', 'code', 'identity-reused');
  end if;

  -- The streak, re-checked over the accepted attempts.
  select * into v_first from private.challenge_attempts where account_id = p_account and attempt_id = v_payload #>> '{attempts,0}';
  if not found then
    return jsonb_build_object('status', 'rejected', 'code', 'attempt-missing');
  end if;
  select * into v_second from private.challenge_attempts where account_id = p_account and attempt_id = v_payload #>> '{attempts,1}';
  if not found then
    return jsonb_build_object('status', 'rejected', 'code', 'attempt-missing');
  end if;
  if v_first.installation_id <> v_installation or v_second.installation_id <> v_installation then
    return jsonb_build_object('status', 'rejected', 'code', 'other-installation');
  end if;
  if v_first.device_sequence <> (v_payload #>> '{deviceSequences,0}')::bigint or v_second.device_sequence <> (v_payload #>> '{deviceSequences,1}')::bigint then
    return jsonb_build_object('status', 'rejected', 'code', 'invalid-citation');
  end if;
  if v_first.summary -> 'groupKey' <> v_payload -> 'groupKey' or v_second.summary -> 'groupKey' <> v_payload -> 'groupKey' then
    return jsonb_build_object('status', 'rejected', 'code', 'group-mismatch');
  end if;
  if private.readiness_streak_effect(v_first.summary) <> 'advances' or private.readiness_streak_effect(v_second.summary) <> 'advances' then
    return jsonb_build_object('status', 'rejected', 'code', 'not-advancing');
  end if;
  if (select count(*) from private.challenge_attempts a
      where a.account_id = p_account and a.installation_id = v_installation
        and a.device_sequence between v_first.device_sequence and v_second.device_sequence)
     <> v_second.device_sequence - v_first.device_sequence + 1 then
    return jsonb_build_object('status', 'rejected', 'code', 'gap');
  end if;
  select array_agg(private.readiness_streak_effect(a.summary)) into v_effects from private.challenge_attempts a
    where a.account_id = p_account and a.installation_id = v_installation
      and a.device_sequence > v_first.device_sequence and a.device_sequence < v_second.device_sequence
      and private.readiness_base_configuration(a.summary -> 'groupKey') = private.readiness_base_configuration(v_payload -> 'groupKey');
  if 'breaks' = any (v_effects) then
    return jsonb_build_object('status', 'rejected', 'code', 'streak-broken');
  end if;
  if 'advances' = any (v_effects) then
    return jsonb_build_object('status', 'rejected', 'code', 'not-consecutive');
  end if;
  if exists (select 1 from private.readiness_milestones m
             where m.account_id = p_account and m.installation_id = v_installation and m.group_key = v_payload -> 'groupKey') then
    return jsonb_build_object('status', 'rejected', 'code', 'already-earned');
  end if;

  insert into private.readiness_milestones (account_id, item_id, payload, installation_id, group_key, operation_id, sequence)
    values (p_account, v_item, v_payload, v_installation, v_payload -> 'groupKey', p_request ->> 'operation', p_sequence);
  return jsonb_build_object('status', 'accepted', 'change', jsonb_build_object('record', v_payload));
end $$;

-- Bootstrap (Amendment 1 C8): every accepted milestone whole, at its acceptance.
create function private.snapshot_readiness_milestones(p_account uuid, p_record_type text)
returns table (item_id text, sequence bigint, change jsonb)
language sql stable security definer set search_path = '' as $$
  select m.item_id, m.sequence, jsonb_build_object('record', m.payload)
  from private.readiness_milestones m where m.account_id = p_account
$$;

-- Export: each accepted milestone whole, in acceptance order.
create function private.export_readiness_milestones(p_account uuid, p_record_type text)
returns table (item_id text, record jsonb)
language sql stable security definer set search_path = '' as $$
  select m.item_id, m.payload from private.readiness_milestones m
  where m.account_id = p_account
  order by m.sequence
$$;

-- Deletion coverage: the type's own table (the feed and receipts are the platform's).
create function private.erase_readiness_milestones(p_account uuid) returns void
language sql volatile security definer set search_path = '' as $$
  delete from private.readiness_milestones where account_id = p_account
$$;

revoke execute on function private.readiness_streak_effect(jsonb), private.readiness_base_configuration(jsonb),
  private.accept_readiness_milestone_v1(uuid, jsonb, bigint), private.snapshot_readiness_milestones(uuid, text),
  private.export_readiness_milestones(uuid, text), private.erase_readiness_milestones(uuid) from public;

insert into private.record_types (record_type, payload_version, kind, accept, snapshot, export, export_file, erase)
  values ('readiness-milestone', 1, 'immutable-result', 'private.accept_readiness_milestone_v1(uuid,jsonb,bigint)',
    'private.snapshot_readiness_milestones(uuid,text)', 'private.export_readiness_milestones(uuid,text)', 'readiness-milestones',
    'private.erase_readiness_milestones(uuid)');

insert into private.retention_rules (subject, endpoint, dependency, owner) values
  ('private.readiness_milestones', 'Accepted readiness milestones: kept while the account exists.', null, null);
