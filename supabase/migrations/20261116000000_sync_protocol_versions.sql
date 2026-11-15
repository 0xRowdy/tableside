-- Synchronization protocol versions (spec 2, *Protocol versions*, #92).
--
-- Protocol N is the envelope version N and the operations named `*_vN`
-- (`sync_upload_v1`, `sync_feed_v1`, `realtime_claim_v1`, ...). Each version
-- the server has ever served has a row here. Retiring one is announced at
-- least 30 days ahead, shown in the app through sync status (never by email),
-- unless an urgent restriction says why it can't wait. From its retirement on,
-- PostgREST's pre-request hook refuses the version's operations with 426
-- Upgrade Required, so an outdated build stops syncing; play never depends on
-- sync. `sync_protocol` is unversioned and its answer's shape never changes,
-- so every build, however old, can learn its version's status.

create table private.sync_protocols (
  protocol integer primary key check (protocol >= 1),
  -- When the version stops being served; null while no retirement is scheduled.
  retires_at timestamptz,
  -- When the retirement was first announced: set by the server, never by the operator.
  announced_at timestamptz,
  -- Why an urgent restriction can't give 30 days' notice; shown to the player.
  urgent_reason text check (urgent_reason is null or length(btrim(urgent_reason)) > 0),
  check ((retires_at is null) = (announced_at is null)),
  check (retires_at is null or urgent_reason is not null or retires_at >= announced_at + interval '30 days')
);

revoke all on private.sync_protocols from public, anon, authenticated;

-- The notice runs from the first announcement: it starts now, a postponement
-- keeps it, and withdrawing the retirement clears it.
create function private.stamp_protocol_announcement() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.retires_at is null then
    new.announced_at := null;
  elsif tg_op = 'INSERT' or old.retires_at is null then
    new.announced_at := now();
  else
    new.announced_at := old.announced_at;
  end if;
  return new;
end $$;

create trigger stamp_announcement before insert or update on private.sync_protocols
  for each row execute function private.stamp_protocol_announcement();

insert into private.sync_protocols (protocol) values (1);

-- Whether the server still serves a protocol version.
create function private.protocol_served(p_protocol integer) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.sync_protocols where protocol = p_protocol and (retires_at is null or retires_at > now()))
$$;

revoke execute on function private.protocol_served(integer) from public;
grant execute on function private.protocol_served(integer) to anon, authenticated, service_role;

-- A protocol version's status, for any caller: it reveals nothing about anyone.
--   {"status":"supported"}
--   {"status":"retiring","retiresAt":"<ISO 8601>","reason":null|"..."}
--   {"status":"retired","reason":null|"..."}   (also for a version never served)
create function public.sync_protocol(protocol integer) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case
    when p.protocol is null then jsonb_build_object('status', 'retired', 'reason', null)
    when p.retires_at is null then jsonb_build_object('status', 'supported')
    when p.retires_at > now() then jsonb_build_object(
      'status', 'retiring',
      'retiresAt', to_char(p.retires_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'reason', p.urgent_reason)
    else jsonb_build_object('status', 'retired', 'reason', p.urgent_reason)
  end
  from (select 1) as one
  left join private.sync_protocols p on p.protocol = sync_protocol.protocol
$$;

revoke execute on function public.sync_protocol(integer) from public;
grant execute on function public.sync_protocol(integer) to anon, authenticated;

-- PostgREST's pre-request hook, now checking protocol versions as well as the
-- environment (#87): a call to an operation of a retired version, `/rpc/<name>_v<N>`,
-- is refused with 426 before it runs.
create function private.check_request() returns void
language plpgsql stable security definer set search_path = '' as $$
declare
  v_version text := substring(coalesce(current_setting('request.path', true), '') from '^/rpc/[a-z0-9_]+_v([0-9]{1,9})$');
begin
  perform private.check_request_environment();
  if v_version is not null and not private.protocol_served(v_version::integer) then
    raise exception 'protocol_retired' using errcode = 'PT426', hint = 'Update the app to sync.';
  end if;
end $$;

revoke execute on function private.check_request() from public;
grant execute on function private.check_request() to anon, authenticated, service_role;

alter role authenticator set pgrst.db_pre_request to 'private.check_request';
notify pgrst, 'reload config';
