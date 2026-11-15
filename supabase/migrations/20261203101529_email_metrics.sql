-- Every email type counts in the email metrics (spec 2, *Transactional
-- email*: failure, bounce and complaint metrics; #52 review, from #92). The
-- metrics and the delivery-problem log knew only the code and "No account for
-- this address" emails, while #100–#104 sent five more types (and Auth's
-- Secure Email Change codes go through the send-email hook as 'email-change').
-- One list now names them, for the send log, the problems log and the
-- metrics, so a new type is added in one place.

create function private.email_types() returns text[]
language sql immutable set search_path = '' as $$
  select array['code', 'no-account', 'method-linked', 'email-change', 'device-revoked', 'export-ready', 'deletion-scheduled', 'deletion-accepted']
$$;

alter table private.email_sends drop constraint email_sends_type_check;
alter table private.email_sends add constraint email_sends_type_check check (type = any (private.email_types()));

alter table private.email_delivery_problems drop constraint email_delivery_problems_type_check;
alter table private.email_delivery_problems add constraint email_delivery_problems_type_check check (type = any (private.email_types()));

-- #92's snapshot (20261121143717_operational_metrics.sql), counting every type:
--   email_sends_failed           {each type}: emails that couldn't be delivered
--   email_delivery_problems      {each type} each {bounced, complained}
create or replace function public.operational_metrics(since timestamptz) returns jsonb
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
      from unnest(private.email_types()) as t (type)
    ),
    'email_delivery_problems', (
      select jsonb_object_agg(t.type, (
        select jsonb_object_agg(p.problem, (
          select count(*) from private.email_delivery_problems d where d.type = t.type and d.problem = p.problem and d.reported_at >= since
        ))
        from (values ('bounced'), ('complained')) as p (problem)
      ))
      from unnest(private.email_types()) as t (type)
    ),
    'email_queue_age_ms', null
  )
$$;
