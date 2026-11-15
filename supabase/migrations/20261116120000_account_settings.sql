-- Settings → Account (spec 2, #99): the account currency and the account summary.
--
-- Each account has one real-money currency for casino records (spec 2
-- Amendment 4 §4). It defaults from the device locale when the account is
-- created and can't change while any casino session exists, since amounts are
-- never converted. The locale's currency rides with the age step's eligibility
-- assertion, so every way of creating an account (email code, Apple, Google)
-- starts with it. Simulated amounts never use it.

alter table public.accounts add column currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$');
alter table private.eligibility_assertions add column currency text check (currency ~ '^[A-Z]{3}$');
alter table private.pending_eligibility add column currency text check (currency ~ '^[A-Z]{3}$');

-- #84's age step, now also holding the device locale's currency. A currency
-- that isn't an ISO 4217 code is ignored, never a reason to refuse the age step.
drop function public.issue_eligibility_assertion(text);
create function public.issue_eligibility_assertion(age_range text, currency text default null) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_expires timestamptz := now() + interval '10 minutes';
begin
  if age_range is null or age_range not in ('13-15', '16-17', '18+') then
    raise exception 'no eligibility assertion for this age range' using errcode = '22023';
  end if;
  insert into private.eligibility_assertions (token_hash, band, expires_at, currency)
    values (extensions.digest(v_token, 'sha256'), age_range, v_expires, case when currency ~ '^[A-Z]{3}$' then currency end);
  return jsonb_build_object('assertion', v_token, 'expires_at', v_expires);
end $$;

revoke execute on function public.issue_eligibility_assertion(text, text) from public;
grant execute on function public.issue_eligibility_assertion(text, text) to anon, authenticated;

-- #87's version, now holding the assertion's currency beside its band.
create or replace function private.consume_eligibility_assertion() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_band text;
  v_currency text;
begin
  if (new.raw_user_meta_data ->> 'environment') is distinct from private.environment() then
    raise exception 'environment_mismatch' using errcode = '42501';
  end if;
  update private.eligibility_assertions
    set consumed_at = now()
    where token_hash = extensions.digest(coalesce(new.raw_user_meta_data ->> 'eligibility_assertion', ''), 'sha256')
      and consumed_at is null
      and expires_at > now()
    returning band, currency into v_band, v_currency;
  if v_band is null then
    raise exception 'eligibility assertion required' using errcode = '42501';
  end if;
  insert into private.pending_eligibility (auth_user_id, band, currency) values (new.id, v_band, v_currency);
  return new;
end $$;

-- #88's version: the newest Create's age answer also brings its currency.
create or replace function public.renew_pending_eligibility(address text, assertion text) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user uuid;
  v_made_by text;
  v_band text;
  v_currency text;
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
    returning band, currency into v_band, v_currency;
  if v_band is null then
    return false;
  end if;
  update private.pending_eligibility set band = v_band, currency = v_currency where auth_user_id = v_user;
  update auth.users set raw_user_meta_data = raw_user_meta_data || jsonb_build_object('eligibility_assertion', assertion) where id = v_user;
  return true;
end $$;

-- #84's version, opening the account in the currency its Create carried.
create or replace function private.open_account_when_confirmed() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_band text;
  v_currency text;
  v_account uuid;
begin
  if new.email_confirmed_at is null or (tg_op = 'UPDATE' and old.email_confirmed_at is not null) then
    return null;
  end if;
  delete from private.pending_eligibility where auth_user_id = new.id returning band, currency into v_band, v_currency;
  if v_band is null then
    return null;
  end if;
  insert into public.accounts (auth_user_id, currency) values (new.id, coalesce(v_currency, 'USD')) returning account_id into v_account;
  insert into public.eligibility (account_id, band, source, checked_at, policy_version)
    values (v_account, v_band, 'declaration', now(), 1);
  return null;
end $$;

-- How many casino sessions the account holds. Spec 4 registers casino sessions
-- and replaces this; until then there are none, so the currency can change.
create function private.account_casino_sessions(account uuid) returns bigint
language sql stable security definer set search_path = '' as $$
  select 0::bigint
$$;

revoke execute on function private.account_casino_sessions(uuid) from public;

-- #84's operation, now also returning the currency.
create or replace function public.current_account() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('account_id', a.account_id, 'eligibility', e.band, 'currency', a.currency)
  from public.accounts a
  left join public.eligibility e on e.account_id = a.account_id
  where a.account_id = private.active_account()
$$;

-- What Settings → Account shows: the private sign-in email, the sign-in
-- methods, the currency and whether it can change, and how many sessions are
-- signed in. Null when the gate denies.
create function public.account_summary_v1() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'email', u.email,
    'methods', coalesce((select jsonb_agg(distinct i.provider) from auth.identities i where i.user_id = u.id), '[]'::jsonb),
    'currency', a.currency,
    'currency_changeable', private.account_casino_sessions(a.account_id) = 0,
    'devices', (select count(*) from auth.sessions s where s.user_id = u.id)
  )
  from public.accounts a
  join auth.users u on u.id = a.auth_user_id
  where a.account_id = private.active_account()
$$;

-- Changes the account currency. The account row is locked first, so a casino
-- session accepted concurrently (spec 4) is either counted or waits for this.
create function public.set_account_currency_v1(new_currency text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_account uuid := private.active_account();
begin
  if v_account is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if new_currency is null or new_currency !~ '^[A-Z]{3}$' then
    raise exception 'not a currency code' using errcode = '22023';
  end if;
  perform 1 from public.accounts where account_id = v_account for update;
  if private.account_casino_sessions(v_account) > 0 then
    return jsonb_build_object('status', 'locked');
  end if;
  update public.accounts set currency = new_currency where account_id = v_account;
  return jsonb_build_object('status', 'changed');
end $$;

revoke execute on function public.account_summary_v1(), public.set_account_currency_v1(text) from public, anon;
grant execute on function public.account_summary_v1(), public.set_account_currency_v1(text) to authenticated;
