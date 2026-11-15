-- Permanent deletion: the irreversible boundary and its cleanup job (spec 2,
-- #104; *Deletion*, Amendments 1 A1, A5, C1–C3, C6, 3 §3–4, 5 §2, 7 §5,
-- 8 §3–4 and 9 §3).
--
-- The boundary comes on Delete permanently now (delete_permanently_v1, after
-- Confirm it's you), at the deadline of a scheduled deletion (the
-- deletion-upkeep cron finalizes it), or on an operator's verified rights
-- request (begin_rights_request_deletion). It is one transaction, serialized
-- like scheduling (the synchronization head, then the Auth user's row, then
-- the account's):
--   * the account becomes 'deleted', for good: nothing ever sets it back, the
--     authorization gate denies it every path, and its ID is never reused;
--   * the Auth user is banned, so no sign-in or token renewal works while the
--     cleanup runs, and every session is revoked (Amendment 1 A1: only now);
--   * every live export ends (private.invalidate_exports, 'deleted'), spec 6
--     hides the public content (again, for Delete permanently now from an
--     active account) and cancels owned simulation publication;
--   * the deletion-control record (private.deletions) is written, and the
--     account-state control is journaled by its trigger (ADR 0001).
-- Devices learn it from the lifecycle status ('deleted') and erase the
-- account's local data.
--
-- The deletion-job function then cleans up, one step at a time, in this
-- order, each idempotent, so a retry is always safe and a failure only
-- delays (it is retried with backoff and reported as a delay; it never
-- reopens the account):
--   mail        the "permanent deletion accepted" email, while the address still exists
--   exports     waits until the export job removed every archive object (only
--               the Storage API can), then removes the export rows
--   objects     removes the account's own objects in the account-private
--               bucket, through the Storage API, page by page
--   analytics   asks the analytics provider (spec 7) to erase every analytics
--               ID the account had, then forgets them; the provider's
--               completion is recorded separately (Amendment 8 §3)
--   purchases   spec 5's cleanup hook: the purchase association, the encrypted
--               verification evidence and the RevenueCat customer (Amendment 5 §2)
--   public      spec 6's hook: author prose removed, attribution "Deleted
--               author"; non-personal source links stay while others depend
--               on them (Amendment 7 §5)
--   records     every account-keyed row: histories, casino records,
--               strategies, challenges, eligibility, privacy choices, devices
--               and sessions, chunks, snapshots, receipts, the feed
--   providers   revokes the Sign in with Apple token and the Google grant
--   identity    removes the Auth user (its identities, sessions, codes) last,
--               so nothing the earlier steps need is gone before them
-- Active cleanup targets seven days from the boundary (cleanup_by). The
-- status shows the boundary, processing or completed, delays, and the
-- analytics provider's completion, providers and backups separately; backup
-- aging is spec 7's and never reported as completed.
--
-- What stays is the minimal deletion control: the account row (ID, state,
-- environment; no Auth user), its deletion record (origin, times, step
-- times; no history, prose, purchase blacklist or forfeiture ledger), the
-- status credentials' hashes (so a device away during the deletion still
-- learns it), and the deletion's own control-journal entry.

-- ---------------------------------------------------------------------------
-- The deletion control
-- ---------------------------------------------------------------------------

-- Who asked for a scheduled deletion, when it isn't the player: a verified
-- rights request that chose the 30-day window, with its original request
-- time, which the boundary keeps (Amendment 1 C1: the clock runs from it).
alter table public.accounts add column deletion_origin text check (deletion_origin = 'rights-request');
alter table public.accounts add column deletion_requested_at timestamptz;
alter table public.accounts add constraint accounts_deletion_origin check (
  (deletion_origin is null) = (deletion_requested_at is null)
  and (deletion_origin is null or state = 'deletion_scheduled'));

-- Leaving deletion scheduled (Cancel deletion, or the boundary) forgets who asked.
create function private.forget_deletion_origin() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.state <> 'deletion_scheduled' then
    new.deletion_origin := null;
    new.deletion_requested_at := null;
  end if;
  return new;
end $$;

create trigger forget_deletion_origin before update of state on public.accounts
  for each row execute function private.forget_deletion_origin();

-- One row per deleted account, written at the boundary: what the status
-- reports, and the cleanup job's progress. Nothing here is history, prose or
-- purchase evidence.
create table private.deletions (
  account_id uuid primary key references public.accounts (account_id),
  -- Who asked: the player (Delete permanently now, or the deadline of the
  -- deletion they scheduled), or a verified rights request (spec 7's intake).
  origin text not null check (origin in ('player', 'rights-request')),
  -- When it was asked for: a rights request's original request time.
  requested_at timestamptz not null,
  -- The scheduled deadline the boundary came at; null for an immediate deletion.
  deadline timestamptz,
  boundary_at timestamptz not null default now(),
  -- The active-cleanup target: seven days from the boundary.
  cleanup_by timestamptz not null,
  mail_sent_at timestamptz,
  exports_removed_at timestamptz,
  objects_removed_at timestamptz,
  -- Requested of the analytics provider, and the provider's completion: apart (Amendment 8 §3).
  analytics_requested_at timestamptz,
  analytics_ids integer,
  analytics_completed_at timestamptz,
  purchases_cleaned_at timestamptz,
  public_content_removed_at timestamptz,
  records_purged_at timestamptz,
  providers_revoked_at timestamptz,
  -- 'revoked' every grant, 'not-held' some grant had no token to revoke it with, 'none' no Apple or Google method.
  providers_outcome text check (providers_outcome in ('revoked', 'not-held', 'none')),
  completed_at timestamptz,
  -- Consecutive failures of the current step, and when it is tried again.
  failures integer not null default 0,
  retry_at timestamptz,
  -- A worker holding the current external step, until then.
  leased_until timestamptz,
  check ((providers_revoked_at is null) = (providers_outcome is null)),
  check (completed_at is null or (mail_sent_at is not null and exports_removed_at is not null and objects_removed_at is not null
    and analytics_requested_at is not null
    and purchases_cleaned_at is not null and public_content_removed_at is not null and records_purged_at is not null
    and providers_revoked_at is not null))
);

create index deletions_due on private.deletions (boundary_at) where completed_at is null;

-- A deleted account's status credentials (only their hashes): the lifecycle
-- status keeps answering "deleted" to a device that was away, after its
-- session records and the Auth user are gone.
create table private.deleted_sessions (
  status_hash bytea primary key,
  account_id uuid not null references public.accounts (account_id)
);

revoke all on private.deletions, private.deleted_sessions from public, anon, authenticated;

-- A session revoked by the boundary says so.
alter table private.account_sessions drop constraint account_sessions_revoked_by_check;
alter table private.account_sessions add constraint account_sessions_revoked_by_check
  check (revoked_by in ('device', 'provider', 'deletion'));

-- How long active cleanup may take.
create function private.deletion_cleanup_window() returns interval
language sql immutable set search_path = '' as $$
  select interval '7 days'
$$;

-- How long the job function holds an external step before another may take it.
create function private.deletion_step_lease() returns interval
language sql immutable set search_path = '' as $$
  select interval '2 minutes'
$$;

-- How long waiting on the export job may take before the status calls it a delay.
create function private.deletion_export_wait() returns interval
language sql immutable set search_path = '' as $$
  select interval '1 hour'
$$;

-- Each record type's deletion coverage (spec 2, *Record-type registry*): a
-- function (account uuid) that removes every row of the type's own tables for
-- the account. The platform's own tables (results, revisioned items, the
-- feed, receipts, chunks, snapshots, totals, positions) are removed for every
-- type without one.
alter table private.record_types add column erase regprocedure;

-- ---------------------------------------------------------------------------
-- Hooks for later specs (stubs until they land)
-- ---------------------------------------------------------------------------

-- Spec 6's contract, at the boundary (Amendment 1 A1): cancel the account's
-- owned queued or running simulation publication. Nothing is published yet.
create function private.cancel_owned_publications(p_account uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform p_account;
end $$;

-- Spec 6's contract, in the cleanup: remove the account's profile, author
-- prose, ratings and contributions from app-controlled references, and
-- attribute what others saved or remixed to "Deleted author", keeping their
-- non-personal source links, evidence and minimal matching records while
-- others depend on them (Amendment 7 §5). Idempotent. No public content yet.
create function private.remove_public_content(p_account uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform p_account;
end $$;

-- Spec 5's cleanup hook, its database half (Amendment 5 §2): remove the
-- purchase association and the encrypted verification evidence. The
-- deletion-job function then removes the RevenueCat customer. Idempotent, and
-- before the Auth identity goes. No forfeiture ledger or purchase blacklist is
-- kept: a later receipt or webhook for the erased owner is spec 5's unmatched
-- historical purchase, and never recreates the account (accounts are only
-- ever made for a new Auth user, with a new ID). No purchases exist yet.
create function private.purchase_cleanup(p_account uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform p_account;
end $$;

-- ---------------------------------------------------------------------------
-- The job function's wake
-- ---------------------------------------------------------------------------

-- Wakes the deletion-job function after this transaction commits, like the
-- export job (#102's private.wake_export_job). The wake carries no authority.
create function private.wake_deletion_job() returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_url text := (select functions_url from private.job_endpoint);
begin
  if v_url is null or private.environment() is null then
    return;
  end if;
  perform net.http_post(
    url := v_url || '/functions/v1/deletion-job',
    body := '{}'::jsonb,
    headers := jsonb_build_object('content-type', 'application/json', 'x-tableside-environment', private.environment()),
    timeout_milliseconds := 10000);
end $$;

-- ---------------------------------------------------------------------------
-- The boundary
-- ---------------------------------------------------------------------------

-- Crosses the irreversible boundary for an account that is active or whose
-- deletion is scheduled. The caller holds the account's synchronization head,
-- its Auth user's row and its own row, in that order.
create function private.cross_deletion_boundary(p_account uuid, p_origin text, p_requested_at timestamptz) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_row public.accounts;
begin
  select * into v_row from public.accounts where account_id = p_account;
  if v_row.state not in ('active', 'deletion_scheduled') then
    raise exception 'not deletable' using errcode = '55000';
  end if;
  insert into private.deletions (account_id, origin, requested_at, deadline, cleanup_by)
    values (p_account, p_origin, p_requested_at, v_row.deletion_deadline, now() + private.deletion_cleanup_window());
  update public.accounts set state = 'deleted', deletion_deadline = null, deletion_scheduled_at = null
    where account_id = p_account;
  -- Exports end as deleted, before revocation would end them as revoked.
  perform private.invalidate_exports(p_account, 'deleted');
  perform private.hide_public_content(p_account);
  perform private.cancel_owned_publications(p_account);
  if v_row.auth_user_id is not null then
    -- No sign-in or token renewal while the cleanup runs (Auth refuses a banned user).
    update auth.users set banned_until = now() + interval '1000 years' where id = v_row.auth_user_id;
    perform private.revoke_sessions(
      coalesce((select array_agg(s.id) from auth.sessions s where s.user_id = v_row.auth_user_id), '{}'), 'deletion');
  end if;
  perform private.wake_deletion_job();
end $$;

-- Takes an account's locks in the order every lifecycle change does (#91's):
-- the synchronization head, the Auth user's row, then the account's row.
-- Returns the account as it now is.
create function private.lock_account_lifecycle(p_account uuid) returns public.accounts
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_row public.accounts;
begin
  perform private.lock_sync_head(p_account);
  perform 1 from auth.users u where u.id = (select auth_user_id from public.accounts where account_id = p_account) for update;
  select * into v_row from public.accounts where account_id = p_account for update;
  return v_row;
end $$;

-- The deletion as its status reports it (spec 2, *Status and email*): a
-- restricted view that grants no record access.
--   'processing' while active cleanup runs, 'completed' once it finished;
--   `delayed` when it is past its seven days, a step is waiting to be retried,
--     or the export job hasn't removed the archives within the hour;
--   `analytics`: when erasure was requested of the provider and when the
--     provider completed it (null until it says so: never assumed);
--   `providers`: null until the Apple and Google grants were dealt with;
--   `backups`: backup aging is outside active cleanup, disclosed by spec 7, never completed here.
create function private.deletion_progress(p_account uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'status', case when d.completed_at is null then 'processing' else 'completed' end,
    'deletedAt', d.boundary_at,
    'cleanupBy', d.cleanup_by,
    'completedAt', d.completed_at,
    'delayed', d.completed_at is null and (now() > d.cleanup_by or d.failures > 0
      or (d.exports_removed_at is null and now() > d.boundary_at + private.deletion_export_wait())),
    'analytics', jsonb_build_object('requestedAt', d.analytics_requested_at, 'completedAt', d.analytics_completed_at),
    'providers', d.providers_outcome,
    'backups', 'separate')
  from private.deletions d where d.account_id = p_account
$$;

-- ---------------------------------------------------------------------------
-- Delete permanently now
-- ---------------------------------------------------------------------------

-- Delete permanently now (S2-22), for the caller's freshly authenticated
-- session, of an account that is active (any age state: deletion is a
-- restricted path) or whose deletion is scheduled. Online only.
--   'deleted' {deletion progress}   the boundary is crossed: this device erases the account
--   'fresh-authentication-required'
-- Refused (not authorized) for a session that is gone: a retry after the
-- boundary learns it from the lifecycle status, which answers 'deleted'.
create function public.delete_permanently_v1() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_session uuid := private.caller_session();
  v_account uuid := private.signed_in_account();
  v_row public.accounts;
begin
  if v_account is null or v_session is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  v_row := private.lock_account_lifecycle(v_account);
  if private.signed_in_account() is distinct from v_account or v_row.state not in ('active', 'deletion_scheduled') then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if private.session_fresh_identity(v_session, auth.uid()) is null then
    return jsonb_build_object('status', 'fresh-authentication-required');
  end if;
  perform private.cross_deletion_boundary(v_account, 'player', now());
  return jsonb_build_object('status', 'deleted') || jsonb_build_object('progress', private.deletion_progress(v_account));
end $$;

-- ---------------------------------------------------------------------------
-- The rights-request operation (spec 7's intake; Amendments 1 C1, 8 §4)
-- ---------------------------------------------------------------------------

-- Operator-only (service role): begin immediate permanent deletion for an
-- identity-verified rights request, received at `requested_at`. It crosses
-- the boundary at once, unless the requester explicitly chose the 30-day
-- window (`use_window`): then deletion is scheduled with its deadline 30 days
-- from the original request (never restarted, and never later than a
-- deadline already scheduled), and the boundary keeps the origin and time.
-- An account already deleted is left as it is. Answers the case status.
create function public.begin_rights_request_deletion(account uuid, requested_at timestamptz, use_window boolean default false) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_row public.accounts;
  v_deadline timestamptz;
begin
  if requested_at is null or requested_at > now() + interval '5 minutes' or use_window is null then
    raise exception 'malformed rights request' using errcode = '22023';
  end if;
  if not exists (select 1 from public.accounts a where a.account_id = begin_rights_request_deletion.account and a.environment = private.environment()) then
    raise exception 'no such account' using errcode = '22023';
  end if;
  v_row := private.lock_account_lifecycle(account);
  if v_row.state = 'deleted' then
    return public.deletion_case_v1(account);
  end if;
  v_deadline := least(requested_at + private.deletion_window(), coalesce(v_row.deletion_deadline, 'infinity'));
  if not use_window or v_deadline <= now() then
    perform private.cross_deletion_boundary(account, 'rights-request', requested_at);
  else
    update public.accounts
      set state = 'deletion_scheduled', deletion_deadline = v_deadline,
          deletion_scheduled_at = coalesce(v_row.deletion_scheduled_at, now()),
          deletion_origin = 'rights-request', deletion_requested_at = begin_rights_request_deletion.requested_at
      where account_id = account;
    if v_row.state = 'active' then
      perform private.invalidate_exports(account, 'deletion-scheduled');
      perform private.hide_public_content(account);
    end if;
  end if;
  return public.deletion_case_v1(account);
end $$;

-- Operator-only: where an account's deletion stands, for spec 7's case
-- record: the origin and original request time, the deadline, whether the
-- boundary is crossed (the irreversible state), active cleanup, and the
-- provider and backup exceptions, each apart (Amendment 8 §4).
--   'active' | 'scheduled' { deadline, origin, requestedAt } | 'processing' / 'completed' { …progress, origin, requestedAt, deadline }
create function public.deletion_case_v1(account uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case
    when a.state = 'deleted' then private.deletion_progress(a.account_id)
      || jsonb_build_object('irreversible', true, 'origin', d.origin, 'requestedAt', d.requested_at, 'deadline', d.deadline)
    when a.state = 'deletion_scheduled' then jsonb_build_object('status', 'scheduled', 'irreversible', false,
      'deadline', a.deletion_deadline, 'origin', coalesce(a.deletion_origin, 'player'),
      'requestedAt', coalesce(a.deletion_requested_at, a.deletion_scheduled_at))
    else jsonb_build_object('status', 'active', 'irreversible', false) end
  from public.accounts a
  left join private.deletions d on d.account_id = a.account_id
  where a.account_id = deletion_case_v1.account and a.environment = private.environment()
$$;

-- ---------------------------------------------------------------------------
-- The deadline
-- ---------------------------------------------------------------------------

-- Crosses the boundary for every scheduled deletion whose deadline has come
-- (one transaction each), then wakes the job if any cleanup is due. Past the
-- deadline Cancel deletion already answers too-late (#103); from here the
-- account is deleted.
create function private.finalize_deletion(p_account uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_row public.accounts := private.lock_account_lifecycle(p_account);
begin
  if v_row.state = 'deletion_scheduled' and v_row.deletion_deadline <= now() then
    perform private.cross_deletion_boundary(p_account,
      coalesce(v_row.deletion_origin, 'player'), coalesce(v_row.deletion_requested_at, v_row.deletion_scheduled_at));
  end if;
end $$;

-- Wakes the job when any cleanup is due (a retry's time came, or a wake was lost).
create function private.wake_due_deletions() returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if exists (select 1 from private.deletions where completed_at is null and (retry_at is null or retry_at <= now())) then
    perform private.wake_deletion_job();
  end if;
end $$;

-- (A procedure that commits can't be security definer: it runs as the cron's owner.)
create procedure private.deletion_upkeep()
language plpgsql as $$
declare
  v_account uuid;
begin
  for v_account in
    select a.account_id from public.accounts a
    where a.state = 'deletion_scheduled' and a.deletion_deadline <= now() and a.environment = private.environment()
    order by a.deletion_deadline
  loop
    perform private.finalize_deletion(v_account);
    commit;
  end loop;
  perform private.wake_due_deletions();
end $$;

select cron.schedule('deletion-upkeep', '* * * * *', 'call private.deletion_upkeep()');

-- ---------------------------------------------------------------------------
-- The cleanup
-- ---------------------------------------------------------------------------

-- Removes every account-keyed row but the deletion control: each record
-- type's own tables (its `erase`), then the platform's, children first. The
-- analytics IDs went in their own step, and the export rows in theirs.
create function private.purge_account_records(p_account uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_erase regproc;
  v_user uuid := (select auth_user_id from public.accounts where account_id = p_account);
begin
  for v_erase in select distinct t.erase::oid::regproc from private.record_types t where t.erase is not null loop
    execute format('select %s($1)', v_erase) using p_account;
  end loop;
  delete from private.revision_proposals where account_id = p_account;
  delete from private.revisioned_items where account_id = p_account;
  delete from private.practice_results where account_id = p_account;
  -- After what contributes to them.
  delete from private.account_totals where account_id = p_account;
  delete from private.device_positions where account_id = p_account;
  delete from private.purged_results where account_id = p_account;
  delete from private.staged_chunks where account_id = p_account;
  delete from private.bootstrap_rows where account_id = p_account;
  delete from private.bootstrap_snapshots where account_id = p_account;
  delete from private.sync_receipts where account_id = p_account;
  delete from private.sync_feed where account_id = p_account;
  delete from private.command_scopes where account_id = p_account;
  delete from private.realtime_claims where account_id = p_account;
  delete from private.privacy_choices where account_id = p_account;
  delete from public.eligibility where account_id = p_account;
  delete from private.reviewer_accounts where account_id = p_account;
  delete from private.deletion_receipts where account_id = p_account;
  delete from private.exports where account_id = p_account;
  -- Devices and sessions: only the status credentials' hashes stay.
  insert into private.deleted_sessions (status_hash, account_id)
    select status_hash, account_id from private.account_sessions where account_id = p_account
    on conflict do nothing;
  delete from private.account_sessions where account_id = p_account;
  delete from private.installations where account_id = p_account;
  -- What the account's sign-up left.
  if v_user is not null then
    delete from private.eligibility_assertions where consumed_by = v_user;
    delete from private.pending_eligibility where auth_user_id = v_user;
  end if;
  delete from private.sync_heads where account_id = p_account;
end $$;

-- Removes the Auth user last: its identities, sessions, codes and flows go
-- with it, and Auth's audit entries about it. The account row stays, with no
-- Auth user, as the deletion control. The account's earlier control-journal
-- entries go too: the deletion's own entry supersedes them for any restore
-- (a restore before it is deleted again; ADR 0001).
create function private.remove_account_identity(p_account uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user uuid := (select auth_user_id from public.accounts where account_id = p_account);
begin
  update public.accounts set auth_user_id = null where account_id = p_account;
  if v_user is not null then
    delete from auth.flow_state where user_id = v_user;
    delete from auth.audit_log_entries where payload ->> 'actor_id' = v_user::text;
    delete from auth.users where id = v_user;
  end if;
  delete from private.control_journal j
    where j.account_id = p_account
      and j.position <> (select max(k.position) from private.control_journal k
                         where k.account_id = p_account and k.kind = 'account-state' and k.control ->> 'state' = 'deleted');
end $$;

-- For the deletion-job function: the deleted accounts with cleanup due.
create function public.deletions_due() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(d.account_id order by d.boundary_at), '[]'::jsonb)
  from (select account_id, boundary_at from private.deletions
        where completed_at is null and (retry_at is null or retry_at <= now()) and (leased_until is null or leased_until <= now())
        order by boundary_at limit 20) d
$$;

-- For the deletion-job function: runs the account's next cleanup steps that
-- need only the database, and answers the first that needs the function:
--   'mail' { email, cleanupBy } send "permanent deletion accepted" (email null: nowhere to send it)
--   'objects' { paths }        remove these account-private objects (a page; more may follow)
--   'analytics' { ids }        ask the analytics provider to erase these IDs
--   'purchases' { customer }   remove the RevenueCat customer (spec 5)
--   'providers' { identities } revoke each Apple and Google grant
--   'waiting'                  the export job hasn't removed every archive yet (woken now)
--   'busy'                     another worker holds the account, or it isn't due
--   'complete'                 active cleanup has finished
-- An external step is leased to its caller for two minutes; it reports back
-- with deletion_step_done or deletion_step_failed.
create function public.advance_deletion(account uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v private.deletions;
  v_user uuid;
  v_ids jsonb;
begin
  select * into v from private.deletions d where d.account_id = advance_deletion.account for update skip locked;
  if not found then
    return jsonb_build_object('step', 'busy');
  end if;
  if v.completed_at is not null then
    return jsonb_build_object('step', 'complete');
  end if;
  if v.leased_until > now() or v.retry_at > now() then
    return jsonb_build_object('step', 'busy');
  end if;
  v_user := (select auth_user_id from public.accounts where account_id = v.account_id);
  if v.mail_sent_at is null then
    update private.deletions set leased_until = now() + private.deletion_step_lease() where account_id = v.account_id;
    return jsonb_build_object('step', 'mail', 'email', (select u.email from auth.users u where u.id = v_user), 'cleanupBy', v.cleanup_by);
  end if;
  if v.exports_removed_at is null then
    if exists (select 1 from private.exports e where e.account_id = v.account_id and e.object_pending) then
      perform private.wake_export_job();
      return jsonb_build_object('step', 'waiting');
    end if;
    delete from private.exports where account_id = v.account_id;
    update private.deletions set exports_removed_at = now(), failures = 0 where account_id = v.account_id;
  end if;
  if v.objects_removed_at is null then
    select coalesce(jsonb_agg(o.name), '[]'::jsonb) into v_ids
      from (select name from storage.objects
            where bucket_id = 'account-private' and (storage.foldername(name))[1] = v.account_id::text
            order by name limit 100) o;
    if jsonb_array_length(v_ids) > 0 then
      update private.deletions set leased_until = now() + private.deletion_step_lease() where account_id = v.account_id;
      return jsonb_build_object('step', 'objects', 'paths', v_ids);
    end if;
    update private.deletions set objects_removed_at = now(), failures = 0 where account_id = v.account_id;
  end if;
  if v.analytics_requested_at is null then
    select coalesce(jsonb_agg(i.analytics_id order by i.generation), '[]'::jsonb) into v_ids
      from private.analytics_ids i where i.account_id = v.account_id;
    if jsonb_array_length(v_ids) = 0 then
      update private.deletions set analytics_requested_at = now(), analytics_ids = 0, analytics_completed_at = now(), failures = 0
        where account_id = v.account_id;
    else
      update private.deletions set leased_until = now() + private.deletion_step_lease() where account_id = v.account_id;
      return jsonb_build_object('step', 'analytics', 'ids', v_ids);
    end if;
  end if;
  if v.purchases_cleaned_at is null then
    perform private.purchase_cleanup(v.account_id);
    update private.deletions set leased_until = now() + private.deletion_step_lease() where account_id = v.account_id;
    return jsonb_build_object('step', 'purchases', 'customer', v.account_id);
  end if;
  if v.public_content_removed_at is null then
    perform private.remove_public_content(v.account_id);
    update private.deletions set public_content_removed_at = now(), failures = 0 where account_id = v.account_id;
  end if;
  if v.records_purged_at is null then
    perform private.purge_account_records(v.account_id);
    update private.deletions set records_purged_at = now(), failures = 0 where account_id = v.account_id;
  end if;
  if v.providers_revoked_at is null then
    select coalesce(jsonb_agg(jsonb_build_object('provider', i.provider, 'subject', i.provider_id) order by i.created_at), '[]'::jsonb) into v_ids
      from auth.identities i where i.user_id = v_user and i.provider in ('apple', 'google');
    if jsonb_array_length(v_ids) = 0 then
      update private.deletions set providers_revoked_at = now(), providers_outcome = 'none', failures = 0 where account_id = v.account_id;
    else
      update private.deletions set leased_until = now() + private.deletion_step_lease() where account_id = v.account_id;
      return jsonb_build_object('step', 'providers', 'identities', v_ids);
    end if;
  end if;
  perform private.remove_account_identity(v.account_id);
  update private.deletions set completed_at = now(), failures = 0, retry_at = null, leased_until = null where account_id = v.account_id;
  return jsonb_build_object('step', 'complete');
end $$;

-- For the deletion-job function: the external step `step` is done.
--   'mail'       { sent }        (a notice that couldn't go is logged, never retried)
--   'objects'    {}              that page of objects is removed
--   'analytics'  { completed }   requested of the provider; completed only if the provider said so
--   'purchases'  {}
--   'providers'  { outcome }     'revoked' or 'not-held'
-- A report for a step that isn't current changes nothing.
create function public.deletion_step_done(account uuid, step text, outcome jsonb default '{}'::jsonb) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v private.deletions;
begin
  select * into v from private.deletions d where d.account_id = deletion_step_done.account for update;
  if not found or v.completed_at is not null then
    return;
  end if;
  if step = 'mail' and v.mail_sent_at is null then
    update private.deletions set mail_sent_at = now() where account_id = v.account_id;
  elsif step = 'objects' and v.exports_removed_at is not null and v.objects_removed_at is null then
    -- A page is gone; the next advance looks again, and marks the step once none is left.
    null;
  elsif step = 'analytics' and v.objects_removed_at is not null and v.analytics_requested_at is null then
    update private.deletions
      set analytics_requested_at = now(),
          analytics_ids = (select count(*) from private.analytics_ids i where i.account_id = v.account_id),
          analytics_completed_at = case when (outcome ->> 'completed')::boolean then now() end
      where account_id = v.account_id;
    delete from private.analytics_ids where account_id = v.account_id;
  elsif step = 'purchases' and v.analytics_requested_at is not null and v.purchases_cleaned_at is null then
    update private.deletions set purchases_cleaned_at = now() where account_id = v.account_id;
  elsif step = 'providers' and v.records_purged_at is not null and v.providers_revoked_at is null
    and outcome ->> 'outcome' in ('revoked', 'not-held') then
    update private.deletions set providers_revoked_at = now(), providers_outcome = outcome ->> 'outcome' where account_id = v.account_id;
  else
    return;
  end if;
  update private.deletions set failures = 0, retry_at = null, leased_until = null where account_id = v.account_id;
end $$;

-- For the deletion-job function: the current external step failed. It is
-- retried with backoff (one minute, doubling, at most six hours), and the
-- status reports a delay meanwhile. The account stays deleted.
create function public.deletion_step_failed(account uuid) returns void
language sql volatile security definer set search_path = '' as $$
  update private.deletions
    set failures = failures + 1,
        retry_at = now() + least(interval '1 minute' * power(2, least(failures, 12)), interval '6 hours'),
        leased_until = null
    where account_id = deletion_step_failed.account and completed_at is null
$$;

-- Spec 7's analytics provider adapter: the provider completed the erasure it
-- was asked for. Only then does the status say so.
create function public.analytics_erasure_completed(account uuid) returns void
language sql volatile security definer set search_path = '' as $$
  update private.deletions set analytics_completed_at = coalesce(analytics_completed_at, now())
    where account_id = analytics_erasure_completed.account and analytics_requested_at is not null
$$;

-- #102's report from the export job (20261129141537_export.sql), now waking
-- the deletion job when a deleted account was waiting on those archives, so
-- its cleanup goes on at once rather than at the next upkeep.
create or replace function public.exports_removed(exports uuid[]) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  update private.exports e set object_pending = false
  where e.export_id = any (exports_removed.exports) and e.state in ('failed', 'expired', 'invalidated');
  if exists (
    select 1 from private.exports e join private.deletions d on d.account_id = e.account_id
    where e.export_id = any (exports_removed.exports) and d.exports_removed_at is null) then
    perform private.wake_deletion_job();
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Status for the account's devices
-- ---------------------------------------------------------------------------

-- #101's lifecycle status (20261124163517_devices_revocation.sql), now also
-- answering "deleted" by a status credential whose session record was purged
-- with the account (private.deleted_sessions).
create or replace function public.lifecycle_status_v1(token text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_record private.account_sessions;
  v_state text;
  v_deadline timestamptz;
begin
  if coalesce(token, '') ~ '^[0-9a-f]{64}$' then
    select r.* into v_record from private.account_sessions r where r.status_hash = extensions.digest(token, 'sha256');
    select a.state, a.deletion_deadline into v_state, v_deadline
      from public.accounts a where a.account_id = v_record.account_id and a.environment = private.environment();
    if v_record.session_id is null and exists (
      select 1 from private.deleted_sessions d join public.accounts a on a.account_id = d.account_id
      where d.status_hash = extensions.digest(token, 'sha256') and a.state = 'deleted' and a.environment = private.environment()) then
      v_state := 'deleted';
    end if;
  end if;
  if v_state = 'deleted' then
    return jsonb_build_object('status', 'deleted');
  elsif v_record.revoked_at is not null and v_state is not null then
    return jsonb_build_object('status', 'revoked', 'at', v_record.revoked_at, 'by', v_record.revoked_by);
  elsif v_state = 'deletion_scheduled' then
    return jsonb_build_object('status', 'deletion-scheduled', 'deadline', v_deadline);
  elsif v_state = 'active' and exists (select 1 from auth.sessions s where s.id = v_record.session_id) then
    update private.account_sessions r set last_seen_at = now()
      where r.session_id = v_record.session_id and r.last_seen_at < now() - interval '30 seconds';
    return jsonb_build_object('status', 'active');
  end if;
  raise exception 'not authorized' using errcode = '42501';
end $$;

-- The deletion's progress, by a status credential of one of the deleted
-- account's sessions: the restricted status view for a device that erased the
-- account (and #106's web page). It grants no record access, and answers
-- nothing for an account that isn't deleted.
create function public.deletion_progress_v1(token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_account uuid;
begin
  if coalesce(token, '') ~ '^[0-9a-f]{64}$' then
    select a.account_id into v_account
      from public.accounts a
      where a.state = 'deleted' and a.environment = private.environment()
        and a.account_id in (
          select r.account_id from private.account_sessions r where r.status_hash = extensions.digest(token, 'sha256')
          union all
          select d.account_id from private.deleted_sessions d where d.status_hash = extensions.digest(token, 'sha256'));
  end if;
  if v_account is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return private.deletion_progress(v_account);
end $$;

-- ---------------------------------------------------------------------------
-- Retention (Amendment 1 C6; #98's private.retention_rules)
-- ---------------------------------------------------------------------------

insert into private.retention_rules (subject, endpoint, dependency, owner) values
  ('private.deletions',
   'The deletion-control record of a deleted account: its origin, request time, boundary and cleanup step times, so its status answers and its ID stays denied. '
     || 'No history, prose, purchase blacklist or forfeiture ledger. Its residual record goes once no credential or usable recovery source can resurrect the account.',
   'Backups older than the deletion, and devices still holding its status credentials (#43).',
   'Spec 7 (#57), final retention schedule and backup aging'),
  ('private.deleted_sessions',
   'A deleted account''s status credentials, as hashes only, so a device that was away still learns its account is deleted and erases it.',
   'Devices that may still hold a credential and haven''t asked since the deletion.',
   'Spec 7 (#57), final retention schedule');

update private.retention_rules set endpoint =
  'The account and its lifecycle state. A deleted account''s row (ID, state and environment, with no Auth user) is its deletion control: its ID stays denied and is never reused.'
  where subject = 'public.accounts';
update private.retention_rules set endpoint =
  'Each accepted Schedule or Cancel deletion request''s answer, so a retry gets it again: kept while the account exists; removed by permanent deletion (#104).'
  where subject = 'private.deletion_receipts';
update private.retention_rules set endpoint =
  'Each installation the account signed in on, which its command scope and Devices name: kept while the account exists; removed by permanent deletion (#104).'
  where subject = 'private.installations';
update private.retention_rules set endpoint =
  'Every analytics ID the account has had: kept until permanent deletion (#104) has asked the analytics provider to erase each one (Amendment 8 §3).'
  where subject = 'private.analytics_ids';
update private.retention_rules set endpoint =
  'A registered session: goes with its session when that simply ends. A revoked one keeps its row (revoked_at), so its device''s lifecycle status still answers revoked. '
    || 'Permanent deletion (#104) removes them, keeping only their status credentials'' hashes (private.deleted_sessions).'
  where subject = 'private.account_sessions';
update private.retention_rules set endpoint =
  'Acknowledged sensitive outcomes, kept until every usable recovery source is newer than the entry. A deleted account keeps only its deletion''s entry, which supersedes the rest for any restore.'
  where subject = 'private.control_journal';

-- ---------------------------------------------------------------------------
-- Email: "permanent deletion accepted"
-- ---------------------------------------------------------------------------

alter table private.email_sends drop constraint email_sends_type_check;
alter table private.email_sends add constraint email_sends_type_check
  check (type in ('code', 'no-account', 'method-linked', 'email-change', 'device-revoked', 'export-ready', 'deletion-scheduled', 'deletion-accepted'));

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke execute on function private.forget_deletion_origin(), private.deletion_cleanup_window(),
  private.cancel_owned_publications(uuid), private.remove_public_content(uuid), private.purchase_cleanup(uuid),
  private.wake_deletion_job(), private.cross_deletion_boundary(uuid, text, timestamptz), private.lock_account_lifecycle(uuid),
  private.deletion_progress(uuid), private.deletion_step_lease(), private.deletion_export_wait(), private.purge_account_records(uuid), private.remove_account_identity(uuid),
  private.finalize_deletion(uuid), private.wake_due_deletions() from public;
revoke execute on procedure private.deletion_upkeep() from public;

revoke execute on function public.delete_permanently_v1() from public, anon;
grant execute on function public.delete_permanently_v1() to authenticated;

revoke execute on function public.deletion_progress_v1(text) from public;
grant execute on function public.deletion_progress_v1(text) to anon, authenticated;

revoke execute on function public.begin_rights_request_deletion(uuid, timestamptz, boolean), public.deletion_case_v1(uuid),
  public.deletions_due(), public.advance_deletion(uuid), public.deletion_step_done(uuid, text, jsonb),
  public.deletion_step_failed(uuid), public.analytics_erasure_completed(uuid) from public, anon, authenticated;
grant execute on function public.begin_rights_request_deletion(uuid, timestamptz, boolean), public.deletion_case_v1(uuid),
  public.deletions_due(), public.advance_deletion(uuid), public.deletion_step_done(uuid, text, jsonb),
  public.deletion_step_failed(uuid), public.analytics_erasure_completed(uuid) to service_role;
