-- Chunked results (spec 2, #93): a result too large for one request is staged
-- privately in bounded, content-hashed chunks, and its upload names a manifest
-- of them instead of the payload. Final acceptance verifies the manifest and
-- publishes the result, its summary, the receipt and the feed entry in the
-- upload's one transaction; staged chunks are never a result, never in the
-- feed, and expire after 24 hours without progress.
--
-- Limits (packages/account/src/sync/protocol.ts): a chunk holds at most
-- 49,152 bytes (48 KiB) of text, and an operation's request at most 131,072
-- bytes (128 KiB). The operations refuse anything larger. An account stages at
-- most 128 MiB at once, more than the largest result one manifest can name
-- (about 90 MiB), so the bound never stops a real result.

-- ---------------------------------------------------------------------------
-- Staging (not exposed through the API)
-- ---------------------------------------------------------------------------

-- One staged chunk, identified by its owner, its result (record type and item)
-- and its SHA-256. Staging the same bytes again changes nothing, so a resend
-- is not progress: the staging's last progress is its newest chunk's arrival.
create table private.staged_chunks (
  account_id uuid not null references public.accounts (account_id),
  record_type text not null,
  item_id text not null,
  sha256 text not null,
  data text not null,
  received_at timestamptz not null default now(),
  primary key (account_id, record_type, item_id, sha256)
);

revoke all on private.staged_chunks from public, anon, authenticated;

-- A result's summary: the practice session without its detail (every wager
-- outcome, and guided practice's adherence and departure log). It is part of
-- the accepted row, so it is published with the result and never apart from it.
alter table private.practice_results add column summary jsonb generated always as (payload - 'outcomes' - 'guidance') stored;

-- ---------------------------------------------------------------------------
-- Operations, protocol version 1
-- ---------------------------------------------------------------------------

-- Stages one chunk of a result for the caller's account. Answers staged,
-- incompatible, malformed (an unknown record type, a hash that isn't the
-- chunk's, or a chunk over the limit) or staging-full (the account's staging
-- is at its bound: it frees as uploads complete or staging expires).
create function public.sync_stage_chunk_v1(protocol integer, record_type text, item text, sha256 text, data text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_account uuid := private.active_account();
begin
  if v_account is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if protocol is distinct from 1 then
    return jsonb_build_object('status', 'incompatible', 'supported', jsonb_build_array(1));
  end if;
  if coalesce(item, '') !~ '^[A-Za-z0-9_:/.-]{1,200}$'
    or not exists (select 1 from private.record_types t where t.record_type = sync_stage_chunk_v1.record_type)
    or coalesce(sha256, '') !~ '^[0-9a-f]{64}$'
    or coalesce(octet_length(data), 0) not between 1 and 49152
    or encode(extensions.digest(data, 'sha256'), 'hex') <> sha256 then
    return jsonb_build_object('status', 'malformed');
  end if;
  if (select coalesce(sum(octet_length(s.data)), 0) from private.staged_chunks s where s.account_id = v_account) + octet_length(data) > 134217728 then
    return jsonb_build_object('status', 'staging-full');
  end if;
  insert into private.staged_chunks (account_id, record_type, item_id, sha256, data)
    values (v_account, sync_stage_chunk_v1.record_type, item, sha256, data)
    on conflict do nothing;
  return jsonb_build_object('status', 'staged');
end $$;

revoke execute on function public.sync_stage_chunk_v1(integer, text, text, text, text) from public, anon;
grant execute on function public.sync_stage_chunk_v1(integer, text, text, text, text) to authenticated;

-- Rebuilds a manifest's payload from the account's staged chunks for its
-- result. Answers:
--   {"status":"assembled","payload":{...}}       every chunk staged, and they rejoin to the manifest's text
--   {"status":"chunks-missing","missing":[i...]} the chunks (by index) not staged: nothing is decided
--   {"status":"rejected","code":"..."}           the chunks rejoin to other text, or not to a payload
--   {"status":"malformed"}                       the manifest can't be read
create function private.assemble_content(p_account uuid, p_request jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_content jsonb := p_request -> 'content';
  v_missing jsonb;
  v_text text;
  v_payload jsonb;
begin
  if p_request ? 'payload'
    or jsonb_typeof(v_content) is distinct from 'object'
    or coalesce(v_content ->> 'sha256', '') !~ '^[0-9a-f]{64}$'
    or jsonb_typeof(v_content -> 'chunks') is distinct from 'array'
    or jsonb_array_length(v_content -> 'chunks') = 0
    or exists (select 1 from jsonb_array_elements(v_content -> 'chunks') c
               where jsonb_typeof(c) is distinct from 'string' or (c #>> '{}') !~ '^[0-9a-f]{64}$') then
    return jsonb_build_object('status', 'malformed');
  end if;

  select coalesce(jsonb_agg(m.position - 1 order by m.position) filter (where s.sha256 is null), '[]'::jsonb),
         string_agg(s.data, '' order by m.position)
    into v_missing, v_text
    from jsonb_array_elements_text(v_content -> 'chunks') with ordinality m (sha256, position)
    left join private.staged_chunks s
      on s.account_id = p_account and s.record_type = p_request ->> 'recordType' and s.item_id = p_request ->> 'item' and s.sha256 = m.sha256;
  if jsonb_array_length(v_missing) > 0 then
    return jsonb_build_object('status', 'chunks-missing', 'missing', v_missing);
  end if;
  if encode(extensions.digest(v_text, 'sha256'), 'hex') <> v_content ->> 'sha256' then
    return jsonb_build_object('status', 'rejected', 'code', 'content-mismatch');
  end if;
  begin
    v_payload := v_text::jsonb;
  exception when others then
    return jsonb_build_object('status', 'rejected', 'code', 'invalid-payload');
  end;
  return jsonb_build_object('status', 'assembled', 'payload', v_payload);
end $$;

revoke execute on function private.assemble_content(uuid, jsonb) from public;

-- #91's upload operation, now refusing a request over the limit and accepting
-- a manifest in place of a payload. Everything else is as it was.
create or replace function public.sync_upload_v1(request text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_account uuid := private.active_account();
  v_request jsonb;
  v_hash text;
  v_operation text;
  v_head bigint;
  v_receipt private.sync_receipts;
  v_accept regprocedure;
  v_assembly jsonb;
  v_result jsonb;
  v_disposition jsonb;
begin
  if v_account is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  -- Contention on the head waits a bounded time; the client retries a bounded number of times.
  perform set_config('lock_timeout', '5s', true);

  if octet_length(request) > 131072 then
    return jsonb_build_object('status', 'malformed');
  end if;
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

  -- A manifest: the payload is rebuilt from the staged chunks it names. Until
  -- every one is staged nothing is decided, so the client stages them and sends
  -- the identical request again.
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

  if v_result is null then
    select accept into v_accept from private.record_types
      where record_type = v_request ->> 'recordType' and payload_version = (v_request ->> 'payloadVersion')::integer;
    if not found then
      v_result := jsonb_build_object('status', 'rejected', 'code', 'unknown-record-type');
    else
      execute format('select %s($1, $2, $3)', v_accept::regproc) into v_result using v_account, v_request, v_head + 1;
    end if;
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
  -- The manifest's chunks have served: the receipt answers every retry from now on.
  if v_assembly is not null then
    delete from private.staged_chunks
      where account_id = v_account and record_type = v_request ->> 'recordType' and item_id = v_request ->> 'item'
        and sha256 in (select jsonb_array_elements_text(v_request -> 'content' -> 'chunks'));
  end if;
  return v_disposition;
end $$;

-- ---------------------------------------------------------------------------
-- Job: abandoned staging expires 24 hours after its last progress
-- ---------------------------------------------------------------------------

create function private.expire_staged_chunks() returns void
language sql security definer set search_path = '' as $$
  delete from private.staged_chunks s
    using (select account_id, record_type, item_id from private.staged_chunks
           group by account_id, record_type, item_id
           having max(received_at) <= now() - interval '24 hours') abandoned
    where s.account_id = abandoned.account_id and s.record_type = abandoned.record_type and s.item_id = abandoned.item_id
$$;

revoke execute on function private.expire_staged_chunks() from public;

select cron.schedule('expire-staged-chunks', '*/15 * * * *', 'select private.expire_staged_chunks()');
