-- Revisioned items, conflicts, tombstones and totals (spec 2, #94; their UI is
-- spec 4's). Builds on the synchronization platform (#91): every change here
-- happens inside a type's acceptance operation, so under the account's
-- synchronization head and in the one transaction that also writes the
-- receipt and the feed entry.
--
-- - A revisioned item has one accepted revision. An edit names its base: the
--   accepted revision it was made from (0 for a new item), or the device's own
--   earlier operation on the item when that one was sent before the edit was
--   made. A matching base with no open conflict becomes the next revision.
-- - Anything else becomes a preserved proposal and the accepted revision is
--   frozen as the conflict baseline: no edit is accepted until a resolution
--   names the conflict's current generation and every open proposal. The
--   resolution is one new revision; the proposals' payloads are then removed,
--   from the item and from the feed, leaving only their receipts.
-- - Deletion is a tombstone. A save on a tombstone is always a recovery
--   proposal, never a restore.
-- - Totals: each record type may register a contribution. Triggers on the
--   types' accepted rows remove the prior accepted contribution and add the
--   new one, in the acceptance's transaction, so proposals never count, a
--   baseline counts once and a tombstone counts zero. Amounts stay spec 1's
--   exact money text, and no total adds across currencies, or practice to casino.

-- ---------------------------------------------------------------------------
-- Exact money (spec 1's canonical encoding: "n" or "n/d", normalized)
-- ---------------------------------------------------------------------------

create function private.money_canonical(p_text text) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce((
    select case
      when m[3] is null then not (m[2] = '0' and m[1] = '-')
      else m[2] <> '0' and m[3] <> '1' and gcd(m[2]::numeric, m[3]::numeric) = 1
    end
    from regexp_match(p_text, '^(-?)(0|[1-9][0-9]*)(?:/([1-9][0-9]*))?$') as m
  ), false)
$$;

-- a + b, exactly, in the canonical encoding. Refuses anything not canonical.
create function private.money_add(p_a text, p_b text) returns text
language plpgsql immutable set search_path = '' as $$
declare
  v_an numeric;
  v_ad numeric;
  v_bn numeric;
  v_bd numeric;
  v_n numeric;
  v_d numeric;
  v_g numeric;
begin
  if not (private.money_canonical(p_a) and private.money_canonical(p_b)) then
    raise exception 'not a canonical money value' using errcode = '22023';
  end if;
  v_an := split_part(p_a, '/', 1)::numeric;
  v_ad := coalesce(nullif(split_part(p_a, '/', 2), ''), '1')::numeric;
  v_bn := split_part(p_b, '/', 1)::numeric;
  v_bd := coalesce(nullif(split_part(p_b, '/', 2), ''), '1')::numeric;
  v_n := v_an * v_bd + v_bn * v_ad;
  if v_n = 0 then
    return '0';
  end if;
  v_d := v_ad * v_bd;
  v_g := gcd(v_n, v_d);
  v_n := div(v_n, v_g);
  v_d := div(v_d, v_g);
  return case when v_d = 1 then v_n::text else v_n::text || '/' || v_d::text end;
end $$;

create function private.money_negate(p_value text) returns text
language plpgsql immutable set search_path = '' as $$
begin
  if not private.money_canonical(p_value) then
    raise exception 'not a canonical money value' using errcode = '22023';
  end if;
  return case when p_value = '0' then '0' when left(p_value, 1) = '-' then substr(p_value, 2) else '-' || p_value end;
end $$;

-- ---------------------------------------------------------------------------
-- Totals
-- ---------------------------------------------------------------------------

-- Each record type's contribution (the client half is the registry's
-- `contribution`). `contribute(payload jsonb) returns jsonb` answers null, or
--   {"total":"practice"|"casino","game":text,"currency":"simulated"|ISO 4217 code,"amount":money text}
create table private.record_contributions (
  record_type text primary key,
  contribute regprocedure not null
);

-- The account's lifetime totals: accepted records and their net result, by
-- total, game and currency. Practice is always simulated and casino always a
-- real currency, and each currency is its own row: nothing adds across them.
create table private.account_totals (
  account_id uuid not null references public.accounts (account_id),
  total text not null check (total in ('practice', 'casino')),
  game text not null,
  currency text not null check (currency = 'simulated' or currency ~ '^[A-Z]{3}$'),
  records bigint not null check (records > 0),
  net text not null check (private.money_canonical(net)),
  primary key (account_id, total, game, currency),
  check ((total = 'practice') = (currency = 'simulated'))
);

-- Adds (p_sign 1) or removes (p_sign -1) an accepted payload's contribution.
-- Removing one that was never added is an error, so the transaction fails
-- rather than miscounting.
create function private.apply_contribution(p_account uuid, p_record_type text, p_payload jsonb, p_sign integer) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_contribute regprocedure;
  v_contribution jsonb;
begin
  if p_payload is null then
    return;
  end if;
  select contribute into v_contribute from private.record_contributions where record_type = p_record_type;
  if not found then
    return;
  end if;
  execute format('select %s($1)', v_contribute::regproc) into v_contribution using p_payload;
  if v_contribution is null or jsonb_typeof(v_contribution) = 'null' then
    return;
  end if;
  if p_sign > 0 then
    insert into private.account_totals (account_id, total, game, currency, records, net)
      values (p_account, v_contribution ->> 'total', v_contribution ->> 'game', v_contribution ->> 'currency', 1,
              private.money_add('0', v_contribution ->> 'amount'))
      on conflict (account_id, total, game, currency) do update
        set records = private.account_totals.records + 1,
            net = private.money_add(private.account_totals.net, excluded.net);
  else
    update private.account_totals
      set records = records - 1,
          net = private.money_add(net, private.money_negate(v_contribution ->> 'amount'))
      where account_id = p_account and total = v_contribution ->> 'total' and game = v_contribution ->> 'game'
        and currency = v_contribution ->> 'currency' and records > 1;
    if not found then
      delete from private.account_totals
        where account_id = p_account and total = v_contribution ->> 'total' and game = v_contribution ->> 'game'
          and currency = v_contribution ->> 'currency' and records = 1
          and private.money_add(net, private.money_negate(v_contribution ->> 'amount')) = '0';
      if not found then
        raise exception 'removing a contribution that is not counted' using errcode = '23514';
      end if;
    end if;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Completed practice session: practice totals
-- ---------------------------------------------------------------------------

create function private.contribution_completed_practice_session(p_payload jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('total', 'practice', 'game', p_payload ->> 'game', 'currency', 'simulated', 'amount', p_payload ->> 'netResult')
$$;

insert into private.record_contributions (record_type, contribute)
  values ('completed-practice-session', 'private.contribution_completed_practice_session(jsonb)');

create function private.practice_results_contribution() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform private.apply_contribution(old.account_id, 'completed-practice-session', old.payload, -1);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform private.apply_contribution(new.account_id, 'completed-practice-session', new.payload, 1);
  end if;
  return null;
end $$;

create trigger practice_results_contribution after insert or update or delete on private.practice_results
  for each row execute function private.practice_results_contribution();

-- Results accepted before totals existed.
select private.apply_contribution(account_id, 'completed-practice-session', payload, 1) from private.practice_results;

-- ---------------------------------------------------------------------------
-- Revisioned items
-- ---------------------------------------------------------------------------

create table private.revisioned_items (
  account_id uuid not null references public.accounts (account_id),
  record_type text not null,
  item_id text not null,
  payload_version integer not null,
  -- The accepted revision, from 1. While a conflict is open it is the conflict baseline.
  revision integer not null check (revision > 0),
  -- The accepted revision's payload; null for a tombstone.
  payload jsonb,
  -- The operation that made the accepted revision, and the account sequence that accepted it.
  revision_operation text not null,
  revision_sequence bigint not null,
  -- Whether proposals await review, and the conflict's generation, which changes whenever the conflict does.
  conflicted boolean not null default false,
  generation integer not null default 0,
  primary key (account_id, record_type, item_id)
);

-- Open proposals only: a resolution removes them, payload and all. Each is
-- named by the operation that proposed it.
create table private.revision_proposals (
  account_id uuid not null references public.accounts (account_id),
  record_type text not null,
  item_id text not null,
  proposal_id text not null,
  installation_id text not null,
  action text not null check (action in ('save', 'delete')),
  payload jsonb,
  payload_version integer not null,
  sequence bigint not null,
  primary key (account_id, record_type, item_id, proposal_id),
  foreign key (account_id, record_type, item_id) references private.revisioned_items (account_id, record_type, item_id)
);

revoke all on private.record_contributions, private.account_totals, private.revisioned_items, private.revision_proposals
  from public, anon, authenticated;

create function private.revisioned_items_contribution() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.payload is not distinct from new.payload then
    return null;
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    perform private.apply_contribution(old.account_id, old.record_type, old.payload, -1);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform private.apply_contribution(new.account_id, new.record_type, new.payload, 1);
  end if;
  return null;
end $$;

create trigger revisioned_items_contribution after insert or update or delete on private.revisioned_items
  for each row execute function private.revisioned_items_contribution();

-- The item's state as a feed change:
--   {"state":{"revision","deleted","value","conflict":null|{"generation","proposals":[{"id","kind","installation","value"}]}}}
-- A proposal's kind: edit (a competing save), delete (a deletion based on an
-- obsolete revision) or recovery (a save on a tombstone).
create function private.revisioned_item_change(p_account uuid, p_record_type text, p_item text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('state', jsonb_build_object(
    'revision', i.revision,
    'deleted', i.payload is null,
    'value', coalesce(i.payload, 'null'::jsonb),
    'conflict', case when not i.conflicted then 'null'::jsonb else jsonb_build_object(
      'generation', i.generation,
      'proposals', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', p.proposal_id,
          'kind', case when p.action = 'delete' then 'delete' when i.payload is null then 'recovery' else 'edit' end,
          'installation', p.installation_id,
          'value', coalesce(p.payload, 'null'::jsonb)
        ) order by p.sequence, p.proposal_id), '[]'::jsonb)
        from private.revision_proposals p
        where p.account_id = i.account_id and p.record_type = i.record_type and p.item_id = i.item_id))
    end))
  from private.revisioned_items i
  where i.account_id = p_account and i.record_type = p_record_type and i.item_id = p_item
$$;

-- Accepts one upload of a revisioned item. Each revisioned type's registered
-- acceptance operation calls it with the type's payload check,
-- `valid(value jsonb) returns boolean`. The upload's payload is
--   {"item","action":"save","base","value"}      a new item (base 0) or an edit
--   {"item","action":"delete","base","value":null}
--   {"item","action":"resolve","generation","reviewed":[proposal ids],"value"}   value null: resolved as deleted
-- where base is the accepted revision the edit was made from, or
-- {"operation":id}: the revision the installation's own earlier operation on
-- the item made, for an edit made while that one awaited its receipt.
create function private.accept_revisioned_item(p_account uuid, p_request jsonb, p_sequence bigint, p_valid regprocedure) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_type text := p_request ->> 'recordType';
  v_version integer := (p_request ->> 'payloadVersion')::integer;
  v_item text := p_request ->> 'item';
  v_operation text := p_request ->> 'operation';
  v_installation text := p_request ->> 'installation';
  v_upload jsonb := p_request -> 'payload';
  v_action text;
  v_value jsonb;
  v_base jsonb;
  v_valid boolean;
  v_row private.revisioned_items;
  v_found boolean;
  v_matches boolean := false;
  v_amends text;
  v_change jsonb;
begin
  if jsonb_typeof(v_upload) is distinct from 'object' or jsonb_typeof(v_upload -> 'value') is null then
    return jsonb_build_object('status', 'rejected', 'code', 'invalid-payload');
  end if;
  if v_upload ->> 'item' is distinct from v_item then
    return jsonb_build_object('status', 'rejected', 'code', 'item-mismatch');
  end if;
  v_action := v_upload ->> 'action';
  v_value := v_upload -> 'value';
  v_base := v_upload -> 'base';
  if v_action is null or v_action not in ('save', 'delete', 'resolve') then
    return jsonb_build_object('status', 'rejected', 'code', 'invalid-payload');
  end if;
  -- A save carries a valid value, a deletion none; a resolution either.
  if jsonb_typeof(v_value) <> 'null' then
    if v_action = 'delete' then
      return jsonb_build_object('status', 'rejected', 'code', 'invalid-payload');
    end if;
    execute format('select %s($1)', p_valid::regproc) into v_valid using v_value;
    if not coalesce(v_valid, false) then
      return jsonb_build_object('status', 'rejected', 'code', 'invalid-payload');
    end if;
  elsif v_action = 'save' then
    return jsonb_build_object('status', 'rejected', 'code', 'invalid-payload');
  end if;

  select * into v_row from private.revisioned_items
    where account_id = p_account and record_type = v_type and item_id = v_item for update;
  v_found := found;

  -- -------------------------------------------------------------------------
  -- Resolution: names the conflict's generation and every open proposal
  -- -------------------------------------------------------------------------
  if v_action = 'resolve' then
    if jsonb_typeof(v_upload -> 'generation') is distinct from 'number' or jsonb_typeof(v_upload -> 'reviewed') is distinct from 'array' then
      return jsonb_build_object('status', 'rejected', 'code', 'invalid-payload');
    end if;
    if not v_found or not v_row.conflicted then
      return jsonb_build_object('status', 'rejected', 'code', 'no-conflict');
    end if;
    -- A proposal that arrived after the review changed the conflict: it goes back for review.
    if (v_upload ->> 'generation') is distinct from v_row.generation::text
      or (select coalesce(array_agg(r order by r), '{}') from jsonb_array_elements_text(v_upload -> 'reviewed') r)
         is distinct from
         (select coalesce(array_agg(proposal_id order by proposal_id), '{}') from private.revision_proposals
          where account_id = p_account and record_type = v_type and item_id = v_item) then
      return jsonb_build_object('status', 'rejected', 'code', 'conflict-changed');
    end if;
    delete from private.revision_proposals where account_id = p_account and record_type = v_type and item_id = v_item;
    update private.revisioned_items
      set revision = revision + 1, payload = case when jsonb_typeof(v_value) = 'null' then null else v_value end,
          payload_version = v_version, revision_operation = v_operation, revision_sequence = p_sequence,
          conflicted = false, generation = generation + 1
      where account_id = p_account and record_type = v_type and item_id = v_item;
    v_change := private.revisioned_item_change(p_account, v_type, v_item);
    -- The decision is durable with this transaction: earlier feed entries that
    -- carried the proposals now carry the resolved state instead, so no
    -- rejected payload stays anywhere. Their receipts and identities remain.
    update private.sync_feed set change = v_change
      where account_id = p_account and record_type = v_type and item_id = v_item
        and jsonb_typeof(change #> '{state,conflict}') = 'object';
    return jsonb_build_object('status', 'accepted', 'change', v_change);
  end if;

  -- -------------------------------------------------------------------------
  -- Save or delete
  -- -------------------------------------------------------------------------
  if jsonb_typeof(v_base) = 'number' then
    if (v_base #>> '{}') !~ '^(0|[1-9][0-9]{0,8})$' then
      return jsonb_build_object('status', 'rejected', 'code', 'invalid-payload');
    end if;
    v_matches := case when v_found then v_row.revision = (v_base #>> '{}')::integer else (v_base #>> '{}') = '0' end;
  elsif jsonb_typeof(v_base) = 'object' and jsonb_typeof(v_base -> 'operation') = 'string' then
    v_matches := v_found and v_row.revision_operation = v_base ->> 'operation';
    -- Its predecessor is still this installation's open proposal: this replaces it.
    select proposal_id into v_amends from private.revision_proposals
      where account_id = p_account and record_type = v_type and item_id = v_item
        and proposal_id = v_base ->> 'operation' and installation_id = v_installation;
  else
    return jsonb_build_object('status', 'rejected', 'code', 'invalid-payload');
  end if;

  if not v_found then
    if v_action = 'save' and v_matches then
      insert into private.revisioned_items (account_id, record_type, item_id, payload_version, revision, payload, revision_operation, revision_sequence)
        values (p_account, v_type, v_item, v_version, 1, v_value, v_operation, p_sequence);
      return jsonb_build_object('status', 'accepted', 'change', private.revisioned_item_change(p_account, v_type, v_item));
    end if;
    return jsonb_build_object('status', 'rejected', 'code', 'unknown-item');
  end if;

  -- Deleting a tombstone again changes nothing.
  if v_action = 'delete' and v_row.payload is null then
    return jsonb_build_object('status', 'accepted', 'sequence', v_row.revision_sequence);
  end if;
  -- The edit is the next revision: its base is the accepted one, no conflict is
  -- open, and it isn't a save on a tombstone (that is always a recovery proposal).
  if v_matches and not v_row.conflicted and v_row.payload is not null then
    update private.revisioned_items
      set revision = revision + 1, payload = case when v_action = 'delete' then null else v_value end,
          payload_version = v_version, revision_operation = v_operation, revision_sequence = p_sequence
      where account_id = p_account and record_type = v_type and item_id = v_item;
    return jsonb_build_object('status', 'accepted', 'change', private.revisioned_item_change(p_account, v_type, v_item));
  end if;
  -- A stale save that already matches the accepted revision competes with nothing.
  if v_action = 'save' and not v_row.conflicted and v_row.payload = v_value then
    return jsonb_build_object('status', 'accepted', 'sequence', v_row.revision_sequence);
  end if;

  -- A proposal. The accepted revision stays as the conflict baseline.
  if v_amends is not null then
    delete from private.revision_proposals
      where account_id = p_account and record_type = v_type and item_id = v_item and proposal_id = v_amends;
  end if;
  insert into private.revision_proposals (account_id, record_type, item_id, proposal_id, installation_id, action, payload, payload_version, sequence)
    values (p_account, v_type, v_item, v_operation, v_installation, v_action,
            case when v_action = 'delete' then null else v_value end, v_version, p_sequence);
  update private.revisioned_items set conflicted = true, generation = generation + 1
    where account_id = p_account and record_type = v_type and item_id = v_item;
  return jsonb_build_object('status', 'accepted', 'change', private.revisioned_item_change(p_account, v_type, v_item));
end $$;

-- ---------------------------------------------------------------------------
-- Reading totals
-- ---------------------------------------------------------------------------

-- The account's lifetime totals, and the account sequence they include.
create function public.account_totals_v1() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_account uuid := private.active_account();
begin
  if v_account is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'sequence', coalesce((select sequence from private.sync_heads where account_id = v_account), 0),
    'totals', coalesce((
      select jsonb_agg(jsonb_build_object('total', total, 'game', game, 'currency', currency, 'records', records, 'net', net)
                       order by total, game, currency)
      from private.account_totals where account_id = v_account), '[]'::jsonb));
end $$;

revoke execute on function public.account_totals_v1() from public, anon;
grant execute on function public.account_totals_v1() to authenticated;
