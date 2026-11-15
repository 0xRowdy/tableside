-- Privacy choices in a new device's bootstrap snapshot (#105, on #96's
-- bootstrap). One row: the account's current choices at its last privacy
-- change, which stands for every change before it, so the device's choices
-- and its basis for enabling changes are current from the start. It carries
-- the current generation's analytics ID only while consent is granted; every
-- earlier ID stays in private.analytics_ids, for export and deletion. An
-- account that never made a privacy change has no row. The client half is
-- the `snapshot` change in packages/account/src/privacy-record.ts.
--
-- Feed compaction (#98) must keep every privacy-choice change after any
-- cursor a device may still hold, or reset that device to a snapshot: a lost
-- consent withdrawal or ad-data opt-out would re-enable a choice, and a basis
-- missing a change makes every enabling change stale.

create function private.snapshot_privacy_choices(p_account uuid, p_record_type text)
returns table (item_id text, sequence bigint, change jsonb)
language sql stable security definer set search_path = '' as $$
  select 'current', c.last_sequence, jsonb_build_object('record', jsonb_build_object(
    'version', 1,
    'change', 'snapshot',
    'consent', c.analytics_consent,
    'generation', c.analytics_generation,
    'analyticsId', case when c.analytics_consent = 'granted' then (
      select a.analytics_id from private.analytics_ids a
      where a.account_id = c.account_id and a.generation = c.analytics_generation) end,
    'adDataOptOut', c.ad_data_opt_out_source))
  from private.privacy_choices c
  where c.account_id = p_account and c.last_sequence > 0
$$;

revoke execute on function private.snapshot_privacy_choices(uuid, text) from public;

update private.record_types set snapshot = 'private.snapshot_privacy_choices(uuid,text)'
  where record_type = 'privacy-choice';
