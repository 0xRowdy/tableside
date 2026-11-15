-- History detail (spec 2, #97; *History*, Amendments 1 A6 and C5, 2 §4,
-- 4 §3). A bootstrap snapshot holds summaries; a device then asks for
-- records' detail by the accepted revision it holds: the newest 90 days'
-- after the summaries, older detail when a record is opened, and everything
-- with Download all history. Pages of the feed, of snapshots and of details
-- are bounded by bytes as well as rows.
--
-- - A detail is answered only for the revision asked for. When the account
--   holds another revision (or none), the answer says so and the device
--   applies the feed first: a detail never skips the feed.
-- - A budget alert throttles optional bulk downloads (Download all history)
--   first, and never deletes history (Amendment 1 C5): recent and opened
--   detail are always served.
-- - Nothing here deletes or prunes any record.

-- The most one page of the feed, of a snapshot or of details carries: the
-- UTF-8 bytes of its entries' JSON. A page always holds at least one entry, so
-- a larger entry comes by itself. The client's PAGE_BYTES (packages/account/src/sync/protocol.ts).
create function private.page_bytes() returns integer
language sql immutable set search_path = '' as $$ select 262144 $$;

revoke execute on function private.page_bytes() from public;

-- ---------------------------------------------------------------------------
-- Registry: how each type serves its detail
-- ---------------------------------------------------------------------------

-- `detail(account uuid, record_type text, item text) returns table (sequence bigint, change jsonb)`:
-- the item's accepted change whole (a feed change of the type, so the client's
-- `fromChange` reads it) at the account sequence its snapshot row carries; no
-- row when the account doesn't hold the item. Null: what the type's snapshot
-- holds is whole. The client half is the registry's `detail.server`.
alter table private.record_types add column detail regprocedure;

-- Completed practice sessions: the accepted record whole, at its acceptance.
create function private.detail_completed_practice_sessions(p_account uuid, p_record_type text, p_item text)
returns table (sequence bigint, change jsonb)
language sql stable security definer set search_path = '' as $$
  select r.sequence, jsonb_build_object('record', r.payload)
  from private.practice_results r where r.account_id = p_account and r.result_id = p_item
$$;

revoke execute on function private.detail_completed_practice_sessions(uuid, text, text) from public;

update private.record_types set detail = 'private.detail_completed_practice_sessions(uuid,text,text)'
  where record_type = 'completed-practice-session';

-- ---------------------------------------------------------------------------
-- Budget alert (not exposed through the API)
-- ---------------------------------------------------------------------------

-- The environment's one budget alert. Spec 7's cost alerting raises and clears
-- it; while it is active, bulk history downloads are asked to wait
-- `retry_after` seconds. It changes nothing else.
create table private.budget_alert (
  singleton boolean primary key default true check (singleton),
  active boolean not null default false,
  retry_after integer not null default 3600 check (retry_after between 60 and 86400),
  changed_at timestamptz not null default now()
);

insert into private.budget_alert default values;

revoke all on private.budget_alert from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Operations, protocol version 1
-- ---------------------------------------------------------------------------

-- Records' detail for the caller's account, by the revision the device holds.
-- `requests` is [{"recordType","item","sequence"}] (1 to 100); `bulk` marks
-- Download all history. Answers
--   {"status":"details","answers":[{"recordType","item","status":"detail","sequence","change"}
--                                 | {"recordType","item","status":"changed","sequence"}
--                                 | {"recordType","item","status":"gone"}]}
-- for the requests in order, as many as fit `page_bytes()` (at least one; the
-- device asks again for the rest), or {"status":"throttled","retryAfter":s}
-- for a bulk request under a budget alert, or {"status":"malformed"}.
create function public.sync_details_v1(requests jsonb, bulk boolean default false) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_account uuid := private.active_account();
  v_retry integer;
  v_request jsonb;
  v_detail regprocedure;
  v_sequence bigint;
  v_change jsonb;
  v_answer jsonb;
  v_answers jsonb := '[]'::jsonb;
  v_bytes bigint := 0;
  v_size integer;
begin
  if v_account is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if jsonb_typeof(requests) is distinct from 'array' or jsonb_array_length(requests) not between 1 and 100
    or exists (select 1 from jsonb_array_elements(requests) r
               where jsonb_typeof(r.value) is distinct from 'object'
                 or jsonb_typeof(r.value -> 'recordType') is distinct from 'string'
                 or coalesce(r.value ->> 'item', '') !~ '^[A-Za-z0-9_:/.-]{1,200}$'
                 or coalesce(r.value ->> 'sequence', '') !~ '^[1-9][0-9]{0,17}$') then
    return jsonb_build_object('status', 'malformed');
  end if;
  if coalesce(bulk, false) then
    select a.retry_after into v_retry from private.budget_alert a where a.active;
    if found then
      return jsonb_build_object('status', 'throttled', 'retryAfter', v_retry);
    end if;
  end if;

  for v_request in select r.value from jsonb_array_elements(requests) with ordinality r (value, position) order by r.position loop
    v_sequence := null;
    v_change := null;
    -- The detail function of the type's latest payload version.
    select t.detail into v_detail from private.record_types t
      where t.record_type = v_request ->> 'recordType' and t.detail is not null
      order by t.payload_version desc limit 1;
    if found then
      execute format('select d.sequence, d.change from %s($1, $2, $3) d', v_detail::regproc)
        into v_sequence, v_change using v_account, v_request ->> 'recordType', v_request ->> 'item';
    end if;
    v_answer := jsonb_build_object('recordType', v_request ->> 'recordType', 'item', v_request ->> 'item') || case
      when v_sequence is null then jsonb_build_object('status', 'gone')
      when v_sequence <> (v_request ->> 'sequence')::bigint then jsonb_build_object('status', 'changed', 'sequence', v_sequence)
      else jsonb_build_object('status', 'detail', 'sequence', v_sequence, 'change', v_change)
    end;
    v_size := octet_length(v_answer::text);
    exit when jsonb_array_length(v_answers) > 0 and v_bytes + v_size > private.page_bytes();
    v_answers := v_answers || jsonb_build_array(v_answer);
    v_bytes := v_bytes + v_size;
  end loop;
  return jsonb_build_object('status', 'details', 'answers', v_answers);
end $$;

revoke execute on function public.sync_details_v1(jsonb, boolean) from public, anon;
grant execute on function public.sync_details_v1(jsonb, boolean) to authenticated;

-- #91's feed page, now also bounded by bytes: entries in sequence order after
-- `after`, at most `page_size` of them (up to 100) and no more than
-- `page_bytes()` of entries, except that a page always holds the next entry. Its
-- arguments and answer are as they were.
create or replace function public.sync_feed_v1(after bigint, page_size integer default 50) returns jsonb
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
  select coalesce(jsonb_agg(p.entry order by p.sequence), '[]'::jsonb), max(p.sequence)
    into v_entries, v_last
    from (select e.sequence, e.entry,
                 row_number() over (order by e.sequence) as n,
                 sum(octet_length(e.entry::text)) over (order by e.sequence) as running
          from (select f.sequence,
                       jsonb_build_object('sequence', f.sequence, 'recordType', f.record_type, 'item', f.item_id, 'change', f.change) as entry
                from private.sync_feed f
                where f.account_id = v_account and f.sequence > coalesce(sync_feed_v1.after, 0)
                order by f.sequence limit v_limit) e) p
    where p.n = 1 or p.running <= private.page_bytes();
  return jsonb_build_object(
    'entries', v_entries,
    'more', exists (select 1 from private.sync_feed f
                    where f.account_id = v_account and f.sequence > coalesce(v_last, coalesce(sync_feed_v1.after, 0))));
end $$;

-- #96's snapshot page, now also bounded by bytes the same way.
create or replace function public.sync_bootstrap_page_v1(snapshot uuid, after integer, page_size integer default 100) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_account uuid := private.active_account();
  v_limit integer := least(greatest(coalesce(page_size, 100), 1), 500);
  v_rows jsonb;
  v_last integer;
begin
  if v_account is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if not exists (select 1 from private.bootstrap_snapshots s
                 where s.account_id = v_account and s.snapshot_id = sync_bootstrap_page_v1.snapshot and s.expires_at > now()) then
    return jsonb_build_object('status', 'expired');
  end if;
  select coalesce(jsonb_agg(p.entry order by p.ordinal), '[]'::jsonb), max(p.ordinal)
    into v_rows, v_last
    from (select e.ordinal, e.entry,
                 row_number() over (order by e.ordinal) as n,
                 sum(octet_length(e.entry::text)) over (order by e.ordinal) as running
          from (select b.ordinal,
                       jsonb_build_object('ordinal', b.ordinal, 'recordType', b.record_type, 'item', b.item_id,
                                          'sequence', b.sequence, 'change', b.change) as entry
                from private.bootstrap_rows b
                where b.account_id = v_account and b.snapshot_id = sync_bootstrap_page_v1.snapshot
                  and b.ordinal > coalesce(sync_bootstrap_page_v1.after, 0)
                order by b.ordinal limit v_limit) e) p
    where p.n = 1 or p.running <= private.page_bytes();
  return jsonb_build_object('status', 'page', 'rows', v_rows,
    'more', exists (select 1 from private.bootstrap_rows b
                    where b.account_id = v_account and b.snapshot_id = sync_bootstrap_page_v1.snapshot
                      and b.ordinal > coalesce(v_last, coalesce(sync_bootstrap_page_v1.after, 0))));
end $$;
