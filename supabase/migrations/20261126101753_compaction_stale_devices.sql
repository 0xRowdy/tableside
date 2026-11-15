-- Compaction and stale devices (spec 2, #98; *Compaction and stale devices*;
-- #43; Amendments 1 A5 and C6, 4 §1). Old receipts and feed detail are
-- pruned safely, and a device away for months refreshes and reconciles its
-- unsynced work without losing, duplicating or resurrecting anything.
--
-- - Command scopes. Each installation's commands in an account carry a
--   server-issued generation and a monotonic position within it (the
--   envelope's `command`), alongside the stable operation and result
--   identities. The installation reports the positions it has settled: every
--   one up to there is acknowledged on the device, or abandoned, and none is
--   sent or named in `after` again. That marker covers a contiguous range;
--   the compaction job drops receipts at or below it, and those above it
--   stay, gaps and all, as evidence. A command at a settled position, at a position another
--   command holds, or in a generation that isn't the installation's current
--   one is refused as a stale scope, never taken for a new command: the
--   device refreshes, reconciles its unsynced work, and asks for a new generation.
-- - Retiring a scope. A scope unseen for the policy's scope retention is
--   retired by the compaction job: its commands are refused from then on and
--   its receipts go. A device that comes back refreshes and reconciles.
-- - The feed's reset boundary. The job prunes feed entries older than the
--   policy's feed retention, recording the boundary in the same transaction
--   under the head. A device whose cursor is behind it is told to reset: it
--   takes a new snapshot (#96), keeping its upload queue and its local
--   records. Snapshots read the types' current rows, never the feed, so a
--   snapshot made after pruning is complete. Snapshots now also name the
--   results purged from the account, so a device away while a purge's feed
--   entry went still removes its copy.
-- - Protected controls (Amendment 1 A5). Every acknowledged sensitive outcome
--   (an account's lifecycle state, a revoked session, a purge, a command
--   scope's generation and settled marker, and what record types register:
--   sharing withdrawals, spec 6) is also appended to the control journal, in
--   the same transaction, with a monotonic position. Restore tooling (spec 7,
--   post-MVP) ships the journal to storage independent of the primary
--   backups and reapplies every entry after a restored backup's last position
--   before the restored copy serves anything.
-- - Retention rules (Amendment 1 C6). Every account-keyed private table has a
--   rule naming its endpoint; one kept past its natural endpoint names the
--   unresolved dependency and its owner. Seam 2 checks every table has one,
--   so a new record type registers its own.
--
-- Protocol 1 is unreleased: its envelope gains `command`, and the feed's
-- answer `reset`, in place (docs/development.md, *Releases*).
--
-- Lock order is #91's: the synchronization head, then receipts, then the
-- record type's own rows, then the feed.

-- ---------------------------------------------------------------------------
-- Tables (none exposed through the API)
-- ---------------------------------------------------------------------------

-- One current scope per (account, installation). A new generation replaces
-- the last, which is never served again: every earlier generation's command is refused.
create table private.command_scopes (
  account_id uuid not null references public.accounts (account_id),
  installation_id text not null,
  generation integer not null check (generation >= 1),
  -- Retired by the compaction job: refused until the installation asks for a new generation.
  retired boolean not null default false,
  -- Every position up to here is settled on the installation.
  settled bigint not null default 0 check (settled >= 0),
  seen_at timestamptz not null default now(),
  primary key (account_id, installation_id)
);

-- Every receipt is a command's: its scope and position. Spec 2 has never been
-- deployed, so no receipt is without them.
alter table private.sync_receipts
  add column generation integer not null check (generation >= 1),
  add column position bigint not null check (position >= 1);
create unique index sync_receipts_commands on private.sync_receipts (account_id, installation_id, generation, position);

-- The feed's reset boundary: entries up to here are pruned.
alter table private.sync_heads add column pruned_through bigint not null default 0 check (pruned_through >= 0);
-- When each entry committed: the feed's retention runs from it.
alter table private.sync_feed add column committed_at timestamptz not null default now();
create index sync_feed_committed on private.sync_feed (account_id, committed_at);

-- A snapshot row with no change names a result purged from the account.
alter table private.bootstrap_rows alter column change drop not null;

-- How long detail is kept before a boundary makes older requests safe to
-- reject or reconcile. Neither is a deletion deadline (the research's 15-day
-- ceiling isn't one either): spec 7's retention schedule (#57) sets the final values.
create table private.compaction_policy (
  singleton boolean primary key default true check (singleton),
  -- Feed entries older than this go behind the reset boundary; a device further behind takes a new snapshot.
  feed_retention interval not null check (feed_retention > interval '0'),
  -- A command scope unseen this long retires; its device refreshes and reconciles when it returns.
  scope_retention interval not null check (scope_retention > interval '0')
);
insert into private.compaction_policy (feed_retention, scope_retention) values (interval '60 days', interval '180 days');

-- The control journal (Amendment 1 A5): acknowledged sensitive outcomes, in
-- commit order, written in the transaction that makes each. Only the control
-- itself: no record body, payload or email.
create table private.control_journal (
  position bigint generated always as identity primary key,
  account_id uuid not null references public.accounts (account_id),
  kind text not null check (kind in ('account-state', 'session-revoked', 'command-scope', 'purge', 'record-control')),
  -- What it controls: the account, a session, an installation's scope, a purged result, a record type's item.
  subject text not null,
  control jsonb not null,
  committed_at timestamptz not null default now()
);
create index control_journal_accounts on private.control_journal (account_id, position);

-- Every account-keyed private table's retention rule (Amendment 1 C6; #43's
-- endpoints). An exception, kept past its natural endpoint, names the
-- unresolved dependency and who resolves it.
create table private.retention_rules (
  subject text primary key,
  endpoint text not null check (length(btrim(endpoint)) > 0),
  dependency text check (dependency is null or length(btrim(dependency)) > 0),
  owner text check (owner is null or length(btrim(owner)) > 0),
  check ((dependency is null) = (owner is null))
);

revoke all on private.command_scopes, private.compaction_policy, private.control_journal, private.retention_rules
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The control journal
-- ---------------------------------------------------------------------------

-- Appends one control. Record types call it for their own sensitive outcomes
-- (a sharing withdrawal), inside the acceptance transaction.
create function private.record_control(p_account uuid, p_kind text, p_subject text, p_control jsonb) returns void
language sql volatile security definer set search_path = '' as $$
  insert into private.control_journal (account_id, kind, subject, control) values (p_account, p_kind, p_subject, p_control)
$$;

create function private.journal_account_state() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.record_control(new.account_id, 'account-state', new.account_id::text, jsonb_build_object('state', new.state));
  return null;
end $$;

create trigger journal_account_state after update of state on public.accounts
  for each row when (old.state is distinct from new.state) execute function private.journal_account_state();

-- A revoked session (signed out here or elsewhere, or revoked from another
-- device) must stay revoked whatever is restored.
create function private.journal_session_revocation() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_account uuid;
begin
  select account_id into v_account from public.accounts where auth_user_id = old.user_id;
  if v_account is not null then
    perform private.record_control(v_account, 'session-revoked', old.id::text, '{}'::jsonb);
  end if;
  return null;
end $$;

create trigger journal_session_revocation after delete on auth.sessions
  for each row execute function private.journal_session_revocation();

revoke execute on function private.record_control(uuid, text, text, jsonb), private.journal_account_state(),
  private.journal_session_revocation() from public;

-- ---------------------------------------------------------------------------
-- Command scopes, protocol version 1
-- ---------------------------------------------------------------------------

-- An installation's command scope in the caller's account.
--   generation null: the installation holds none (a new database). A new
--     generation is issued, replacing any earlier one: its positions start
--     from 1, and every earlier generation's command is refused.
--   generation g: the installation's current one, and `settled`, the
--     position it has settled through. The marker only rises, and from this
--     transaction on a command at or below it is refused without its receipt;
--     the compaction job drops those receipts.
-- Answers {"status":"scope","generation","settled"}, or
-- {"status":"stale-scope"} when g isn't the current, unretired generation: the
-- device refreshes and reconciles, then asks again with none.
create function public.sync_scope_v1(installation text, generation integer default null, settled bigint default null) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_account uuid := private.active_account();
  v_scope private.command_scopes;
begin
  if v_account is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if coalesce(installation, '') !~ '^[A-Za-z0-9_-]{1,128}$'
    or sync_scope_v1.generation < 1 or sync_scope_v1.settled < 0
    or (sync_scope_v1.generation is null and sync_scope_v1.settled is not null) then
    return jsonb_build_object('status', 'malformed');
  end if;
  perform set_config('lock_timeout', '5s', true);
  insert into private.sync_heads (account_id) values (v_account) on conflict do nothing;
  perform 1 from private.sync_heads where account_id = v_account for update;
  if private.active_account() is distinct from v_account then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select * into v_scope from private.command_scopes s
    where s.account_id = v_account and s.installation_id = installation for update;

  if sync_scope_v1.generation is null then
    if found then
      update private.command_scopes s set generation = s.generation + 1, retired = false, settled = 0, seen_at = now()
        where s.account_id = v_account and s.installation_id = installation
        returning * into v_scope;
      -- Every earlier generation's command is refused now, so no receipt of one is needed.
      delete from private.sync_receipts r where r.account_id = v_account and r.installation_id = installation;
    else
      insert into private.command_scopes (account_id, installation_id, generation) values (v_account, installation, 1)
        returning * into v_scope;
    end if;
    perform private.record_control(v_account, 'command-scope', installation,
      jsonb_build_object('generation', v_scope.generation, 'settled', 0));
    return jsonb_build_object('status', 'scope', 'generation', v_scope.generation, 'settled', 0);
  end if;

  if not found or v_scope.retired or v_scope.generation <> sync_scope_v1.generation then
    return jsonb_build_object('status', 'stale-scope');
  end if;
  if coalesce(sync_scope_v1.settled, 0) > v_scope.settled then
    update private.command_scopes s set settled = sync_scope_v1.settled, seen_at = now()
      where s.account_id = v_account and s.installation_id = installation
      returning * into v_scope;
    perform private.record_control(v_account, 'command-scope', installation,
      jsonb_build_object('generation', v_scope.generation, 'settled', v_scope.settled));
  else
    update private.command_scopes s set seen_at = now() where s.account_id = v_account and s.installation_id = installation;
  end if;
  return jsonb_build_object('status', 'scope', 'generation', v_scope.generation, 'settled', v_scope.settled);
end $$;

revoke execute on function public.sync_scope_v1(text, integer, bigint) from public, anon;
grant execute on function public.sync_scope_v1(text, integer, bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- Operation API, protocol version 1 (replaces #95's sync_upload_v1, keeping
-- its barriers, positions, purges and chunk manifests)
-- ---------------------------------------------------------------------------

-- The envelope gains `command`: {"generation","position"}, the command's
-- scope and its position there, required on every upload. Under the head:
--   a generation retired, or not the installation's current one (replaced, or never issued);
--   a position the installation has settled, whose receipt is gone;
--   a position another command holds
-- each answer {"status":"stale-scope","reason":"retired"|"replaced"|"settled"|"reused"}
-- and record nothing: a missing receipt is never taken for a new command.
-- An identical retry of a command with its receipt still answers from it.
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
  v_generation integer;
  v_command bigint;
  v_scope private.command_scopes;
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
    or jsonb_typeof(v_request -> 'command') is distinct from 'object'
    or (select count(*) from jsonb_object_keys(v_request -> 'command')) <> 2
    or jsonb_typeof(v_request #> '{command,generation}') is distinct from 'number'
    or (v_request #>> '{command,generation}') !~ '^[1-9][0-9]{0,8}$'
    or jsonb_typeof(v_request #> '{command,position}') is distinct from 'number'
    or (v_request #>> '{command,position}') !~ '^[1-9][0-9]{0,14}$'
    or (v_request ? 'after' and (jsonb_typeof(v_request -> 'after') is distinct from 'array'
      or jsonb_array_length(v_request -> 'after') not between 1 and 100
      or exists (select 1 from jsonb_array_elements(v_request -> 'after') a
                 where jsonb_typeof(a) is distinct from 'string' or (a #>> '{}') !~ '^[0-9a-f]{32}$')))
    or (v_request ? 'position' and (jsonb_typeof(v_request -> 'position') is distinct from 'number'
      or (v_request ->> 'position') !~ '^[1-9][0-9]{0,14}$')) then
    return jsonb_build_object('status', 'malformed');
  end if;
  v_position := (v_request ->> 'position')::bigint;
  v_generation := (v_request #>> '{command,generation}')::integer;
  v_command := (v_request #>> '{command,position}')::bigint;
  v_hash := encode(extensions.digest(request, 'sha256'), 'hex');

  insert into private.sync_heads (account_id) values (v_account) on conflict do nothing;
  select sequence into v_head from private.sync_heads where account_id = v_account for update;
  -- The gate again, now that the head serializes this upload with every other
  -- authoritative change: a deletion scheduled or a session revoked while this
  -- upload waited is seen here, and the upload is denied.
  if private.active_account() is distinct from v_account then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  -- The command's scope: only the installation's current, unretired generation is served.
  select * into v_scope from private.command_scopes where account_id = v_account and installation_id = v_installation;
  if not found or v_scope.retired or v_scope.generation <> v_generation then
    return jsonb_build_object('status', 'stale-scope', 'reason', case when found and v_scope.retired and v_scope.generation = v_generation then 'retired' else 'replaced' end,
      'operation', v_operation);
  end if;

  select * into v_receipt from private.sync_receipts where account_id = v_account and operation_id = v_operation;
  if found then
    if v_receipt.request_hash = v_hash then
      return v_receipt.disposition;
    end if;
    -- Not a receipt: the operation's real receipt stays as it is.
    return jsonb_build_object('status', 'operation-reused', 'operation', v_operation);
  end if;

  -- No receipt: a new command, unless its position says otherwise.
  if v_command <= v_scope.settled then
    return jsonb_build_object('status', 'stale-scope', 'reason', 'settled', 'operation', v_operation);
  end if;
  if exists (select 1 from private.sync_receipts r
             where r.account_id = v_account and r.installation_id = v_installation
               and r.generation = v_generation and r.position = v_command) then
    return jsonb_build_object('status', 'stale-scope', 'reason', 'reused', 'operation', v_operation);
  end if;

  -- Barriers: under the head, every operation it waits for must already have
  -- its receipt. Not a receipt either: nothing is recorded. The installation
  -- names only its current generation's operations, which keep their receipts
  -- until it settles them.
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

  insert into private.sync_receipts (account_id, operation_id, request_hash, installation_id, record_type, item_id, disposition, generation, position)
    values (v_account, v_operation, v_hash, v_installation, v_request ->> 'recordType', v_item, v_disposition, v_generation, v_command);
  update private.command_scopes set seen_at = now() where account_id = v_account and installation_id = v_installation;
  -- The manifest's chunks have served: the receipt answers every retry from now on.
  if v_assembly is not null then
    delete from private.staged_chunks
      where account_id = v_account and record_type = v_request ->> 'recordType' and item_id = v_request ->> 'item'
        and sha256 in (select jsonb_array_elements_text(v_request -> 'content' -> 'chunks'));
  end if;
  return v_disposition;
end $$;

-- One bounded page of the account's feed after `after`, in sequence order:
--   {"entries":[...],"more"}
-- or, when `after` is behind the reset boundary (those entries are pruned),
--   {"status":"reset","through":n}: the device takes a new snapshot, keeping its queue.
-- Stable, so the boundary and the page come from one snapshot of the database.
create or replace function public.sync_feed_v1(after bigint, page_size integer default 50) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_account uuid := private.active_account();
  v_limit integer := least(greatest(coalesce(page_size, 50), 1), 100);
  v_pruned bigint;
  v_entries jsonb;
  v_last bigint;
begin
  if v_account is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  select pruned_through into v_pruned from private.sync_heads where account_id = v_account;
  if coalesce(after, 0) < coalesce(v_pruned, 0) then
    return jsonb_build_object('status', 'reset', 'through', v_pruned);
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
-- Snapshots name purged results (replaces #96's sync_bootstrap_v1)
-- ---------------------------------------------------------------------------

-- As #96's, and after every type's summaries, one row per result purged from
-- the account, with no change: a device that missed the purge's feed entry
-- (it was pruned) removes its copy, and never accepts it again.
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

-- ---------------------------------------------------------------------------
-- Purges are protected controls (replaces #95's purge_result)
-- ---------------------------------------------------------------------------

create or replace function private.purge_result(p_account uuid, p_record_type text, p_item text, p_sequence bigint) returns jsonb
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
  perform private.record_control(p_account, 'purge', p_record_type || '/' || p_item, jsonb_build_object('sequence', p_sequence));
  update private.sync_feed set change = null
    where account_id = p_account and record_type = p_record_type and item_id = p_item;
  return jsonb_build_object('status', 'accepted',
    'change', jsonb_build_object('purge', jsonb_build_object('recordType', p_record_type, 'item', p_item)));
end $$;

-- ---------------------------------------------------------------------------
-- Job: compaction
-- ---------------------------------------------------------------------------

-- Compacts one account, under its head; an account whose head is busy is
-- left for the next run, and the answer says whether it was compacted:
-- - receipts at or below their scope's settled marker go: their commands are
--   refused without them, and nothing names them any more;
-- - scopes unseen for the scope retention retire, and their receipts go;
-- - feed entries older than the feed retention go behind the reset boundary,
--   recorded in this transaction, with any snapshot made before it (a device
--   still staging one takes a new one: it would reset straight away).
create function private.compact_account(p_account uuid) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_policy private.compaction_policy;
  v_boundary bigint;
  v_retired record;
begin
  perform 1 from private.sync_heads where account_id = p_account for update skip locked;
  if not found then
    return false;
  end if;
  select * into v_policy from private.compaction_policy;
  delete from private.sync_receipts r using private.command_scopes s
    where r.account_id = p_account and s.account_id = p_account and s.installation_id = r.installation_id
      and r.generation = s.generation and r.position <= s.settled;
  for v_retired in
    update private.command_scopes s set retired = true
      where s.account_id = p_account and not s.retired and s.seen_at < now() - v_policy.scope_retention
      returning s.installation_id, s.generation, s.settled
  loop
    delete from private.sync_receipts r where r.account_id = p_account and r.installation_id = v_retired.installation_id;
    perform private.record_control(p_account, 'command-scope', v_retired.installation_id,
      jsonb_build_object('generation', v_retired.generation, 'settled', v_retired.settled, 'retired', true));
  end loop;

  select max(f.sequence) into v_boundary from private.sync_feed f
    where f.account_id = p_account and f.committed_at < now() - v_policy.feed_retention;
  if v_boundary is not null and v_boundary > (select pruned_through from private.sync_heads where account_id = p_account) then
    update private.sync_heads set pruned_through = v_boundary where account_id = p_account;
    delete from private.bootstrap_snapshots where account_id = p_account and watermark < v_boundary;
    delete from private.sync_feed where account_id = p_account and sequence <= v_boundary;
  end if;
  return true;
end $$;

-- Every account, one transaction each, so no head is held longer than its own compaction.
create procedure private.compact_sync()
language plpgsql as $$
declare
  v_account uuid;
begin
  for v_account in select h.account_id from private.sync_heads h order by h.account_id loop
    perform private.compact_account(v_account);
    commit;
  end loop;
end $$;

revoke execute on function private.compact_account(uuid) from public;
revoke execute on procedure private.compact_sync() from public;

select cron.schedule('compact-sync', '43 3 * * *', 'call private.compact_sync()');

-- ---------------------------------------------------------------------------
-- Retention rules (Amendment 1 C6; #43's endpoints)
-- ---------------------------------------------------------------------------

insert into private.retention_rules (subject, endpoint, dependency, owner) values
  ('private.sync_receipts',
   'A command''s receipt goes at the next compaction once its installation has settled its position (acknowledged on the device, or abandoned, and named by no pending command), or its scope retires or is replaced. Above the settled marker receipts stay, gaps included, as evidence.',
   null, null),
  ('private.command_scopes',
   'The current device progress marker: kept while the scope is authoritative. A retired scope keeps only its generation, so its old commands stay refused.',
   null, null),
  ('private.sync_feed',
   'Entries older than the feed retention go behind the reset boundary (compact-sync); a device further behind takes a new snapshot.',
   null, null),
  ('private.sync_heads',
   'The account''s sequence and reset boundary: kept while the account exists.',
   null, null),
  ('private.realtime_claims', 'The newest live-connection claim: kept while the account exists.', null, null),
  ('private.purged_results',
   'The deleted-result receipt (Amendment 4 §1): only the identity and the purging sequence, kept while any device or queued upload could resend the result, and named in every snapshot so a device away during the purge removes its copy.',
   'Proof that no installation still holds the result unsettled: a retired scope''s device can return at any time, so none is available yet.',
   'Spec 7 (#57), retention schedule'),
  ('private.control_journal',
   'Acknowledged sensitive outcomes, kept until every usable recovery source is newer than the entry.',
   'Independent copies of the journal and backup retention: restore tooling.',
   'Spec 7 (#57), backups and restore fencing'),
  ('private.staged_chunks', 'Abandoned staging expires 24 hours after its last progress (expire-staged-chunks); used chunks go with their receipt.', null, null),
  ('private.bootstrap_snapshots', 'Expire 24 hours after they were made (expire-bootstrap-snapshots), or once behind the reset boundary.', null, null),
  ('private.bootstrap_rows', 'Go with their snapshot.', null, null),
  ('private.device_positions', 'A per-device record''s position: kept while its record is.', null, null),
  ('private.practice_results', 'Accepted results: kept while the account exists, until purged.', null, null),
  ('private.revisioned_items', 'The accepted revision and its tombstone: kept while the account exists.', null, null),
  ('private.revision_proposals', 'Open proposals: removed when their conflict is resolved, keeping only receipts and identities.', null, null),
  ('private.account_totals', 'Current totals: kept while the account exists.', null, null),
  ('public.accounts',
   'The account and its lifecycle state. A deleted account''s row is its deletion control: its ID stays denied and is never reused.',
   'Removing residual deletion controls once no credential or usable recovery source can resurrect the account.',
   'Permanent deletion (#104), with spec 7''s backup retention (#57)'),
  ('public.eligibility', 'One current eligibility record per account, replaced rather than kept as history; removed by deletion.', null, null),
  ('private.reviewer_accounts', 'A designated reviewer account''s credential: kept while the account is designated (#107).', null, null);
