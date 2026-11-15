-- Operational metrics (spec 2, *Observability and privacy boundaries*; #108).
--
-- The backend's half of the operational metrics: aggregates over every
-- account, never one account's. They hold counts, ages and sizes only: no
-- record body, token, email code, raw age data, clock anchor, address or
-- account. The exporter (spec 7, behind the metrics provider) maps the
-- snapshot onto the catalog in packages/account/src/metrics.ts.

-- ---------------------------------------------------------------------------
-- Bounces and complaints: the message type and what happened. Never an address.
-- ---------------------------------------------------------------------------

create table private.email_delivery_problems (
  id bigint generated always as identity primary key,
  type text not null check (type in ('code', 'no-account')),
  problem text not null check (problem in ('bounced', 'complained')),
  reported_at timestamptz not null default now()
);

revoke all on private.email_delivery_problems from public, anon, authenticated;

-- The mail provider's bounce and complaint webhook (#122) calls this with what
-- it reported, keeping nothing else from the report.
create function public.record_email_delivery_problem(type text, problem text) returns void
language sql volatile security definer set search_path = '' as $$
  insert into private.email_delivery_problems (type, problem) values (type, problem)
$$;

revoke execute on function public.record_email_delivery_problem(text, text) from public, anon, authenticated;
grant execute on function public.record_email_delivery_problem(text, text) to service_role;

-- Bounces and complaints go after 30 days, like the send log (from 20261115000000_email_codes.sql).
create or replace function private.expire_email_records() returns void
language sql security definer set search_path = '' as $$
  delete from private.code_requests where requested_at <= now() - interval '1 hour';
  delete from private.email_sends where sent_at <= now() - interval '30 days';
  delete from private.email_delivery_problems where reported_at <= now() - interval '30 days';
$$;

-- ---------------------------------------------------------------------------
-- The snapshot
-- ---------------------------------------------------------------------------

-- What the backend measures since `since` (counts) and now (ages, sizes):
--   sync_receipts_refused        receipts that refused their upload
--   transactions_rolled_back     transactions that failed and rolled back: a running total since the statistics were reset
--   staged_chunks_age_ms         the oldest staged chunk's wait, or null when none is staged
--   storage_bytes                {database, staged-chunks, objects}
--   email_sends_failed           {code, no-account}: emails that couldn't be delivered
--   email_delivery_problems      {code, no-account} each {bounced, complained}
--   email_queue_age_ms           null: email isn't queued (codes are sent at once, with no retry queue; bulk mail has no sender yet)
create function public.operational_metrics(since timestamptz) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'sync_receipts_refused',
      (select count(*) from private.sync_receipts where received_at >= since and disposition ->> 'status' = 'rejected'),
    'transactions_rolled_back',
      (select xact_rollback from pg_stat_database where datname = current_database()),
    'staged_chunks_age_ms',
      (select floor(extract(epoch from now() - min(received_at)) * 1000)::bigint from private.staged_chunks),
    'storage_bytes', jsonb_build_object(
      'database', pg_database_size(current_database()),
      'staged-chunks', (select coalesce(sum(octet_length(data)), 0) from private.staged_chunks),
      'objects', (select coalesce(sum((metadata ->> 'size')::bigint), 0) from storage.objects)
    ),
    'email_sends_failed', (
      select jsonb_object_agg(t.type, (select count(*) from private.email_sends s where s.type = t.type and s.outcome = 'failed' and s.sent_at >= since))
      from (values ('code'), ('no-account')) as t (type)
    ),
    'email_delivery_problems', (
      select jsonb_object_agg(t.type, (
        select jsonb_object_agg(p.problem, (
          select count(*) from private.email_delivery_problems d where d.type = t.type and d.problem = p.problem and d.reported_at >= since
        ))
        from (values ('bounced'), ('complained')) as p (problem)
      ))
      from (values ('code'), ('no-account')) as t (type)
    ),
    'email_queue_age_ms', null
  )
$$;

revoke execute on function public.operational_metrics(timestamptz) from public, anon, authenticated;
grant execute on function public.operational_metrics(timestamptz) to service_role;
