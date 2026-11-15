-- Email codes (spec 2, #88). Every code request goes through the request-code
-- function (supabase/functions/request-code), which applies the per-address
-- and per-IP limits, then emails either the code (an account exists) or a "No
-- account for this address" notice, and answers the same either way. Auth
-- itself sends no email.

-- ---------------------------------------------------------------------------
-- Auth's own email
-- ---------------------------------------------------------------------------

-- Auth's send-email hook (config.toml). Auth's public code endpoint would mail a
-- code with none of the limits below, so it is refused: the request-code
-- function issues codes through the admin API, which sends nothing itself.
-- Later email types Auth must send (Secure Email Change) route through here.
create function private.refuse_auth_email(event jsonb) returns jsonb
language sql immutable security definer set search_path = '' as $$
  select jsonb_build_object('error', jsonb_build_object('http_code', 422, 'message', 'email codes are requested through request-code'))
$$;

revoke execute on function private.refuse_auth_email(jsonb) from public;
grant execute on function private.refuse_auth_email(jsonb) to supabase_auth_admin;

-- ---------------------------------------------------------------------------
-- Code-request limits
-- ---------------------------------------------------------------------------

-- One row per admitted request, keyed by hashes: no address or IP is stored.
create table private.code_requests (
  id bigint generated always as identity primary key,
  address_hash bytea not null,
  ip_hash bytea not null,
  requested_at timestamptz not null default now()
);
create index code_requests_address on private.code_requests (address_hash, requested_at);
create index code_requests_ip on private.code_requests (ip_hash, requested_at);

-- When the next request in a window may go: the first `free` at once, then
-- each needs 30 s, 60 s, 120 s, ... since the one before (backoff), and at most
-- `cap` in any hour.
create function private.code_request_ready(count integer, latest timestamptz, oldest timestamptz, free integer, cap integer)
returns timestamptz
language sql immutable set search_path = '' as $$
  select case
    when count >= cap then oldest + interval '1 hour'
    when count >= free then latest + interval '30 seconds' * power(2, count - free)
  end
$$;

-- Admits a code request, or says how long to wait. Both limits apply the same
-- whether or not the address has an account, and ahead of any send (and of
-- Supabase's own SMTP cap). The numbers are this implementation's reading of
-- spec 2's "a handful per hour, with backoff" (packages/account/test/email-codes.test.ts):
--   Per address: two at once, then backoff, at most 5 in any hour.
--   Per IP: five at once, then backoff, at most 10 in any hour. A little more
--   room than one address, since a shared network such as a casino's Wi-Fi
--   puts several players behind one IP.
create function public.admit_code_request(address text, ip text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_address bytea := extensions.digest(lower(btrim(address)), 'sha256');
  v_ip bytea := extensions.digest(coalesce(ip, ''), 'sha256');
  v_now timestamptz := now();
  v_window timestamptz := v_now - interval '1 hour';
  v_ready timestamptz;
begin
  -- Serialize requests for one address and for one IP, so racing requests
  -- can't both take the last slot.
  perform pg_advisory_xact_lock(hashtextextended(encode(v_address, 'hex'), 88));
  perform pg_advisory_xact_lock(hashtextextended(encode(v_ip, 'hex'), 89));

  select greatest(
    (select private.code_request_ready(count(*)::integer, max(requested_at), min(requested_at), 2, 5)
       from private.code_requests where address_hash = v_address and requested_at > v_window),
    (select private.code_request_ready(count(*)::integer, max(requested_at), min(requested_at), 5, 10)
       from private.code_requests where ip_hash = v_ip and requested_at > v_window)
  ) into v_ready;

  if v_ready > v_now then
    return jsonb_build_object('admitted', false, 'retry_after', ceil(extract(epoch from v_ready - v_now))::integer);
  end if;
  insert into private.code_requests (address_hash, ip_hash, requested_at) values (v_address, v_ip, v_now);
  return jsonb_build_object('admitted', true);
end $$;

-- ---------------------------------------------------------------------------
-- Recipients and assertions, for the request-code function
-- ---------------------------------------------------------------------------

-- Who an address belongs to: 'account' (an account that isn't deleted),
-- 'pending' (an Auth user from Create whose code was never entered), or 'none'.
create function public.email_code_recipient(address text) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when exists (
      select 1 from auth.users u join public.accounts a on a.auth_user_id = u.id
      where lower(u.email) = lower(btrim(address)) and a.state <> 'deleted' and a.environment = private.environment()
    ) then 'account'
    when exists (select 1 from auth.users u where lower(u.email) = lower(btrim(address))) then 'pending'
    else 'none'
  end
$$;

-- Whether an unexpired eligibility assertion covers a Create for this address:
-- unused, or used by this address's own Create (a resend before the first code
-- was entered). Only the holder of the token learns anything from it.
create function public.eligibility_assertion_usable(assertion text, address text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from private.eligibility_assertions a
    where a.token_hash = extensions.digest(coalesce(assertion, ''), 'sha256')
      and a.expires_at > now()
      and (
        a.consumed_at is null
        or exists (
          select 1 from auth.users u
          where lower(u.email) = lower(btrim(address)) and u.raw_user_meta_data ->> 'eligibility_assertion' = assertion
        )
      )
  )
$$;

-- A Create for an address whose Auth user is still pending (its code was never
-- entered): the newest age answer decides the band, and its assertion is used
-- up like any other. A resend under the assertion that made the user changes
-- nothing. False when the assertion can no longer be used.
create function public.renew_pending_eligibility(address text, assertion text) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user uuid;
  v_made_by text;
  v_band text;
begin
  select u.id, u.raw_user_meta_data ->> 'eligibility_assertion' into v_user, v_made_by
    from auth.users u join private.pending_eligibility p on p.auth_user_id = u.id
    where lower(u.email) = lower(btrim(address))
    for update of u;
  if v_user is null then
    return false;
  end if;
  if v_made_by = assertion then
    return true;
  end if;
  update private.eligibility_assertions
    set consumed_at = now()
    where token_hash = extensions.digest(coalesce(assertion, ''), 'sha256') and consumed_at is null and expires_at > now()
    returning band into v_band;
  if v_band is null then
    return false;
  end if;
  update private.pending_eligibility set band = v_band where auth_user_id = v_user;
  update auth.users set raw_user_meta_data = raw_user_meta_data || jsonb_build_object('eligibility_assertion', assertion) where id = v_user;
  return true;
end $$;

-- ---------------------------------------------------------------------------
-- Send log: the message type, its pacing and outcome. Never an address or body.
-- ---------------------------------------------------------------------------

create table private.email_sends (
  id bigint generated always as identity primary key,
  type text not null check (type in ('code', 'no-account')),
  pacing text not null check (pacing in ('immediate', 'bulk')),
  outcome text not null check (outcome in ('sent', 'failed')),
  sent_at timestamptz not null default now()
);

create function public.log_email_send(type text, pacing text, outcome text) returns void
language sql volatile security definer set search_path = '' as $$
  insert into private.email_sends (type, pacing, outcome) values (type, pacing, outcome)
$$;

-- Only the request-code function (service role) calls these.
revoke execute on function public.admit_code_request(text, text) from public, anon, authenticated;
revoke execute on function public.email_code_recipient(text) from public, anon, authenticated;
revoke execute on function public.eligibility_assertion_usable(text, text) from public, anon, authenticated;
revoke execute on function public.log_email_send(text, text, text) from public, anon, authenticated;
revoke execute on function public.renew_pending_eligibility(text, text) from public, anon, authenticated;
revoke execute on function private.code_request_ready(integer, timestamptz, timestamptz, integer, integer) from public;
grant execute on function public.admit_code_request(text, text) to service_role;
grant execute on function public.email_code_recipient(text) to service_role;
grant execute on function public.eligibility_assertion_usable(text, text) to service_role;
grant execute on function public.log_email_send(text, text, text) to service_role;
grant execute on function public.renew_pending_eligibility(text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Jobs
-- ---------------------------------------------------------------------------

-- Requests older than the longest window no longer count; send-log entries go
-- after 30 days, as Resend's own retention does.
create function private.expire_email_records() returns void
language sql security definer set search_path = '' as $$
  delete from private.code_requests where requested_at <= now() - interval '1 hour';
  delete from private.email_sends where sent_at <= now() - interval '30 days';
$$;

revoke execute on function private.expire_email_records() from public;

select cron.schedule('expire-email-records', '*/15 * * * *', 'select private.expire_email_records()');
