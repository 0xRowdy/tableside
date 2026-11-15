-- Two duplications removed (#52 review). Behaviour is unchanged.
--
-- - private.signed_in_account() joined the caller's session to its account
--   exactly as private.session_account(session, auth_user) does: it is now
--   that function for the caller's own JWT session and user, in this
--   environment.
-- - private.wake_export_job() and private.wake_deletion_job() were the same
--   body with a different function name: both now wake through
--   private.wake_job(name). Their callers are unchanged.

-- #103's restricted-path gate (20261130114217_deletion_scheduling.sql).
create or replace function private.signed_in_account() returns uuid
language sql stable security definer set search_path = '' as $$
  select private.session_account(nullif(auth.jwt() ->> 'session_id', '')::uuid, auth.uid())
  where auth.jwt() ->> 'environment' = private.environment()
$$;

-- Wakes an edge function that takes its work from the database, after this
-- transaction commits (pg_net sends its queue then; a rolled-back request
-- never goes). The wake carries no authority.
create function private.wake_job(p_function text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_url text := (select functions_url from private.job_endpoint);
begin
  if v_url is null or private.environment() is null then
    return;
  end if;
  perform net.http_post(
    url := v_url || '/functions/v1/' || p_function,
    body := '{}'::jsonb,
    headers := jsonb_build_object('content-type', 'application/json', 'x-tableside-environment', private.environment()),
    timeout_milliseconds := 10000);
end $$;

revoke execute on function private.wake_job(text) from public;

-- #102's and #104's wakes (20261129141537_export.sql, 20261201103842_permanent_deletion.sql).
create or replace function private.wake_export_job() returns void
language sql volatile security definer set search_path = '' as $$
  select private.wake_job('export-job')
$$;

create or replace function private.wake_deletion_job() returns void
language sql volatile security definer set search_path = '' as $$
  select private.wake_job('deletion-job')
$$;
