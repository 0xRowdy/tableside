-- The bootstrap names the caller's own installation (#52 review, from #96
-- and #101). sync_bootstrap_v1 took any installation the caller named, so a
-- session could replace another device's snapshot (each installation keeps
-- one). It now takes only the installation the caller's session registered,
-- as sync_scope_v1 and sync_upload_v1 do.

-- #96's snapshot as #98 left it (20261126101753_compaction_stale_devices.sql),
-- with that check once the head is held.
create or replace function public.sync_bootstrap_v1(installation text) returns jsonb
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
  -- Only the caller's own registered installation (#101's rule for uploads and scopes): a session can't take or replace another device's snapshot.
  if private.caller_installation(v_account) is distinct from installation then
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

  insert into private.bootstrap_rows (account_id, snapshot_id, ordinal, record_type, item_id, sequence, change)
    select v_account, v_snapshot, v_count + row_number() over (order by p.sequence, p.record_type, p.item_id), p.record_type, p.item_id, p.sequence, null
    from private.purged_results p where p.account_id = v_account;
  get diagnostics v_added = row_count;
  v_count := v_count + v_added;

  select coalesce(jsonb_agg(jsonb_build_object('total', total, 'game', game, 'currency', currency, 'records', records, 'net', net)
                            order by total, game, currency), '[]'::jsonb)
    into v_totals from private.account_totals where account_id = v_account;
  update private.bootstrap_snapshots set rows = v_count, totals = v_totals
    where account_id = v_account and snapshot_id = v_snapshot;

  return jsonb_build_object('status', 'snapshot', 'snapshot', v_snapshot, 'watermark', v_head, 'rows', v_count,
    'totals', v_totals, 'expiresAt', v_expires);
end $$;
