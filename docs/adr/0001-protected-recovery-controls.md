# 1. Protected recovery controls: a control journal

Status: accepted for MVP storage (#98). Restore tooling is spec 7's, after MVP.

## Context

Spec 2 Amendment 1 A5 (from #43): acknowledged sensitive outcomes (deletion, revocation, sharing withdrawal, command dispositions) must survive any permitted recovery. Current controls and their latest committed position must be protected independently of an older primary backup, so a later restore can be fenced and have the controls reapplied before it serves anything. Copying an old backup can't restart its recovery eligibility. MVP builds no restore tooling, but its storage must make this possible.

## Decision

Every acknowledged sensitive outcome is appended to `private.control_journal` in the same transaction that makes it, with a monotonic position (an identity column, so commit order within an account):

| Kind | Written by | Control |
| --- | --- | --- |
| `account-state` | a trigger on `public.accounts.state` | the account's lifecycle state |
| `session-revoked` | a trigger on deleting `auth.sessions` | the session, by ID |
| `command-scope` | `sync_scope_v1`, the compaction job | an installation's generation, settled marker, and retirement: the compact form of its command dispositions |
| `purge` | `private.purge_result` | the purged result's identity and sequence |
| `record-control` | a record type's acceptance, through `private.record_control` | the type's own outcome (spec 6's sharing withdrawal; the privacy choices' consent withdrawal and ad-data opt-out, #105) |

Entries hold only the control: never a record body, payload, email or token.

Restore (spec 7) then works like this: ship the journal continuously to storage independent of the primary backups. Restore a backup in isolation, read its last journal position, and reapply every later entry: deny the account or session, keep the generation and marker, re-purge the identity, re-withdraw. Only then serve. Missing journal evidence for an affected account keeps its operations fenced.

## Consequences

- One small insert per sensitive outcome, inside a transaction that already holds the account's synchronization head (or the account row).
- The journal's retention depends on backup retention and its independent copy, so it is a retention exception owned by spec 7 (`private.retention_rules`).
- A new record type with a sensitive outcome must call `private.record_control` in its acceptance transaction (docs/development.md, *Compaction and stale devices*).
- A permanently deleted account keeps only its deletion's `account-state` entry (#104): that entry supersedes the account's earlier ones for any restore (a restore from before it deletes the account again), so `private.remove_account_identity` removes the rest.
- Not decided here: the independent store, the shipping mechanism, writer and restorer fencing. Those are spec 7's.
