-- Lesson-progress events (spec 3, #147; *Synchronized record types*, Amendment 1
-- C8 and C10): a bookmark, completed or restarted event for one lesson version,
-- ordered per device. The client half is packages/account/src/lesson-progress-record.ts.
--
-- - Its identity is the event's random ID, the originating installation and its
--   device sequence: the platform holds the sequence as the record's per-device
--   position (private.device_positions), and the record must carry the same
--   installation and sequence.
-- - The account sequence is its server acceptance order, which picks the bookmark.
-- - Summary data: the whole event is in every bootstrap snapshot; no detail.
-- - No contribution to practice totals. Exported as JSON; erased with the account.
--
-- Lock order is #91's: the synchronization head, then the type's rows, then the feed.

create table private.lesson_progress_events (
  account_id uuid not null references public.accounts (account_id),
  event_id text not null,
  payload jsonb not null,
  installation_id text not null,
  device_sequence bigint not null,
  operation_id text not null,
  sequence bigint not null,
  primary key (account_id, event_id)
);

revoke all on private.lesson_progress_events from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Lesson-progress event: immutable result, payload version 1, per device
-- ---------------------------------------------------------------------------

create function private.accept_lesson_progress_event_v1(p_account uuid, p_request jsonb, p_sequence bigint) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_payload jsonb := p_request -> 'payload';
  v_item text := p_request ->> 'item';
  v_lesson jsonb := p_request -> 'payload' -> 'lesson';
  v_event jsonb := p_request -> 'payload' -> 'event';
  v_existing private.lesson_progress_events;
begin
  if jsonb_typeof(v_payload) is distinct from 'object'
    or v_payload ->> 'recordVersion' is distinct from '1'
    or jsonb_typeof(v_payload -> 'eventId') is distinct from 'string'
    or jsonb_typeof(v_payload -> 'deviceSequence') is distinct from 'number'
    or jsonb_typeof(v_payload -> 'recordedAt') is distinct from 'number'
    or jsonb_typeof(v_lesson) is distinct from 'object'
    or jsonb_typeof(v_lesson -> 'id') is distinct from 'string'
    or jsonb_typeof(v_lesson -> 'version') is distinct from 'number'
    or jsonb_typeof(v_lesson -> 'materialVersion') is distinct from 'number'
    or jsonb_typeof(v_event) is distinct from 'object'
    or v_event ->> 'kind' is null or v_event ->> 'kind' not in ('bookmark', 'completed', 'restarted')
    or (v_event ->> 'kind' = 'bookmark' and case when jsonb_typeof(v_event -> 'step') = 'number'
      then (v_event ->> 'step')::numeric < 1 or (v_event ->> 'step')::numeric <> trunc((v_event ->> 'step')::numeric) else true end) then
    return jsonb_build_object('status', 'rejected', 'code', 'invalid-payload');
  end if;
  -- The item is the event's own ID; the owner is the authenticated account;
  -- the installation and device sequence are the sender's and the position it sent.
  if v_payload ->> 'eventId' is distinct from v_item then
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

  select * into v_existing from private.lesson_progress_events where account_id = p_account and event_id = v_item;
  if found then
    if v_existing.payload = v_payload then
      return jsonb_build_object('status', 'accepted', 'sequence', v_existing.sequence);
    end if;
    return jsonb_build_object('status', 'rejected', 'code', 'identity-reused');
  end if;

  insert into private.lesson_progress_events (account_id, event_id, payload, installation_id, device_sequence, operation_id, sequence)
    values (p_account, v_item, v_payload, p_request ->> 'installation', (p_request ->> 'position')::bigint, p_request ->> 'operation', p_sequence);
  return jsonb_build_object('status', 'accepted', 'change', jsonb_build_object('record', v_payload));
end $$;

-- Bootstrap (Amendment 1 C8): every accepted event whole, with its
-- originating-device position, at its acceptance.
create function private.snapshot_lesson_progress_events(p_account uuid, p_record_type text)
returns table (item_id text, sequence bigint, change jsonb)
language sql stable security definer set search_path = '' as $$
  select e.event_id, e.sequence,
         jsonb_build_object('record', e.payload, 'origin', jsonb_build_object('installation', e.installation_id, 'position', e.device_sequence))
  from private.lesson_progress_events e where e.account_id = p_account
$$;

-- Export: each accepted event whole, in acceptance order.
create function private.export_lesson_progress_events(p_account uuid, p_record_type text)
returns table (item_id text, record jsonb)
language sql stable security definer set search_path = '' as $$
  select e.event_id, e.payload from private.lesson_progress_events e
  where e.account_id = p_account
  order by e.sequence
$$;

-- Deletion coverage: the type's own table (positions, the feed and receipts are the platform's).
create function private.erase_lesson_progress_events(p_account uuid) returns void
language sql volatile security definer set search_path = '' as $$
  delete from private.lesson_progress_events where account_id = p_account
$$;

revoke execute on function private.accept_lesson_progress_event_v1(uuid, jsonb, bigint), private.snapshot_lesson_progress_events(uuid, text),
  private.export_lesson_progress_events(uuid, text), private.erase_lesson_progress_events(uuid) from public;

insert into private.record_types (record_type, payload_version, kind, accept, ordering, snapshot, export, export_file, erase)
  values ('lesson-progress', 1, 'immutable-result', 'private.accept_lesson_progress_event_v1(uuid,jsonb,bigint)', 'per-device',
    'private.snapshot_lesson_progress_events(uuid,text)', 'private.export_lesson_progress_events(uuid,text)', 'lesson-progress',
    'private.erase_lesson_progress_events(uuid)');

insert into private.retention_rules (subject, endpoint, dependency, owner) values
  ('private.lesson_progress_events', 'Accepted lesson-progress events: kept while the account exists.', null, null);
