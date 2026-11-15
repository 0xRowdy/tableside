-- New-device bootstrap (spec 2, #96; *Bootstrap*, Amendments 1 A6, 2 §4,
-- 4 §1 and §3, 7 §3). A device with no baseline asks for a snapshot: under the
-- account's synchronization head, one transaction materializes every
-- registered type's summaries, the account's lifetime totals and the
-- watermark (the head's sequence) they all describe. The device then pages
-- the snapshot's immutable rows, stages them locally, and installs the
-- baseline with its feed cursor at the watermark, so later changes arrive
-- through the feed after it. No detail is copied: summaries and totals only
-- (Amendment 1 A6); detail comes by paging or on demand (#97).
--
-- - Snapshots expire 24 hours after they were made; a device that hadn't
--   finished asks for a new one, keeping its upload queue.
-- - A snapshot never holds what the feed no longer does: when the feed redacts
--   a change after the snapshot was made (a purged result, a resolved
--   conflict's rejected proposals), the snapshot's rows redact it the same way.
-- - Lock order is #91's: the head first, then the types' rows, then the snapshot's own.

-- ---------------------------------------------------------------------------
-- Registry: what each type puts in a snapshot
-- ---------------------------------------------------------------------------

-- `snapshot(account uuid, record_type text) returns table (item_id text, sequence bigint, change jsonb)`:
-- the type's summaries for a new device, each as a feed change of the type (so
-- the client's `fromChange` reads it) at the account sequence of the item's
-- latest change. Null: the type isn't in snapshots; its changes after the
-- watermark still arrive through the feed. The client half is the registry's `snapshot`.
alter table private.record_types add column snapshot regprocedure;

-- ---------------------------------------------------------------------------
-- Snapshots (not exposed through the API)
-- ---------------------------------------------------------------------------

create table private.bootstrap_snapshots (
  account_id uuid not null references public.accounts (account_id),
  snapshot_id uuid not null default gen_random_uuid(),
  -- The installation that asked: a new request from it replaces its earlier snapshot.
  installation_id text not null,
  -- The account sequence every row and the totals describe.
  watermark bigint not null,
  rows integer not null,
  totals jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (account_id, snapshot_id)
);

-- A snapshot's rows, numbered from 1. Immutable once made, except for the feed's redactions.
create table private.bootstrap_rows (
  account_id uuid not null,
  snapshot_id uuid not null,
  ordinal integer not null,
  record_type text not null,
  item_id text not null,
  sequence bigint not null,
  change jsonb not null,
  primary key (account_id, snapshot_id, ordinal),
  foreign key (account_id, snapshot_id) references private.bootstrap_snapshots (account_id, snapshot_id) on delete cascade
);

create index bootstrap_rows_items on private.bootstrap_rows (account_id, record_type, item_id);

revoke all on private.bootstrap_snapshots, private.bootstrap_rows from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The platform's snapshot functions
-- ---------------------------------------------------------------------------

-- Completed practice sessions: each accepted result's summary (#93's generated
-- column: the record without its outcomes and guidance), at its acceptance.
create function private.snapshot_completed_practice_sessions(p_account uuid, p_record_type text)
returns table (item_id text, sequence bigint, change jsonb)
language sql stable security definer set search_path = '' as $$
  select r.result_id, r.sequence, jsonb_build_object('record', r.summary)
  from private.practice_results r where r.account_id = p_account
$$;

-- Every revisioned type: each item's current accepted revision with its open
-- proposals, tombstones included (Amendment 4 §3), at the item's latest change.
create function private.snapshot_revisioned_items(p_account uuid, p_record_type text)
returns table (item_id text, sequence bigint, change jsonb)
language sql stable security definer set search_path = '' as $$
  select i.item_id,
         greatest(i.revision_sequence, coalesce((
           select max(p.sequence) from private.revision_proposals p
           where p.account_id = i.account_id and p.record_type = i.record_type and p.item_id = i.item_id), 0)),
         private.revisioned_item_change(i.account_id, i.record_type, i.item_id)
  from private.revisioned_items i where i.account_id = p_account and i.record_type = p_record_type
$$;

revoke execute on function private.snapshot_completed_practice_sessions(uuid, text), private.snapshot_revisioned_items(uuid, text) from public;

update private.record_types set snapshot = 'private.snapshot_completed_practice_sessions(uuid,text)'
  where record_type = 'completed-practice-session';

-- ---------------------------------------------------------------------------
-- Operations, protocol version 1
-- ---------------------------------------------------------------------------

-- Makes a snapshot for the caller's account, replacing the installation's
-- earlier one. Answers
--   {"snapshot","watermark","rows","totals":[{"total","game","currency","records","net"}],"expiresAt"}
-- The head is held for the whole transaction, so no authoritative change
-- commits while the rows and totals are read: they all describe `watermark`.
create function public.sync_bootstrap_v1(installation text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_account uuid := private.active_account();
  v_head bigint;
  v_snapshot uuid;
  v_expires timestamptz := now() + interval '24 hours';
  v_type record;
  v_count integer := 0;
  v_added integer;
  v_totals jsonb;
begin
  if v_account is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if coalesce(installation, '') !~ '^[A-Za-z0-9_-]{1,128}$' then
    return jsonb_build_object('status', 'malformed');
  end if;
  -- Contention on the head waits a bounded time; the client retries a bounded number of times.
  perform set_config('lock_timeout', '5s', true);
  insert into private.sync_heads (account_id) values (v_account) on conflict do nothing;
  select sequence into v_head from private.sync_heads where account_id = v_account for update;
  -- The gate again, now that the head serializes this with every authoritative change.
  if private.active_account() is distinct from v_account then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  delete from private.bootstrap_snapshots where account_id = v_account and installation_id = installation;
  insert into private.bootstrap_snapshots (account_id, installation_id, watermark, rows, totals, expires_at)
    values (v_account, installation, v_head, 0, '[]'::jsonb, v_expires)
    returning snapshot_id into v_snapshot;

  -- Each type's summaries, by the snapshot function of its latest payload version.
  for v_type in
    select distinct on (t.record_type) t.record_type, t.snapshot from private.record_types t
    where t.snapshot is not null order by t.record_type, t.payload_version desc
  loop
    execute format(
      'insert into private.bootstrap_rows (account_id, snapshot_id, ordinal, record_type, item_id, sequence, change)
       select $1, $2, $3 + row_number() over (order by s.sequence, s.item_id), $4, s.item_id, s.sequence, s.change
       from %s($1, $4) s', v_type.snapshot::regproc)
      using v_account, v_snapshot, v_count, v_type.record_type;
    get diagnostics v_added = row_count;
    v_count := v_count + v_added;
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object('total', total, 'game', game, 'currency', currency, 'records', records, 'net', net)
                            order by total, game, currency), '[]'::jsonb)
    into v_totals from private.account_totals where account_id = v_account;
  update private.bootstrap_snapshots set rows = v_count, totals = v_totals
    where account_id = v_account and snapshot_id = v_snapshot;

  return jsonb_build_object('status', 'snapshot', 'snapshot', v_snapshot, 'watermark', v_head, 'rows', v_count,
    'totals', v_totals, 'expiresAt', v_expires);
end $$;

-- One bounded page of a snapshot's rows after ordinal `after`, in order:
--   {"status":"page","rows":[{"ordinal","recordType","item","sequence","change"}],"more"}
-- or {"status":"expired"} once the snapshot is gone (24 hours, or replaced):
-- the device asks for a new one. Ordinals can skip where the feed redacted a row.
create function public.sync_bootstrap_page_v1(snapshot uuid, after integer, page_size integer default 100) returns jsonb
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
  select coalesce(jsonb_agg(jsonb_build_object('ordinal', r.ordinal, 'recordType', r.record_type, 'item', r.item_id,
                                               'sequence', r.sequence, 'change', r.change) order by r.ordinal), '[]'::jsonb),
         max(r.ordinal)
    into v_rows, v_last
    from (select * from private.bootstrap_rows b
          where b.account_id = v_account and b.snapshot_id = sync_bootstrap_page_v1.snapshot and b.ordinal > coalesce(after, 0)
          order by b.ordinal limit v_limit) r;
  return jsonb_build_object('status', 'page', 'rows', v_rows,
    'more', exists (select 1 from private.bootstrap_rows b
                    where b.account_id = v_account and b.snapshot_id = sync_bootstrap_page_v1.snapshot
                      and b.ordinal > coalesce(v_last, coalesce(after, 0))));
end $$;

revoke execute on function public.sync_bootstrap_v1(text), public.sync_bootstrap_page_v1(uuid, integer, integer) from public, anon;
grant execute on function public.sync_bootstrap_v1(text), public.sync_bootstrap_page_v1(uuid, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- The feed's redactions reach snapshots
-- ---------------------------------------------------------------------------

-- A purge empties a result's feed entries (#95); a resolution rewrites the
-- entries that carried its proposals with the resolved state (#94). The
-- snapshot rows of the same item follow: a purged result's go, and a row
-- carrying a now-resolved conflict carries the resolved state instead, so no
-- purged or rejected payload outlives its decision in a snapshot either.
create function private.redact_bootstrap_rows() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.change is null then
    delete from private.bootstrap_rows
      where account_id = new.account_id and record_type = new.record_type and item_id = new.item_id;
  else
    update private.bootstrap_rows set change = new.change
      where account_id = new.account_id and record_type = new.record_type and item_id = new.item_id
        and jsonb_typeof(change #> '{state,conflict}') = 'object';
  end if;
  return null;
end $$;

create trigger sync_feed_redacts_bootstrap_rows after update of change on private.sync_feed
  for each row when (old.change is distinct from new.change) execute function private.redact_bootstrap_rows();

-- ---------------------------------------------------------------------------
-- Job: snapshots expire 24 hours after they were made
-- ---------------------------------------------------------------------------

create function private.expire_bootstrap_snapshots() returns void
language sql security definer set search_path = '' as $$
  delete from private.bootstrap_snapshots where expires_at <= now()
$$;

revoke execute on function private.expire_bootstrap_snapshots(), private.redact_bootstrap_rows() from public;

select cron.schedule('expire-bootstrap-snapshots', '*/15 * * * *', 'select private.expire_bootstrap_snapshots()');
