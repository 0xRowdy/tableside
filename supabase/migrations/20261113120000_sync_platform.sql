-- Synchronization platform (spec 2, #91): the per-account synchronization
-- head, the server side of the record-type registry, durable operation
-- receipts, the content-change feed, accepted practice results, and the
-- Realtime "account changed" hint with its newest-foregrounded-installation claim.
--
-- Lock order, for every operation and job that touches an account's
-- authoritative state: the account's synchronization head, then its receipts,
-- then the record type's own rows, then the feed. Holding the head until
-- commit makes sequence order equal commit order.

-- ---------------------------------------------------------------------------
-- Tables (none exposed through the API; clients reach them only through the
-- operations below)
-- ---------------------------------------------------------------------------

create table private.sync_heads (
  account_id uuid primary key references public.accounts (account_id),
  sequence bigint not null default 0
);

-- How the server accepts each registered record type and payload version
-- (the client half of the registry is packages/account/src/sync/registry.ts).
-- `accept(account uuid, request jsonb, sequence bigint) returns jsonb` writes
-- the type's rows and answers one of:
--   {"status":"accepted","change":{...}}  newly accepted at `sequence`: the platform adds the feed entry
--   {"status":"accepted","sequence":n}    already accepted at n: nothing new
--   {"status":"rejected","code":"..."}    refused; durable like any receipt
create table private.record_types (
  record_type text not null,
  payload_version integer not null,
  kind text not null check (kind in ('immutable-result', 'revisioned-item', 'account-state-operation', 'server-authored-state')),
  accept regprocedure not null,
  primary key (record_type, payload_version)
);

-- One durable receipt per (account, operation). An identical retry gets its
-- disposition back; a different request under the same operation is refused.
create table private.sync_receipts (
  account_id uuid not null references public.accounts (account_id),
  operation_id text not null,
  request_hash text not null,
  installation_id text not null,
  record_type text not null,
  item_id text not null,
  disposition jsonb not null,
  received_at timestamptz not null default now(),
  primary key (account_id, operation_id)
);

-- The account's content-change feed, in sequence (= commit) order, gap-free.
create table private.sync_feed (
  account_id uuid not null references public.accounts (account_id),
  sequence bigint not null,
  record_type text not null,
  item_id text not null,
  change jsonb not null,
  primary key (account_id, sequence)
);

-- Accepted completed practice sessions (spec 1's completion record), once per result.
create table private.practice_results (
  account_id uuid not null references public.accounts (account_id),
  result_id text not null,
  payload jsonb not null,
  installation_id text not null,
  operation_id text not null,
  sequence bigint not null,
  primary key (account_id, result_id)
);

-- The newest Realtime claim per account: the installation holding it keeps the live connection.
create table private.realtime_claims (
  account_id uuid primary key references public.accounts (account_id),
  claim bigint not null
);

revoke all on private.sync_heads, private.record_types, private.sync_receipts, private.sync_feed,
  private.practice_results, private.realtime_claims from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Completed practice session: immutable result, payload version 1
-- ---------------------------------------------------------------------------

create function private.accept_completed_practice_session_v1(p_account uuid, p_request jsonb, p_sequence bigint) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_payload jsonb := p_request -> 'payload';
  v_item text := p_request ->> 'item';
  v_existing private.practice_results;
begin
  if jsonb_typeof(v_payload) is distinct from 'object'
    or v_payload ->> 'recordVersion' is distinct from '1'
    or jsonb_typeof(v_payload -> 'activityId') is distinct from 'string'
    or jsonb_typeof(v_payload -> 'game') is distinct from 'string'
    or jsonb_typeof(v_payload -> 'startedAt') is distinct from 'number'
    or jsonb_typeof(v_payload -> 'endedAt') is distinct from 'number'
    or jsonb_typeof(v_payload -> 'netResult') is distinct from 'string'
    or jsonb_typeof(v_payload -> 'finalCashOut') is distinct from 'string' then
    return jsonb_build_object('status', 'rejected', 'code', 'invalid-payload');
  end if;
  -- The item is the result's own identity; the owner is the authenticated
  -- account, never a field the caller chose; the record's device is the installation that sent it.
  if v_payload ->> 'activityId' is distinct from v_item then
    return jsonb_build_object('status', 'rejected', 'code', 'item-mismatch');
  end if;
  if v_payload ->> 'owner' is distinct from p_account::text then
    return jsonb_build_object('status', 'rejected', 'code', 'owner-mismatch');
  end if;
  if v_payload ->> 'device' is distinct from p_request ->> 'installation' then
    return jsonb_build_object('status', 'rejected', 'code', 'device-mismatch');
  end if;

  select * into v_existing from private.practice_results where account_id = p_account and result_id = v_item;
  if found then
    -- An immutable result is accepted once. The same result under another
    -- operation counts as that one acceptance; a different one under its identity never does.
    if v_existing.payload = v_payload then
      return jsonb_build_object('status', 'accepted', 'sequence', v_existing.sequence);
    end if;
    return jsonb_build_object('status', 'rejected', 'code', 'identity-reused');
  end if;

  insert into private.practice_results (account_id, result_id, payload, installation_id, operation_id, sequence)
    values (p_account, v_item, v_payload, p_request ->> 'installation', p_request ->> 'operation', p_sequence);
  return jsonb_build_object('status', 'accepted', 'change', jsonb_build_object('record', v_payload));
end $$;

revoke execute on function private.accept_completed_practice_session_v1(uuid, jsonb, bigint) from public;

insert into private.record_types (record_type, payload_version, kind, accept)
  values ('completed-practice-session', 1, 'immutable-result', 'private.accept_completed_practice_session_v1(uuid,jsonb,bigint)');

-- ---------------------------------------------------------------------------
-- Operation API, protocol version 1
-- ---------------------------------------------------------------------------

-- Uploads one operation. `request` is the envelope as canonical JSON text:
--   {"installation","item","operation","payload","payloadVersion","protocol","recordType"}
-- Its SHA-256 is the canonical request hash. The whole acceptance (the type's
-- rows, sequence, feed entry, receipt and hint) is this one transaction.
create function public.sync_upload_v1(request text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_account uuid := private.active_account();
  v_request jsonb;
  v_hash text;
  v_operation text;
  v_head bigint;
  v_receipt private.sync_receipts;
  v_accept regprocedure;
  v_result jsonb;
  v_disposition jsonb;
begin
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
  if v_operation is null or v_operation !~ '^[0-9a-f]{32}$'
    or coalesce(v_request ->> 'installation', '') !~ '^[A-Za-z0-9_-]{1,128}$'
    or coalesce(v_request ->> 'item', '') !~ '^[A-Za-z0-9_:/.-]{1,200}$'
    or jsonb_typeof(v_request -> 'recordType') is distinct from 'string'
    or coalesce(v_request ->> 'payloadVersion', '') !~ '^[1-9][0-9]{0,8}$' then
    return jsonb_build_object('status', 'malformed');
  end if;
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

  select accept into v_accept from private.record_types
    where record_type = v_request ->> 'recordType' and payload_version = (v_request ->> 'payloadVersion')::integer;
  if not found then
    v_result := jsonb_build_object('status', 'rejected', 'code', 'unknown-record-type');
  else
    execute format('select %s($1, $2, $3)', v_accept::regproc) into v_result using v_account, v_request, v_head + 1;
  end if;

  if v_result ->> 'status' = 'accepted' and v_result ? 'change' then
    update private.sync_heads set sequence = v_head + 1 where account_id = v_account;
    insert into private.sync_feed (account_id, sequence, record_type, item_id, change)
      values (v_account, v_head + 1, v_request ->> 'recordType', v_request ->> 'item', v_result -> 'change');
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
    values (v_account, v_operation, v_hash, v_request ->> 'installation', v_request ->> 'recordType', v_request ->> 'item', v_disposition);
  return v_disposition;
end $$;

-- One bounded page of the account's feed after `after`, in sequence order.
create function public.sync_feed_v1(after bigint, page_size integer default 50) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_account uuid := private.active_account();
  v_limit integer := least(greatest(coalesce(page_size, 50), 1), 100);
  v_entries jsonb;
  v_last bigint;
begin
  if v_account is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('sequence', f.sequence, 'recordType', f.record_type, 'item', f.item_id, 'change', f.change) order by f.sequence), '[]'::jsonb),
         max(f.sequence)
    into v_entries, v_last
    from (select * from private.sync_feed where account_id = v_account and sequence > coalesce(after, 0)
          order by sequence limit v_limit) f;
  return jsonb_build_object(
    'entries', v_entries,
    'more', exists (select 1 from private.sync_feed where account_id = v_account and sequence > coalesce(v_last, coalesce(after, 0))));
end $$;

-- ---------------------------------------------------------------------------
-- Realtime: the private "account changed" hint and the live-connection claim
-- ---------------------------------------------------------------------------

-- A foregrounded installation claims the live connection. The newest claim
-- wins: every joined installation hears it and only its holder stays joined.
create function public.realtime_claim_v1() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_account uuid := private.active_account();
  v_claim bigint;
begin
  if v_account is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  insert into private.realtime_claims (account_id, claim) values (v_account, 1)
    on conflict (account_id) do update set claim = private.realtime_claims.claim + 1
    returning claim into v_claim;
  perform realtime.send(jsonb_build_object('claim', v_claim), 'live-holder', 'account:' || v_account::text, true);
  return jsonb_build_object('claim', v_claim);
end $$;

revoke execute on function public.sync_upload_v1(text), public.sync_feed_v1(bigint, integer), public.realtime_claim_v1() from public, anon;
grant execute on function public.sync_upload_v1(text), public.sync_feed_v1(bigint, integer), public.realtime_claim_v1() to authenticated;

-- Only the account's own active session may join its private topic. Clients
-- never send on it: the server sends the hint and the claims.
create policy account_topic_receive on realtime.messages for select to authenticated
  using (realtime.topic() = 'account:' || private.active_account()::text and extension = 'broadcast');
