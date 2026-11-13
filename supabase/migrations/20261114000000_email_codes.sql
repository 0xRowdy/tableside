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

-- Admits a code request, or says how long to wait. Both limits apply the same
-- whether or not the address has an account, and ahead of any send.
--   Per address: two at once, then each needs 30 s, 60 s, 120 s since the one
--   before (backoff), and at most 5 in any hour.
--   Per IP: at most 30 in any hour (shared networks, such as a casino's Wi-Fi,
--   put many players behind one address).
create function public.admit_code_request(address text, ip text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_address bytea := extensions.digest(lower(btrim(address)), 'sha256');
  v_ip bytea := extensions.digest(coalesce(ip, ''), 'sha256');
  v_now timestamptz := now();
  v_window timestamptz := v_now - interval '1 hour';
  v_count integer;
  v_latest timestamptz;
  v_oldest timestamptz;
  v_ip_count integer;
  v_ip_oldest timestamptz;
  v_ready timestamptz := v_now;
begin
  -- Serialize requests for one address and for one IP, so racing requests
  -- can't both take the last slot.
  perform pg_advisory_xact_lock(hashtextextended(encode(v_address, 'hex'), 88));
  perform pg_advisory_xact_lock(hashtextextended(encode(v_ip, 'hex'), 89));

  select count(*), max(requested_at), min(requested_at) into v_count, v_latest, v_oldest
    from private.code_requests where address_hash = v_address and requested_at > v_window;
  select count(*), min(requested_at) into v_ip_count, v_ip_oldest
    from private.code_requests where ip_hash = v_ip and requested_at > v_window;

  if v_count >= 5 then
    v_ready := greatest(v_ready, v_oldest + interval '1 hour');
  elsif v_count >= 2 then
    v_ready := greatest(v_ready, v_latest + interval '30 seconds' * power(2, v_count - 2));
  end if;
  if v_ip_count >= 30 then
    v_ready := greatest(v_ready, v_ip_oldest + interval '1 hour');
  end if;

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
      where lower(u.email) = lower(btrim(address)) and a.state <> 'deleted'
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
grant execute on function public.admit_code_request(text, text) to service_role;
grant execute on function public.email_code_recipient(text) to service_role;
grant execute on function public.eligibility_assertion_usable(text, text) to service_role;
grant execute on function public.log_email_send(text, text, text) to service_role;

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
