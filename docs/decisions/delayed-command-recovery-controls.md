# Delayed commands and recovery controls — accepted decision

For [Delayed-command compaction and recovery-control protocol](https://github.com/0xRowdy/true-count/issues/43). The user accepted the product boundary in the live discussion: keep small per-device progress markers, expire detailed synchronization history safely, and require stale devices to refresh before uploading while preserving unsynced work for reconciliation. Revoked devices require fresh sign-in. Protocol mechanics belong to implementation, not another extended product discussion. Planning only; the issue resolution is canonical.

## Product behavior

- Ordinary compatible synchronization continues automatically. When the server can no longer safely interpret an old device's requests, that device refreshes current account state before uploading pending changes.
- Preserve local unsynced work across refresh, sign-in and supported migrations. Reconcile against current accepted identities and revisions; ambiguous records or intents require review rather than automatic replay or deletion. Preservation is not permission to resurrect a previously deleted record, create a duplicate under a new identity, or transfer data between accounts.
- Confirmed revocation locks local access without erasing private records. Fresh authentication to the same active account may reopen them. Confirmed account deletion still follows the existing wipe/denial contract; a timeout or generic authorization error is not deletion proof.
- A stale synchronization position does not itself expire otherwise valid offline play or subscription access. Existing eligibility, allowance, entitlement and protocol-update rules remain authoritative.
- Uncertain privacy or accounting operations remain restricted/pending until reconciled. Refreshing or signing in never replenishes an allowance, repeats a payout, restores a withdrawn sharing period or revives revoked credentials.

This explicitly permits refresh/reconciliation in place of indefinite automatic replay with the original detailed response. It does not authorize silent loss of unsynced work.

## Implementation constraints

Use authenticated device/command generations and monotonic sequence positions alongside stable operation and result identities. The compact progress marker covers a contiguous range of resolved commands, not simply the largest number received; unresolved gaps retain sufficient evidence or remain fenced. Reject identity reuse and old generations rather than interpreting a missing receipt as a new command.

Advance accepted state, command disposition and synchronization progress together under the existing transaction boundary. Before pruning detail, install a coherent snapshot/reset boundary and sufficient current state to reject or reconcile older requests. Never automatically give an ambiguous old operation a new identity to bypass deduplication. Exact sequence encoding, gap handling, storage layout and compaction cadence are implementation choices to prove against these constraints.

Preserve the existing recovery contract: acknowledged sensitive outcomes must survive permitted recovery, even where ordinary history loss is allowed. The eventual recovery implementation must protect current controls and their latest committed position independently of an older primary backup, fence competing writers/restorers, and reconcile partial outcomes before reopening affected access. Uncertain restrictions deny access/public contribution; uncertain grants or transfers do not create spendable funds. Ordinary database transactions and external provider writes are not assumed atomic.

Independent backups and recovery exercises remain after MVP functionality under the accepted operations sequencing. This decision selects no new service or distributed-commit implementation and claims no completed recovery qualification.

## Retention endpoints

| Information | Endpoint |
| --- | --- |
| Detailed command receipts and synchronization feed | Remove once a durable compact disposition/current-state representation and refresh boundary make every older request safe to reject or reconcile. An elapsed age alone is insufficient. |
| Item deletion and superseded permission/revocation detail | Remove once current authorization, retired command generations and all usable recovery sources prevent resurrection; preserve the minimum barrier until then. |
| Current device progress, permissions and account controls | Keep while their scope remains authoritative. Retiring a scope denies its old commands; a returning device uses refresh/reconciliation. Remove superseded information once replacement state and recovery-source retirement make it unnecessary. |
| Unresolved sensitive outcomes | Keep the minimum outcome evidence or durable restriction until resolution or safe scope retirement; never expire uncertainty into permission or funds. |
| Deleted-account controls | Missing/deleted account IDs remain denied and are never reused. Remove residual controls once no credential or usable recovery source can resurrect the account; preserve the existing seven-day ordinary active cleanup target. |

The privacy decision owns the final disclosed schedule and provider qualification. The research's conditional 15-day active-control ceiling is not an accepted universal deadline or demonstrated purge guarantee. Backup-file expiry and expiry of the control information inside it are distinct; copying an old backup cannot restart its recovery eligibility. Retention exceptions must identify the unresolved dependency and owner, not preserve unrelated private histories indefinitely.

## Acceptance cases for implementation

| Case | Required behavior |
| --- | --- |
| Never-uploaded offline record versus an accepted-then-deleted record with a lost acknowledgement | Preserve local evidence; refresh and reconcile. An absent server record alone proves neither case and cannot authorize automatic creation. |
| Retry of an accepted sharing withdrawal after sharing was re-enabled | Do not withdraw the new period or restore contributions from the old period. |
| Previously unseen withdrawal | In a valid command scope, preserve existing account-wide withdrawal behavior. If its retired scope makes the old intent ambiguous, refresh and reconcile the current choice before any new operation; do not silently execute or discard it. Pending withdrawal still blocks affected public contributions. |
| Revoked credentials restored from backup | Current authorization denies them; sign-in to the same active account is required. |
| Lost transfer acknowledgement or final settlement on an expired grant | Reconcile the original allocation/outcome; keep uncertain transfers frozen. Late history may upload, but no old effect credits today's budget or repeats a payout. |
| Backup predates deletion, withdrawal or command compaction | Restore in isolation and apply current protected controls before serving. Missing current control evidence keeps affected operations fenced. |

## Handoffs

- [US launch privacy rights and release disclosures](https://github.com/0xRowdy/true-count/issues/36): consume these retention endpoints and qualify the final schedule, provider copies and deletion disclosures.
- [Subscription lineage retention and late restoration](https://github.com/0xRowdy/true-count/issues/44): consume the common acceptance/recovery invariants; purchase-specific ownership evidence and late restoration remain that decision.
- Existing synchronization and operations implementation must verify the matrix above. No new planning ticket, production change or additional recovery release gate is created here.

Evidence and prior contracts: [retention investigation](../research/billing-recovery-control-retention.md), [synchronization](local-persistence-account-synchronization.md), [account lifecycle](authentication-account-lifecycle.md), [operations and recovery](backend-operating-envelope-disaster-recovery.md).

## Account-deletion timing amendment

Apply the accepted [30-day undo window](authentication-account-lifecycle.md#accepted-amendment--30-day-deletion-undo-window). Scheduling deletion immediately deactivates access and hides public content but preserves account data for undo. Irreversible deletion acceptance, device wiping and the seven-day active cleanup target begin at the scheduled deadline or accepted Delete permanently now action. Protect the current scheduled/canceled/permanent state during replay and recovery; old jobs cannot finalize a canceled schedule or undo permanent deletion. This does not extend temporary-file TTLs or establish purchase-lineage retention.
