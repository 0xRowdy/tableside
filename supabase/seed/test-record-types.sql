-- Test-only record types (local stacks only; beta and production never run
-- seeds). Seam 2 proves the platform's behavior for each kind with these, so
-- the specs that register real types (spec 4's casino sessions and private
-- strategies) inherit it and test only their own rules. The client half is
-- packages/account/src/testing/record-types.ts.

-- A revisioned item shaped like a small casino session: a game, a real
-- currency and an exact net result, contributing to casino totals.
create function private.test_revisioned_item_valid_v1(p_value jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(p_value) = 'object'
    and (select count(*) from jsonb_object_keys(p_value)) = 3
    and jsonb_typeof(p_value -> 'game') = 'string'
    and coalesce(p_value ->> 'currency' ~ '^[A-Z]{3}$', false)
    and jsonb_typeof(p_value -> 'net') = 'string'
    and private.money_canonical(p_value ->> 'net')
$$;

create function private.accept_test_revisioned_item_v1(p_account uuid, p_request jsonb, p_sequence bigint) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
begin
  return private.accept_revisioned_item(p_account, p_request, p_sequence, to_regprocedure('private.test_revisioned_item_valid_v1(jsonb)'));
end $$;

create function private.contribution_test_revisioned_item(p_payload jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('total', 'casino', 'game', p_payload ->> 'game', 'currency', p_payload ->> 'currency', 'amount', p_payload ->> 'net')
$$;

-- The seed runs as one batch, so the names resolve when each insert runs, not when the batch is read.
insert into private.record_types (record_type, payload_version, kind, accept)
  values ('test-revisioned-item', 1, 'revisioned-item', to_regprocedure('private.accept_test_revisioned_item_v1(uuid,jsonb,bigint)'));
insert into private.record_contributions (record_type, contribute)
  values ('test-revisioned-item', to_regprocedure('private.contribution_test_revisioned_item(jsonb)'));
