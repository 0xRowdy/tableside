-- Account authority skeleton (spec 2, #84): accounts and their lifecycle state,
-- the eligibility record, single-use eligibility assertions, and the shared
-- authorization gate used by RLS, storage policies and every function.

-- Not exposed through the API (config.toml [api] schemas).
create schema private;
revoke all on schema private from public;

-- ---------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------

-- The account ID is random and owns everything; the Auth user is only how the
-- account signs in. The row outlives its Auth user (deletion control), so an
-- account ID is never reused.
create table public.accounts (
  account_id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  state text not null default 'active' check (state in ('active', 'deletion_scheduled', 'deleted')),
  created_at timestamptz not null default now()
);

-- One current record per account, replaced rather than kept as a history.
-- Under 13 is stored only for an existing account later found ineligible; the
-- create path never makes an account for it.
create table public.eligibility (
  account_id uuid primary key references public.accounts (account_id),
  band text not null check (band in ('under-13', '13-15', '16-17', '18+')),
  source text not null check (source in ('declaration', 'platform-signal')),
  checked_at timestamptz not null,
  policy_version integer not null
);

-- Issued by the age step before an Auth user may be created. Only the hash of
-- the token is kept.
create table private.eligibility_assertions (
  token_hash bytea primary key,
  band text not null check (band in ('13-15', '16-17', '18+')),
  expires_at timestamptz not null,
  consumed_at timestamptz
);

-- Clients read their own rows through RLS and write nothing directly.
revoke all on public.accounts, public.eligibility from anon, authenticated;
grant select on public.accounts, public.eligibility to authenticated;
alter table public.accounts enable row level security;
alter table public.eligibility enable row level security;

-- ---------------------------------------------------------------------------
-- Authorization gate
-- ---------------------------------------------------------------------------

-- The caller's account when it is active and the session in the caller's JWT
-- has not been revoked; otherwise null. The account always comes from verified
-- authentication, never from a caller-supplied owner.
create function private.active_account() returns uuid
language sql stable security definer set search_path = '' as $$
  select a.account_id
  from public.accounts a
  join auth.sessions s on s.user_id = a.auth_user_id
  where a.auth_user_id = auth.uid()
    and a.state = 'active'
    and s.id = nullif(auth.jwt() ->> 'session_id', '')::uuid
$$;

revoke execute on function private.active_account() from public;
grant usage on schema private to authenticated;
grant execute on function private.active_account() to authenticated;

create policy accounts_own on public.accounts for select to authenticated
  using (account_id = private.active_account());
create policy eligibility_own on public.eligibility for select to authenticated
  using (account_id = private.active_account());

-- ---------------------------------------------------------------------------
-- Eligibility assertions and account creation
-- ---------------------------------------------------------------------------

-- The age step. Under 13 gets no assertion, so it can never create an Auth user.
create function public.issue_eligibility_assertion(age_range text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_expires timestamptz := now() + interval '10 minutes';
begin
  if age_range is null or age_range not in ('13-15', '16-17', '18+') then
    raise exception 'no eligibility assertion for this age range' using errcode = '22023';
  end if;
  insert into private.eligibility_assertions (token_hash, band, expires_at)
    values (extensions.digest(v_token, 'sha256'), age_range, v_expires);
  return jsonb_build_object('assertion', v_token, 'expires_at', v_expires);
end $$;

revoke execute on function public.issue_eligibility_assertion(text) from public;
grant execute on function public.issue_eligibility_assertion(text) to anon, authenticated;

-- Auth's before-user-created hook: refuse every sign-up path (email code,
-- identity provider) that carries no usable assertion, with a clear error.
create function private.before_user_created(event jsonb) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case
    when exists (
      select 1 from private.eligibility_assertions
      where token_hash = extensions.digest(coalesce(event #>> '{user,user_metadata,eligibility_assertion}', ''), 'sha256')
        and consumed_at is null
        and expires_at > now()
    ) then '{}'::jsonb
    else jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'eligibility_assertion_required'))
  end
$$;

revoke execute on function private.before_user_created(jsonb) from public;
grant usage on schema private to supabase_auth_admin;
grant execute on function private.before_user_created(jsonb) to supabase_auth_admin;

-- The enforcement point, in the same transaction as the Auth user insert, so
-- it also covers paths the hook doesn't see (admin creation) and two sign-ups
-- racing on one assertion. It consumes the assertion and opens the account
-- with its eligibility record. (Auth keeps the consumed token in the user's
-- metadata; it can never pass again.)
create function private.open_account_for_new_auth_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_band text;
  v_account uuid;
begin
  update private.eligibility_assertions
    set consumed_at = now()
    where token_hash = extensions.digest(coalesce(new.raw_user_meta_data ->> 'eligibility_assertion', ''), 'sha256')
      and consumed_at is null
      and expires_at > now()
    returning band into v_band;
  if v_band is null then
    raise exception 'eligibility assertion required' using errcode = '42501';
  end if;
  insert into public.accounts (auth_user_id) values (new.id) returning account_id into v_account;
  insert into public.eligibility (account_id, band, source, checked_at, policy_version)
    values (v_account, v_band, 'declaration', now(), 1);
  return new;
end $$;

revoke execute on function private.open_account_for_new_auth_user() from public;

create trigger open_account before insert on auth.users
  for each row execute function private.open_account_for_new_auth_user();

-- ---------------------------------------------------------------------------
-- Operations
-- ---------------------------------------------------------------------------

-- The signed-in account and its eligibility band, or null when the gate denies.
create function public.current_account() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('account_id', a.account_id, 'eligibility', e.band)
  from public.accounts a
  left join public.eligibility e on e.account_id = a.account_id
  where a.account_id = private.active_account()
$$;

revoke execute on function public.current_account() from public;
grant execute on function public.current_account() to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: one private folder per account, named by account ID
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public) values ('account-private', 'account-private', false);

create policy account_private_read on storage.objects for select to authenticated
  using (bucket_id = 'account-private' and (storage.foldername(name))[1] = private.active_account()::text);
create policy account_private_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'account-private' and (storage.foldername(name))[1] = private.active_account()::text);
create policy account_private_update on storage.objects for update to authenticated
  using (bucket_id = 'account-private' and (storage.foldername(name))[1] = private.active_account()::text)
  with check (bucket_id = 'account-private' and (storage.foldername(name))[1] = private.active_account()::text);
create policy account_private_delete on storage.objects for delete to authenticated
  using (bucket_id = 'account-private' and (storage.foldername(name))[1] = private.active_account()::text);

-- ---------------------------------------------------------------------------
-- Jobs
-- ---------------------------------------------------------------------------

create extension if not exists pg_cron with schema pg_catalog;

-- A consumed or expired assertion can never pass again, so its row can go.
create function private.expire_eligibility_assertions() returns void
language sql security definer set search_path = '' as $$
  delete from private.eligibility_assertions where consumed_at is not null or expires_at <= now()
$$;

revoke execute on function private.expire_eligibility_assertions() from public;

select cron.schedule('expire-eligibility-assertions', '*/15 * * * *', 'select private.expire_eligibility_assertions()');
