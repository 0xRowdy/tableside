-- Account-state operations, barriers, server-authored state, purging an
-- accepted immutable result, and per-device ordering (spec 2, #95; Amendments
-- 4 §1, 5 §1, 6 §1). The record-type registry's remaining kinds: specs 3, 5, 6
-- and 7 register their types against these, and seam 2 proves them with
-- test-only types the harness installs (packages/account/src/testing).
--
-- Lock order is #91's: the synchronization head, then receipts, then the
-- record type's own rows, then the feed.

-- ---------------------------------------------------------------------------
-- Registry: ordering, purging and server-authored types
-- ---------------------------------------------------------------------------

-- ordering: 'per-device' types carry a durable originating-device position in
--   the envelope (challenge attempts, spec 3); 'account' types don't.
-- purge: an immutable result's purge hook, `purge(account uuid, item text) returns boolean`:
--   removes the result's rows (summary, detail, chunks) and its contribution,
--   answering whether the result had been accepted. Chunked results (#93)
--   remove their accepted chunks here; bootstrap (#96) and export read the
--   types' own rows, so a purged result is in neither.
-- accept: none for a server-authored type, which no client writes.
alter table private.record_types
  add column ordering text not null default 'account' check (ordering in ('account', 'per-device')),
  add column purge regprocedure,
  alter column accept drop not null,
  add constraint record_types_accept check ((accept is null) = (kind = 'server-authored-state')),
  add constraint record_types_purge check (purge is null or kind = 'immutable-result');

-- Each per-device record's position on its originating installation: one item
-- per position, one position per item. Order comes from here, never from clocks.
create table private.device_positions (
  account_id uuid not null references public.accounts (account_id),
  installation_id text not null,
  record_type text not null,
  position bigint not null,
  item_id text not null,
  primary key (account_id, installation_id, record_type, position),
  unique (account_id, record_type, item_id)
);

-- The deleted-result receipt (Amendment 4 §1): only the identity of a purged
-- result and the sequence that purged it, so no retry or queued upload can
-- bring it back. Kept while any device or queued upload could resend it.
create table private.purged_results (
  account_id uuid not null references public.accounts (account_id),
  record_type text not null,
  item_id text not null,
  sequence bigint not null,
  primary key (account_id, record_type, item_id)
);

-- A purged result's feed entries keep their position with no change (null),
-- so a device that hasn't read them yet steps over them and never sees the result.
alter table private.sync_feed alter column change drop not null;

revoke all on private.device_positions, private.purged_results from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Purging an accepted immutable result
-- ---------------------------------------------------------------------------

-- Called by a purging account-state operation's acceptance function, inside
-- the upload's transaction (the head is held). Its barrier is the target's
-- acceptance: a result that was never accepted can't be purged. Answers as an
-- acceptance function does; the change tells every device to remove its copy.
create function private.purge_result(p_account uuid, p_record_type text, p_item text, p_sequence bigint) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_purge regprocedure;
  v_earlier bigint;
  v_found boolean;
begin
  select sequence into v_earlier from private.purged_results
    where account_id = p_account and record_type = p_record_type and item_id = p_item;
  if found then
    -- Another device purged it first: the same effect, at that acceptance.
    return jsonb_build_object('status', 'accepted', 'sequence', v_earlier);
  end if;
  select purge into v_purge from private.record_types where record_type = p_record_type and purge is not null
    order by payload_version desc limit 1;
  if v_purge is null then
    return jsonb_build_object('status', 'rejected', 'code', 'not-purgeable');
  end if;
  execute format('select %s($1, $2)', v_purge::regproc) into v_found using p_account, p_item;
  if v_found is not true then
    return jsonb_build_object('status', 'rejected', 'code', 'target-not-accepted');
  end if;
  insert into private.purged_results (account_id, record_type, item_id, sequence)
    values (p_account, p_record_type, p_item, p_sequence);
  update private.sync_feed set change = null
    where account_id = p_account and record_type = p_record_type and item_id = p_item;
  return jsonb_build_object('status', 'accepted',
    'change', jsonb_build_object('purge', jsonb_build_object('recordType', p_record_type, 'item', p_item)));
end $$;

revoke execute on function private.purge_result(uuid, text, text, bigint) from public;

-- ---------------------------------------------------------------------------
-- Server-authored state
-- ---------------------------------------------------------------------------

-- Written only by the backend (jobs, provider webhooks, operators) and
-- delivered through the feed: experiment assignments, entitlement snapshots,
-- contribution status, removal notices. No client can call it. Call it first
-- in the writing transaction, then write the state's own rows: it takes the
-- account's head before anything else, as the lock order requires, and the
-- feed row it adds is new, so writing the state's rows after it can't wait on
-- another transaction's feed. Returns the account sequence the change was given.
create function private.author_server_state(p_account uuid, p_record_type text, p_item text, p_change jsonb) returns bigint
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_head bigint;
begin
  if not exists (select 1 from private.record_types where record_type = p_record_type and kind = 'server-authored-state') then
    raise exception 'not a server-authored record type' using errcode = '22023';
  end if;
  if jsonb_typeof(p_change) is distinct from 'object' or coalesce(p_item, '') !~ '^[A-Za-z0-9_:/.-]{1,200}$' then
    raise exception 'invalid server-authored change' using errcode = '22023';
  end if;
  insert into private.sync_heads (account_id)
    select account_id from public.accounts where account_id = p_account and state <> 'deleted'
    on conflict do nothing;
  select sequence into v_head from private.sync_heads where account_id = p_account for update;
  if not found or not exists (select 1 from public.accounts where account_id = p_account and state <> 'deleted') then
    raise exception 'no such account' using errcode = '22023';
  end if;
  update private.sync_heads set sequence = v_head + 1 where account_id = p_account;
  insert into private.sync_feed (account_id, sequence, record_type, item_id, change)
    values (p_account, v_head + 1, p_record_type, p_item, p_change);
  perform realtime.send('{}'::jsonb, 'account-changed', 'account:' || p_account::text, true);
  return v_head + 1;
end $$;

revoke execute on function private.author_server_state(uuid, text, text, jsonb) from public;

-- ---------------------------------------------------------------------------
-- Operation API, protocol version 1 (replaces #93's sync_upload_v1, keeping
-- its chunk manifests, which in turn replaced #91's)
-- ---------------------------------------------------------------------------

-- The envelope gains two optional fields, absent unless used, so every
-- earlier request text (and its hash) is unchanged:
--   "after":    operation IDs that must already have receipts (barriers and
--               dependencies). Until they all do, the answer is
--               {"status":"waiting"} and nothing is recorded: the identical
--               request is accepted once they have. Receipt compaction (#43)
--               must keep a compact disposition for every operation a device
--               could still name here, or a dependent would wait forever.
--   "position": the originating-device position of a per-device type's record.
-- And the platform refuses, with a durable receipt: a server-authored type
-- (no client writes it), a purged result's identity (no resurrection), and a
-- per-device record without a position, at a taken position, or moved to another.
create or replace function public.sync_upload_v1(request text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_account uuid := private.active_account();
  v_request jsonb;
  v_hash text;
  v_operation text;
  v_item text;
  v_installation text;
  v_position bigint;
  v_head bigint;
  v_receipt private.sync_receipts;
  v_type private.record_types;
  v_result jsonb;
  v_change jsonb;
  v_disposition jsonb;
  v_assembly jsonb;
begin
  if octet_length(request) > 131072 then
    return jsonb_build_object('status', 'malformed');
  end if;
  if v_account is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  -- Contention on the head waits a bounded time; the client retries a bounded number of times.
  perform set_config('lock_timeout', '5s', true);

  begin
    v_request := request::jsonb;
  exception when others then
    return jsonb_build_object('status', 'malformed');
  end;
  if jsonb_typeof(v_request) is distinct from 'object' or jsonb_typeof(v_request -> 'protocol') is distinct from 'number' then
    return jsonb_build_object('status', 'malformed');
  end if;
  if (v_request ->> 'protocol') <> '1' then
    return jsonb_build_object('status', 'incompatible', 'supported', jsonb_build_array(1));
  end if;
  v_operation := v_request ->> 'operation';
  v_item := v_request ->> 'item';
  v_installation := v_request ->> 'installation';
  if v_operation is null or v_operation !~ '^[0-9a-f]{32}$'
    or coalesce(v_installation, '') !~ '^[A-Za-z0-9_-]{1,128}$'
    or coalesce(v_item, '') !~ '^[A-Za-z0-9_:/.-]{1,200}$'
    or jsonb_typeof(v_request -> 'recordType') is distinct from 'string'
    or coalesce(v_request ->> 'payloadVersion', '') !~ '^[1-9][0-9]{0,8}$'
    or (v_request ? 'after' and (jsonb_typeof(v_request -> 'after') is distinct from 'array'
      or jsonb_array_length(v_request -> 'after') not between 1 and 100
      or exists (select 1 from jsonb_array_elements(v_request -> 'after') a
                 where jsonb_typeof(a) is distinct from 'string' or (a #>> '{}') !~ '^[0-9a-f]{32}$')))
    or (v_request ? 'position' and (jsonb_typeof(v_request -> 'position') is distinct from 'number'
      or (v_request ->> 'position') !~ '^[1-9][0-9]{0,14}$')) then
    return jsonb_build_object('status', 'malformed');
  end if;
  v_position := (v_request ->> 'position')::bigint;
  v_hash := encode(extensions.digest(request, 'sha256'), 'hex');

  insert into private.sync_heads (account_id) values (v_account) on conflict do nothing;
  select sequence into v_head from private.sync_heads where account_id = v_account for update;
  -- The gate again, now that the head serializes this upload with every other
  -- authoritative change: a deletion scheduled or a session revoked while this
  -- upload waited is seen here, and the upload is denied.
  if private.active_account() is distinct from v_account then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select * into v_receipt from private.sync_receipts where account_id = v_account and operation_id = v_operation;
  if found then
    if v_receipt.request_hash = v_hash then
      return v_receipt.disposition;
    end if;
    -- Not a receipt: the operation's real receipt stays as it is.
    return jsonb_build_object('status', 'operation-reused', 'operation', v_operation);
  end if;

  -- Barriers: under the head, every operation it waits for must already have
  -- its receipt. Not a receipt either: nothing is recorded.
  if exists (select 1 from jsonb_array_elements_text(coalesce(v_request -> 'after', '[]'::jsonb)) a (operation_id)
             where not exists (select 1 from private.sync_receipts r where r.account_id = v_account and r.operation_id = a.operation_id)) then
    return jsonb_build_object('status', 'waiting', 'operation', v_operation);
  end if;

  -- A manifest (#93): the payload is rebuilt from the staged chunks it names.
  -- Until every one is staged nothing is decided, so the client stages them
  -- and sends the identical request again.
  if v_request ? 'content' then
    v_assembly := private.assemble_content(v_account, v_request);
    if v_assembly ->> 'status' in ('malformed', 'chunks-missing') then
      return v_assembly;
    end if;
    if v_assembly ->> 'status' = 'assembled' then
      v_request := v_request || jsonb_build_object('payload', v_assembly -> 'payload');
    else
      v_result := v_assembly;
    end if;
  end if;

  select * into v_type from private.record_types
    where record_type = v_request ->> 'recordType' and payload_version = (v_request ->> 'payloadVersion')::integer;
  if v_result is not null then
    null;
  elsif not found then
    v_result := jsonb_build_object('status', 'rejected', 'code', 'unknown-record-type');
  elsif v_type.kind = 'server-authored-state' then
    v_result := jsonb_build_object('status', 'rejected', 'code', 'server-authored');
  elsif exists (select 1 from private.purged_results where account_id = v_account and record_type = v_type.record_type and item_id = v_item) then
    v_result := jsonb_build_object('status', 'rejected', 'code', 'purged');
  elsif (v_type.ordering = 'per-device') is distinct from (v_position is not null) then
    v_result := jsonb_build_object('status', 'rejected', 'code', case when v_position is null then 'position-required' else 'position-unexpected' end);
  elsif v_position is not null and exists (
      select 1 from private.device_positions p
      where p.account_id = v_account and p.record_type = v_type.record_type
        and ((p.installation_id = v_installation and p.position = v_position and p.item_id <> v_item)
          or (p.item_id = v_item and (p.installation_id <> v_installation or p.position <> v_position)))) then
    v_result := jsonb_build_object('status', 'rejected', 'code', 'position-reused');
  else
    execute format('select %s($1, $2, $3)', v_type.accept::regproc) into v_result using v_account, v_request, v_head + 1;
  end if;

  if v_result ->> 'status' = 'accepted' and v_result ? 'change' then
    v_change := v_result -> 'change';
    if v_position is not null then
      insert into private.device_positions (account_id, installation_id, record_type, position, item_id)
        values (v_account, v_installation, v_type.record_type, v_position, v_item);
      -- The platform's part of the change: where the record sits on its device.
      v_change := v_change || jsonb_build_object('origin', jsonb_build_object('installation', v_installation, 'position', v_position));
    end if;
    update private.sync_heads set sequence = v_head + 1 where account_id = v_account;
    insert into private.sync_feed (account_id, sequence, record_type, item_id, change)
      values (v_account, v_head + 1, v_request ->> 'recordType', v_item, v_change);
    v_disposition := jsonb_build_object('status', 'accepted', 'sequence', v_head + 1);
    -- Only a hint: devices read the change through the feed. Delivered on commit.
    perform realtime.send('{}'::jsonb, 'account-changed', 'account:' || v_account::text, true);
  elsif v_result ->> 'status' = 'accepted' then
    v_disposition := jsonb_build_object('status', 'accepted', 'sequence', (v_result ->> 'sequence')::bigint);
  else
    v_disposition := jsonb_build_object('status', 'rejected', 'code', v_result ->> 'code');
  end if;
  v_disposition := v_disposition || jsonb_build_object('operation', v_operation, 'requestHash', v_hash);

  insert into private.sync_receipts (account_id, operation_id, request_hash, installation_id, record_type, item_id, disposition)
    values (v_account, v_operation, v_hash, v_installation, v_request ->> 'recordType', v_item, v_disposition);
  -- The manifest's chunks have served: the receipt answers every retry from now on.
  if v_assembly is not null then
    delete from private.staged_chunks
      where account_id = v_account and record_type = v_request ->> 'recordType' and item_id = v_request ->> 'item'
        and sha256 in (select jsonb_array_elements_text(v_request -> 'content' -> 'chunks'));
  end if;
  return v_disposition;
end $$;
