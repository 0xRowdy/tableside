-- Reviewer access (spec 2 *App-review access*; Amendment 1 C4, Amendment 8 §6;
-- #107). App reviewers sign in to designated synthetic reviewer accounts with
-- a reviewer credential, without anyone answering an email code.
--
-- - Only the provision-reviewer function (called with this project's secret
--   key) makes reviewer accounts. It creates a new Auth user, so each one goes
--   through the same eligibility assertion as any Create and opens with an
--   established adult record. An account is designated as it opens, and never
--   afterwards: no existing account can become a reviewer account.
-- - Each reviewer account has its own reviewer credential, kept here only as a
--   hash. It exists only in this environment's database, so another
--   environment refuses it. Reissuing one replaces the last.
-- - The reviewer-sign-in function checks a credential against its account and
--   starts an ordinary session for it: the same token, gate, eligibility rules
--   and authorization as any sign-in. Nothing else accepts a credential.

-- One row per reviewer account. The permanent-deletion job (a later ticket)
-- removes the row with the rest of the account's data.
create table private.reviewer_accounts (
  account_id uuid primary key references public.accounts (account_id),
  credential_hash bytea,
  credential_issued_at timestamptz
);

-- Designates an account as it opens when its Auth user was made by
-- provision-reviewer (app metadata, which only the secret key can write).
create function private.designate_reviewer_account() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from auth.users u where u.id = new.auth_user_id and u.raw_app_meta_data ->> 'tableside_reviewer' = 'true') then
    insert into private.reviewer_accounts (account_id) values (new.account_id);
  end if;
  return null;
end $$;

create trigger designate_reviewer_account after insert on public.accounts
  for each row execute function private.designate_reviewer_account();

-- ---------------------------------------------------------------------------
-- Review credentials
-- ---------------------------------------------------------------------------

-- 20 characters from a 32-letter alphabet without I, L, O or U (100 random
-- bits), in groups of five: "K7Q2M-9XWBR-...". Random enough that guessing
-- one is hopeless, so attempts need no limit of their own.
create function private.new_reviewer_credential() returns text
language sql volatile set search_path = '' as $$
  select string_agg(
    substr('ABCDEFGHJKMNPQRSTVWXYZ0123456789', get_byte(r.bytes, i) % 32 + 1, 1) || case when i in (4, 9, 14) then '-' else '' end,
    '' order by i)
  from (select extensions.gen_random_bytes(20) as bytes) r, generate_series(0, 19) i
$$;

-- What is hashed: case, spaces and dashes don't matter, and O, I and L read as 0, 1 and 1.
create function private.reviewer_credential_hash(credential text) returns bytea
language sql immutable set search_path = '' as $$
  select extensions.digest(translate(upper(regexp_replace(coalesce(credential, ''), '[^A-Za-z0-9]', '', 'g')), 'OIL', '011'), 'sha256')
$$;

-- The reviewer account an address signs in to in this environment, unless deleted.
create function private.reviewer_account(address text) returns uuid
language sql stable security definer set search_path = '' as $$
  select r.account_id
  from private.reviewer_accounts r
  join public.accounts a on a.account_id = r.account_id
  join auth.users u on u.id = a.auth_user_id
  where lower(u.email) = lower(btrim(address)) and a.state <> 'deleted' and a.environment = private.environment()
$$;

-- A new reviewer credential for a reviewer account, replacing its last one; null
-- when the address has no reviewer account, so it never reaches another account.
create function public.issue_reviewer_credential(address text) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_account uuid := private.reviewer_account(address);
  v_credential text := private.new_reviewer_credential();
begin
  update private.reviewer_accounts
    set credential_hash = private.reviewer_credential_hash(v_credential), credential_issued_at = now()
    where account_id = v_account;
  return case when found then v_credential end;
end $$;

-- Whether a reviewer credential is the current one for the address's reviewer
-- account. The answer is the same false for an address with an ordinary
-- account, a Create under way, or nothing.
create function public.reviewer_credential_valid(address text, credential text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from private.reviewer_accounts r
    where r.account_id = private.reviewer_account(address)
      and r.credential_hash = private.reviewer_credential_hash(credential)
  )
$$;

-- Only the secret key calls these: provision-reviewer passes on its caller's,
-- reviewer-sign-in uses its own.
revoke execute on function public.issue_reviewer_credential(text) from public, anon, authenticated;
revoke execute on function public.reviewer_credential_valid(text, text) from public, anon, authenticated;
grant execute on function public.issue_reviewer_credential(text) to service_role;
grant execute on function public.reviewer_credential_valid(text, text) to service_role;
