-- Server export (spec 2, #102; S2-21; *Export*, Amendments 1 B2, 5 §3, 6 §3,
-- 7 §6 and 8 §2).
--
-- A player who confirmed it's them (fresh authentication) asks for a copy of
-- everything the account holds here. A job builds it: under the account's
-- synchronization head, one transaction writes every file of the archive as
-- parts (each registered type's export rendering, the account's own data and
-- the manifest), so the archive describes one snapshot; the export-job
-- function then assembles the parts into a zip in the private
-- `account-exports` bucket and emails "export ready".
--
-- - Downloading goes through the bucket's storage policy with the player's own
--   token, so it is authorized against live state on every request: the
--   export must be ready and under 24 hours old, and the caller's session live,
--   freshly authenticated and on the account's export path. There is no
--   bearer link: the email only says where to find it.
-- - Asking again replaces the earlier export (regeneration). Revoking any of
--   the account's sessions ends every export at once (the policy then denies
--   it); scheduling deletion does too, through private.invalidate_exports.
-- - Every file the job leaves behind is removed: a failed or abandoned build's
--   parts and partial object, an ended export's archive. Storage objects can
--   be removed only through the Storage API, so the database wakes the
--   export-job function (pg_net) to remove them; a cron job wakes it too.
--
-- Lock order is #91's: the synchronization head, then the account's exports.
-- What changes an account's exports together with its records (a request, a
-- revocation, deletion scheduling, a build's snapshot) takes the head first;
-- the job's own state changes on one export (finish, fail, expire, removed)
-- take only that export's row, so they never wait for a head.

-- ---------------------------------------------------------------------------
-- Registry: each type's export rendering
-- ---------------------------------------------------------------------------

-- `export(account uuid, record_type text) returns table (item_id text, record jsonb)`:
--   the type's records as the archive's versioned JSON, in the order it lists
--   them, in `<export_file>.json`. Null: the type isn't in the archive.
-- `export_csv(account uuid, record_type text) returns table (item_id text, cells text[])`:
--   one CSV row per record under `export_csv_header`, in `<export_file>.csv`.
--   The client half is the registry's `export` (packages/account/src/sync/registry.ts).
alter table private.record_types
  add column export regprocedure,
  add column export_file text check (export_file ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  add column export_csv regprocedure,
  add column export_csv_header text[],
  add constraint record_types_export check (
    (export is null) = (export_file is null)
    and (export_csv is null or export is not null)
    and (export_csv is null) = (export_csv_header is null));

-- An instant in milliseconds since the epoch as the client's Date#toISOString
-- writes it (UTC, milliseconds), exactly.
create function private.export_instant(p_ms bigint) returns text
language sql immutable set search_path = '' as $$
  select to_char((timestamptz 'epoch' + p_ms * interval '1 millisecond') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
$$;

-- One CSV line (RFC 4180): a cell with a comma, quote or line break is quoted.
create function private.csv_line(p_cells text[]) returns text
language sql immutable set search_path = '' as $$
  select string_agg(case when c ~ '[",\r\n]' then '"' || replace(c, '"', '""') || '"' else coalesce(c, '') end, ',' order by n) || E'\r\n'
  from unnest(p_cells) with ordinality as cell(c, n)
$$;

-- Completed practice sessions: each accepted record whole, oldest first.
-- Purged results (Amendment 4 §1) have no row, so they are never exported.
create function private.export_completed_practice_sessions(p_account uuid, p_record_type text)
returns table (item_id text, record jsonb)
language sql stable security definer set search_path = '' as $$
  select r.result_id, r.payload from private.practice_results r
  where r.account_id = p_account
  order by (r.payload ->> 'endedAt')::bigint, r.result_id
$$;

-- The session summaries: the registry's CSV rendering, cell for cell.
create function private.export_csv_completed_practice_sessions(p_account uuid, p_record_type text)
returns table (item_id text, cells text[])
language sql stable security definer set search_path = '' as $$
  select r.result_id, array[
    r.payload ->> 'activityId',
    r.payload ->> 'game',
    r.payload ->> 'mode',
    private.export_instant((r.payload ->> 'startedAt')::bigint),
    private.export_instant((r.payload ->> 'endedAt')::bigint),
    r.payload ->> 'buyIn',
    r.payload ->> 'cumulativeFunding',
    r.payload ->> 'finalCashOut',
    r.payload ->> 'netResult',
    r.payload ->> 'turnsPlayed']
  from private.practice_results r
  where r.account_id = p_account
  order by (r.payload ->> 'endedAt')::bigint, r.result_id
$$;

-- Every revisioned type: each item's accepted revision (a tombstone says
-- deleted), with any open conflict's proposals as they are. Export never
-- reconciles a conflict.
create function private.export_revisioned_items(p_account uuid, p_record_type text)
returns table (item_id text, record jsonb)
language sql stable security definer set search_path = '' as $$
  select i.item_id, jsonb_build_object('item', i.item_id) || (private.revisioned_item_change(i.account_id, i.record_type, i.item_id) -> 'state')
  from private.revisioned_items i
  where i.account_id = p_account and i.record_type = p_record_type
  order by i.item_id
$$;

-- Privacy choices (Amendment 8 §2): the current choices and every analytics
-- ID the account has had, one per consent generation.
create function private.export_privacy_choices(p_account uuid, p_record_type text)
returns table (item_id text, record jsonb)
language sql stable security definer set search_path = '' as $$
  select 'current', jsonb_build_object(
    'analyticsConsent', coalesce(c.analytics_consent, 'never-granted'),
    'consentGeneration', coalesce(c.analytics_generation, 0),
    'adDataOptOut', case when c.ad_data_opt_out_source is null then null else jsonb_build_object('source', c.ad_data_opt_out_source) end,
    'analyticsIds', coalesce((
      select jsonb_agg(jsonb_build_object('generation', g.generation, 'analyticsId', g.analytics_id) order by g.generation)
      from private.analytics_ids g where g.account_id = p_account), '[]'::jsonb))
  from (select 1) one
  left join private.privacy_choices c on c.account_id = p_account
$$;

update private.record_types set
  export = 'private.export_completed_practice_sessions(uuid,text)',
  export_file = 'practice-sessions',
  export_csv = 'private.export_csv_completed_practice_sessions(uuid,text)',
  export_csv_header = array['practice_session_id', 'game', 'mode', 'started_at', 'ended_at', 'buy_in', 'total_funding', 'final_cash_out', 'net_result', 'turns_played']
  where record_type = 'completed-practice-session';
update private.record_types set export = 'private.export_privacy_choices(uuid,text)', export_file = 'privacy-choices'
  where record_type = 'privacy-choice';

-- ---------------------------------------------------------------------------
-- The account's own data, and what the archive leaves out
-- ---------------------------------------------------------------------------

-- account.json: the account, its settings, eligibility record, sign-in
-- methods (each with the address it goes by; never a credential), devices
-- (what each called itself) and lifetime totals. Later specs' sections are
-- here with nothing in them until those specs record it, and each replaces
-- this function to fill its own: spec 5 the offline game, allowance timezone,
-- plan status and per-day allowance usage (Amendment 5 §3) and the experiment
-- group and policy version (Amendment 6 §3); spec 6 the community records
-- (Amendment 7 §6). No token, key, receipt, status credential, installation
-- secret or other player's data is ever read here.
create function private.export_account_data(p_account uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'version', 1,
    'account', jsonb_build_object('id', a.account_id, 'createdAt', a.created_at),
    'settings', jsonb_build_object('currency', a.currency, 'offlineGame', null, 'allowanceTimezone', null),
    'eligibility', (
      select jsonb_build_object('band', e.band, 'source', e.source, 'checkedAt', e.checked_at, 'policyVersion', e.policy_version)
      from public.eligibility e where e.account_id = a.account_id),
    'signInMethods', coalesce((
      select jsonb_agg(jsonb_build_object('method', i.provider, 'email', i.email, 'addedAt', i.created_at) order by i.created_at, i.id)
      from auth.identities i where i.user_id = a.auth_user_id), '[]'::jsonb),
    'devices', coalesce((
      select jsonb_agg(jsonb_build_object('platform', d.platform, 'label', d.label, 'lastActiveAt', d.last_active_at) order by d.last_active_at desc nulls last)
      from private.account_devices(a.account_id, a.auth_user_id, null) d), '[]'::jsonb),
    'totals', coalesce((
      select jsonb_agg(jsonb_build_object('total', t.total, 'game', t.game, 'currency', t.currency, 'records', t.records, 'net', t.net)
                       order by t.total, t.game, t.currency)
      from private.account_totals t where t.account_id = a.account_id), '[]'::jsonb),
    'plan', jsonb_build_object('status', null),
    'allowanceUsage', '[]'::jsonb,
    'experiment', jsonb_build_object('group', null, 'policyVersion', null),
    'community', jsonb_build_object(
      'profile', null, 'termsAcceptances', '[]'::jsonb, 'ratings', '[]'::jsonb, 'blocks', '[]'::jsonb,
      'reportsFiled', '[]'::jsonb, 'savedCommunityStrategies', '[]'::jsonb, 'listings', '[]'::jsonb,
      'contributionStatus', null))
  from public.accounts a where a.account_id = p_account
$$;

-- The manifest's omissions: what the archive leaves out, and why. Specs 3 and
-- 4 drop their line when they register their records' export renderings.
create function private.export_omissions() returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_array(
    jsonb_build_object('what', 'Records on devices that haven''t synced',
      'why', 'Only what has reached your account is here. Each device can make a local supplement of what it hasn''t synced yet.'),
    jsonb_build_object('what', 'Practice sessions you deleted', 'why', 'Deleted sessions are removed from your account.'),
    jsonb_build_object('what', 'Passwords, keys, tokens and receipts', 'why', 'They''re never included, so the archive is safe to keep.'),
    jsonb_build_object('what', 'Other players'' data', 'why', 'Only your own records are included.'),
    jsonb_build_object('what', 'Strategies and casino sessions', 'why', 'Tableside doesn''t keep these on your account yet.'),
    jsonb_build_object('what', 'Challenge results and progress', 'why', 'Tableside doesn''t keep these on your account yet.'))
$$;

-- ---------------------------------------------------------------------------
-- Exports
-- ---------------------------------------------------------------------------

-- One row per export the account asked for. At most one is live (queued,
-- building or ready); an ended one stays, without its files, for a week, so
-- the player is told why it ended.
create table private.exports (
  export_id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (account_id),
  state text not null default 'queued' check (state in ('queued', 'building', 'ready', 'failed', 'expired', 'invalidated')),
  -- Why an invalidated export ended.
  ended_by text check (ended_by in ('regenerated', 'revocation', 'deletion-scheduled', 'deleted')),
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  snapshot_at timestamptz,
  ready_at timestamptz,
  expires_at timestamptz,
  bytes bigint,
  -- The archive's object in the account-exports bucket, in the account's folder.
  object_path text not null unique,
  -- Whether a stored object may remain: set when the build starts, cleared once the Storage API removed it.
  object_pending boolean not null default false,
  ended_at timestamptz,
  check ((state = 'invalidated') = (ended_by is not null))
);

create index exports_account on private.exports (account_id, requested_at desc);
create unique index exports_one_live on private.exports (account_id) where state in ('queued', 'building', 'ready');

-- A build's files, written in one transaction under the synchronization head:
-- the archive's temporary files. Each path's parts are contiguous, in ordinal order.
create table private.export_parts (
  export_id uuid not null references private.exports (export_id) on delete cascade,
  ordinal integer not null,
  path text not null,
  content text not null,
  primary key (export_id, ordinal)
);

-- Where the database wakes the job functions: this project's functions URL
-- (a local stack's API gateway inside its network; set once at provisioning
-- for beta and production, docs/environments.md). Without it nothing is
-- woken: the policy still ends exports on time, and objects wait for a wake.
create table private.job_endpoint (
  singleton boolean primary key default true check (singleton),
  functions_url text not null check (functions_url ~ '^https?://[^/]+$')
);

revoke all on private.exports, private.export_parts, private.job_endpoint from public, anon, authenticated;

insert into storage.buckets (id, name, public, allowed_mime_types)
  values ('account-exports', 'account-exports', false, array['application/zip']);

-- ---------------------------------------------------------------------------
-- The export path and its hooks
-- ---------------------------------------------------------------------------

-- The account a session may export from: the restricted path, so an account
-- whose age eligibility isn't established can export too (#42). The one seam
-- for who may export: #103 opens it to an account whose deletion is
-- scheduled (Amendment 1 B2). A request still needs fresh authentication,
-- whose own gate (private.signed_in_account, private.session_account: the
-- fresh-auth function, issue_proof_nonce_v1, caller_session_v1,
-- fresh_authentication_methods_v1) #103 opens to the same accounts.
create function private.export_account(p_session uuid, p_auth_user uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select private.session_account(p_session, p_auth_user)
$$;

-- Wakes the export-job function after this transaction commits (pg_net
-- sends its queue then; a rolled-back request never goes). The wake carries
-- no authority: the function takes its work from the database.
create function private.wake_export_job() returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_url text := (select functions_url from private.job_endpoint);
begin
  if v_url is null or private.environment() is null then
    return;
  end if;
  perform net.http_post(
    url := v_url || '/functions/v1/export-job',
    body := '{}'::jsonb,
    headers := jsonb_build_object('content-type', 'application/json', 'x-tableside-environment', private.environment()),
    timeout_milliseconds := 10000);
end $$;

-- Ends every live export of the account at once: the download policy denies
-- it from this commit, its parts go now and its object is removed by the job.
-- Revocation calls it (below); #103 calls it with 'deletion-scheduled' when it
-- schedules deletion, and #104 with 'deleted' at the irreversible boundary
-- (and waits until no export of the account has `object_pending`). Returns
-- how many exports it ended.
create function private.invalidate_exports(p_account uuid, p_reason text) returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_ended uuid[];
begin
  with ended as (
    update private.exports set state = 'invalidated', ended_by = p_reason, ended_at = now()
    where account_id = p_account and state in ('queued', 'building', 'ready')
    returning export_id
  )
  select array_agg(export_id) into v_ended from ended;
  if v_ended is null then
    return 0;
  end if;
  delete from private.export_parts where export_id = any (v_ended);
  perform private.wake_export_job();
  return cardinality(v_ended);
end $$;

-- Revoking a session (another device signed it out, or a sign-in method's
-- provider withdrew) ends the account's exports: whoever held that session
-- may have asked for one.
create function private.revocation_ends_exports() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.invalidate_exports(new.account_id, 'revocation');
  return null;
end $$;

create trigger revocation_ends_exports after update of revoked_at on private.account_sessions
  for each row when (old.revoked_at is null and new.revoked_at is not null)
  execute function private.revocation_ends_exports();

-- The export a player sees: its state, when it was asked for, when it was
-- ready and until when, its size and (while ready) its object.
create function private.export_view(p_export private.exports) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'state', case
      when p_export.state in ('queued', 'building') then 'preparing'
      when p_export.state = 'ready' and p_export.expires_at <= now() then 'expired'
      else p_export.state end,
    'endedBy', p_export.ended_by,
    'requestedAt', p_export.requested_at,
    'readyAt', p_export.ready_at,
    'expiresAt', p_export.expires_at,
    'bytes', p_export.bytes,
    'path', case when p_export.state = 'ready' and p_export.expires_at > now() then p_export.object_path end)
$$;

-- Whether the caller may download this object now: it is the archive of a
-- ready, unexpired export of the account the caller's session may export
-- from, and that session confirmed it's the player within the last few minutes.
create function private.export_downloadable(p_bucket text, p_object text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_bucket = 'account-exports' and exists (
    select 1 from private.exports e
    where e.object_path = p_object
      and e.state = 'ready'
      and e.expires_at > now()
      and e.account_id = private.export_account(private.caller_session(), auth.uid())
      and private.session_fresh_identity(private.caller_session(), auth.uid()) is not null)
$$;

-- Clients only read the bucket, and only so. The job writes and removes with the service role.
create policy account_exports_download on storage.objects for select to authenticated
  using (private.export_downloadable(bucket_id, name));

-- ---------------------------------------------------------------------------
-- Operations for the player (on the export path)
-- ---------------------------------------------------------------------------

-- Asks for a server export of the caller's account, replacing a ready one.
--   'requested' { export }   queued; the job builds it and emails when it's ready
--   'preparing' { export }   one is already being built: that one
--   'fresh-authentication-required'
create function public.request_export_v1() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_session uuid := private.caller_session();
  v_account uuid := private.export_account(v_session, auth.uid());
  v_export private.exports;
begin
  if v_account is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  -- Serialized with uploads, revocation and deletion scheduling.
  perform private.lock_sync_head(v_account);
  if private.export_account(v_session, auth.uid()) is distinct from v_account then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if private.session_fresh_identity(v_session, auth.uid()) is null then
    return jsonb_build_object('status', 'fresh-authentication-required');
  end if;
  select * into v_export from private.exports where account_id = v_account and state in ('queued', 'building');
  if found then
    return jsonb_build_object('status', 'preparing', 'export', private.export_view(v_export));
  end if;
  if exists (select 1 from private.exports where account_id = v_account and state = 'ready') then
    update private.exports set state = 'invalidated', ended_by = 'regenerated', ended_at = now()
      where account_id = v_account and state = 'ready';
  end if;
  insert into private.exports (account_id, object_path)
    values (v_account, v_account::text || '/' || gen_random_uuid()::text || '.zip')
    returning * into v_export;
  perform private.wake_export_job();
  return jsonb_build_object('status', 'requested', 'export', private.export_view(v_export));
end $$;

-- The account's latest export ({"status":"none"} before any), and whether the
-- caller's session may download it now without confirming again (`fresh`).
create function public.export_status_v1() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_session uuid := private.caller_session();
  v_account uuid := private.export_account(v_session, auth.uid());
  v_export private.exports;
begin
  if v_account is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  select * into v_export from private.exports where account_id = v_account order by requested_at desc limit 1;
  return jsonb_build_object(
    'status', case when v_export.export_id is null then 'none' else 'export' end,
    'export', case when v_export.export_id is not null then private.export_view(v_export) end,
    'fresh', private.session_fresh_identity(v_session, auth.uid()) is not null);
end $$;

-- The methods Confirm it's you may use, on the restricted paths too (an
-- age-restricted account confirms before it exports): as sign_in_methods_v1
-- lists them for ordinary access. Null when no account is signed in.
create function public.fresh_authentication_methods_v1() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select jsonb_agg(jsonb_build_object('id', i.id, 'provider', i.provider, 'email', i.email) order by i.created_at, i.id)
       from auth.identities i where i.user_id = auth.uid()),
    '[]'::jsonb)
  where private.signed_in_account() is not null
$$;

-- ---------------------------------------------------------------------------
-- Operations for the export-job function (service role)
-- ---------------------------------------------------------------------------

-- Writes one part at `p_ordinal`; returns the ordinal after it.
create function private.write_export_part(p_export uuid, p_ordinal integer, p_path text, p_content text) returns integer
language plpgsql volatile security definer set search_path = '' as $$
begin
  insert into private.export_parts (export_id, ordinal, path, content) values (p_export, p_ordinal, p_path, p_content);
  return p_ordinal + 1;
end $$;

-- Takes the next queued export and writes its files, in one transaction
-- holding the account's synchronization head: every synced record and total
-- it reads describes the head's sequence (`accountSequence`), since every
-- authoritative change takes the head first. The account's own details
-- (methods, devices) are read in the same transaction.
--   {"status":"building","export","path"} | {"status":"none"}
create function public.begin_export_build() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_candidate private.exports;
  v_export private.exports;
  v_type record;
  -- Ordinal 0 is the manifest, written last since it lists the other files.
  v_next integer := 1;
  v_count bigint;
  v_files jsonb := '[]'::jsonb;
  v_watermark bigint;
  v_path text;
begin
  for v_candidate in select * from private.exports where state = 'queued' order by requested_at limit 5 loop
    perform private.lock_sync_head(v_candidate.account_id);
    update private.exports set state = 'building', started_at = now(), snapshot_at = now(), object_pending = true
      where export_id = v_candidate.export_id and state = 'queued'
      returning * into v_export;
    exit when v_export.export_id is not null;
  end loop;
  if v_export.export_id is null then
    return jsonb_build_object('status', 'none');
  end if;
  select sequence into v_watermark from private.sync_heads where account_id = v_export.account_id;

  v_next := private.write_export_part(v_export.export_id, v_next, 'account.json', private.export_account_data(v_export.account_id)::text || E'\n');
  v_files := v_files || jsonb_build_object('path', 'account.json', 'format', 'json',
    'contents', 'Your account, settings, age eligibility record, sign-in methods, devices and lifetime totals');

  -- Each registered type's renderings, by its latest payload version.
  for v_type in
    select distinct on (t.record_type) t.record_type, t.payload_version, t.export, t.export_file, t.export_csv, t.export_csv_header
    from private.record_types t where t.export is not null order by t.record_type, t.payload_version desc
  loop
    if v_type.export_csv is not null then
      v_path := v_type.export_file || '.csv';
      v_next := private.write_export_part(v_export.export_id, v_next, v_path, private.csv_line(v_type.export_csv_header));
      execute format(
        'insert into private.export_parts (export_id, ordinal, path, content)
         select $1, $2 + s.n - 1, $3, private.csv_line(s.cells) from %s($4, $5) with ordinality s(item_id, cells, n)',
        v_type.export_csv::regproc)
        using v_export.export_id, v_next, v_path, v_export.account_id, v_type.record_type;
      get diagnostics v_count = row_count;
      v_next := v_next + v_count;
      v_files := v_files || jsonb_build_object('path', v_path, 'format', 'csv', 'recordType', v_type.record_type, 'records', v_count,
        'columns', to_jsonb(v_type.export_csv_header));
    end if;
    v_path := v_type.export_file || '.json';
    v_next := private.write_export_part(v_export.export_id, v_next, v_path,
      '{"version":1,"recordType":' || to_jsonb(v_type.record_type)::text || ',"payloadVersion":' || v_type.payload_version || ',"records":[');
    execute format(
      'insert into private.export_parts (export_id, ordinal, path, content)
       select $1, $2 + s.n - 1, $3, case when s.n = 1 then E''\n'' else E'',\n'' end || s.record::text
       from %s($4, $5) with ordinality s(item_id, record, n)',
      v_type.export::regproc)
      using v_export.export_id, v_next, v_path, v_export.account_id, v_type.record_type;
    get diagnostics v_count = row_count;
    v_next := v_next + v_count;
    v_next := private.write_export_part(v_export.export_id, v_next, v_path, E'\n]}\n');
    v_files := v_files || jsonb_build_object('path', v_path, 'format', 'json', 'recordType', v_type.record_type, 'records', v_count);
  end loop;

  perform private.write_export_part(v_export.export_id, 0, 'manifest.json', jsonb_build_object(
    'format', 'tableside-export',
    'version', 1,
    'snapshotAt', v_export.snapshot_at,
    'requestedAt', v_export.requested_at,
    'accountSequence', coalesce(v_watermark, 0),
    'scope', 'Everything your Tableside account held on its servers at snapshotAt: your synced records, account, settings, '
      || 'sign-in methods, devices and privacy choices. Times are UTC; money is exact decimal text.',
    'formats', jsonb_build_object(
      'csv', 'UTF-8, comma-separated, one header row, RFC 4180 quoting',
      'json', 'UTF-8 JSON; each file names its version, and each record its own recordVersion where it has one'),
    'files', v_files,
    'omissions', private.export_omissions())::text || E'\n');

  return jsonb_build_object('status', 'building', 'export', v_export.export_id, 'path', v_export.object_path);
end $$;

-- One page of a building export's parts after ordinal `after`, in order:
--   {"status":"page","parts":[{"ordinal","path","content"}],"more"} | {"status":"ended"}
create function public.export_parts_page(export uuid, after integer, page_size integer default 200) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_parts jsonb;
  v_size integer := least(greatest(coalesce(page_size, 200), 1), 1000);
begin
  if not exists (select 1 from private.exports e where e.export_id = export_parts_page.export and e.state = 'building') then
    return jsonb_build_object('status', 'ended');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('ordinal', p.ordinal, 'path', p.path, 'content', p.content) order by p.ordinal), '[]'::jsonb)
    into v_parts
    from (select * from private.export_parts p
          where p.export_id = export_parts_page.export and p.ordinal > after
          order by p.ordinal limit v_size + 1) p;
  return jsonb_build_object('status', 'page',
    'parts', case when jsonb_array_length(v_parts) > v_size then v_parts - v_size else v_parts end,
    'more', jsonb_array_length(v_parts) > v_size);
end $$;

-- The archive is stored: the export is ready for 24 hours, and its parts go.
--   {"status":"ready","email","expiresAt"}   send "export ready" to `email`
--   {"status":"ended"}                       it ended while building: the job removes what it uploaded, and the sweep checks again
create function public.finish_export_build(export uuid, bytes bigint) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_export private.exports;
begin
  update private.exports e set state = 'ready', ready_at = now(), expires_at = now() + interval '24 hours', bytes = finish_export_build.bytes
    where e.export_id = finish_export_build.export and e.state = 'building'
    returning * into v_export;
  delete from private.export_parts p where p.export_id = finish_export_build.export;
  if v_export.export_id is null then
    -- It ended while building, perhaps after a sweep found nothing yet stored:
    -- the object just uploaded must be removed too.
    update private.exports e set object_pending = true
      where e.export_id = finish_export_build.export and e.state in ('failed', 'expired', 'invalidated');
    return jsonb_build_object('status', 'ended');
  end if;
  return jsonb_build_object('status', 'ready', 'expiresAt', v_export.expires_at,
    'email', (select u.email from public.accounts a join auth.users u on u.id = a.auth_user_id where a.account_id = v_export.account_id));
end $$;

-- The build failed: its parts go now, and anything it may have stored with the next sweep.
create function public.fail_export_build(export uuid) returns void
language sql volatile security definer set search_path = '' as $$
  update private.exports e set state = 'failed', ended_at = now() where e.export_id = fail_export_build.export and e.state = 'building';
  update private.exports e set object_pending = true
    where e.export_id = fail_export_build.export and e.state in ('failed', 'expired', 'invalidated');
  delete from private.export_parts p where p.export_id = fail_export_build.export;
$$;

-- Ends what is past its time: a ready export after 24 hours, and a build
-- that stopped making progress (its function died) after 15 minutes, whose
-- parts go. Ended exports stay a week, without files, then go too.
create function private.expire_exports() returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_stale uuid[];
begin
  update private.exports set state = 'expired', ended_at = expires_at where state = 'ready' and expires_at <= now();
  with stale as (
    update private.exports set state = 'failed', ended_at = now()
    where state = 'building' and started_at <= now() - interval '15 minutes'
    returning export_id
  )
  select array_agg(export_id) into v_stale from stale;
  delete from private.export_parts where export_id = any (coalesce(v_stale, '{}'));
  delete from private.exports
    where state in ('failed', 'expired', 'invalidated') and not object_pending and ended_at <= now() - interval '7 days';
end $$;

-- The objects left to remove: every ended export's that may remain.
create function public.exports_to_remove() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.expire_exports();
  return coalesce((
    select jsonb_agg(jsonb_build_object('export', e.export_id, 'path', e.object_path) order by e.ended_at)
    from (select * from private.exports
          where object_pending and state in ('failed', 'expired', 'invalidated')
          order by ended_at limit 100) e), '[]'::jsonb);
end $$;

-- The Storage API removed these exports' objects.
create function public.exports_removed(exports uuid[]) returns void
language sql volatile security definer set search_path = '' as $$
  update private.exports e set object_pending = false
  where e.export_id = any (exports_removed.exports) and e.state in ('failed', 'expired', 'invalidated');
$$;

-- ---------------------------------------------------------------------------
-- Email: "export ready"
-- ---------------------------------------------------------------------------

alter table private.email_sends drop constraint email_sends_type_check;
alter table private.email_sends add constraint email_sends_type_check
  check (type in ('code', 'no-account', 'method-linked', 'email-change', 'device-revoked', 'export-ready'));

-- ---------------------------------------------------------------------------
-- Jobs
-- ---------------------------------------------------------------------------

-- Every five minutes: end what is past its time, and wake the job when
-- anything is queued or left to remove.
create function private.export_upkeep() returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.expire_exports();
  if exists (select 1 from private.exports where state = 'queued' or (object_pending and state in ('failed', 'expired', 'invalidated'))) then
    perform private.wake_export_job();
  end if;
end $$;

select cron.schedule('export-upkeep', '*/5 * * * *', 'select private.export_upkeep()');

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke execute on function private.export_instant(bigint), private.csv_line(text[]),
  private.export_completed_practice_sessions(uuid, text), private.export_csv_completed_practice_sessions(uuid, text),
  private.export_revisioned_items(uuid, text), private.export_privacy_choices(uuid, text),
  private.export_account_data(uuid), private.export_omissions(), private.export_account(uuid, uuid),
  private.wake_export_job(), private.invalidate_exports(uuid, text), private.revocation_ends_exports(),
  private.export_view(private.exports), private.export_downloadable(text, text), private.write_export_part(uuid, integer, text, text),
  private.expire_exports(), private.export_upkeep() from public;
-- The storage policy runs as the caller.
grant execute on function private.export_downloadable(text, text) to authenticated;

revoke execute on function public.request_export_v1(), public.export_status_v1(), public.fresh_authentication_methods_v1() from public, anon;
grant execute on function public.request_export_v1(), public.export_status_v1(), public.fresh_authentication_methods_v1() to authenticated;

revoke execute on function public.begin_export_build(), public.export_parts_page(uuid, integer, integer),
  public.finish_export_build(uuid, bigint), public.fail_export_build(uuid), public.exports_to_remove(), public.exports_removed(uuid[])
  from public, anon, authenticated;
grant execute on function public.begin_export_build(), public.export_parts_page(uuid, integer, integer),
  public.finish_export_build(uuid, bigint), public.fail_export_build(uuid), public.exports_to_remove(), public.exports_removed(uuid[])
  to service_role;
