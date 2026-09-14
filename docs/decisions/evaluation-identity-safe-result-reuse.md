# Evaluation identity and safe result reuse — accepted decision

Decision ticket: [Evaluation identity and safe result reuse](https://github.com/0xRowdy/true-count/issues/32), part of the [MVP decision map](https://github.com/0xRowdy/true-count/issues/1).

Q1–Q7 and the integrated contract were accepted in live discussion through Q8. The [resolution comment](https://github.com/0xRowdy/true-count/issues/32#issuecomment-5580084537) is canonical; this file preserves the accepted contract for repository readers. Planning only; no evaluation service has been implemented.

## Accepted choices

- **Q1 — Share the original evaluation:** identical submissions under matching evaluation conditions reference one authoritative evaluation. Allocate its unique random key once, before observing results. Identical submissions join its existing run or reuse its completed evidence. Retries preserve that allocation. Revisions retain separate authorship, ratings, and provenance; sharing evidence does not increase the independent sample count. This preserves the earlier capacity decision's reuse intent and corrects its claim that separately allocated runs necessarily produce identical draws.
- **Q2 — Equality boundary:** require identical normalized executable instructions, rather than attempting to prove behavioral equivalence between different instruction structures. Normalize formatting and equivalent numeric representations; omit titles, author prose, author identity, and revision IDs from executable equality. Preserve instruction order, conditions, priorities, fallbacks, and every execution-affecting field. Require the complete benchmark profile and matching engine, rules, references, analysis, and random-protocol versions. Exact encoding and concurrent identity registration must implement this boundary without creating additional random allocations for identical submissions.
- **Q3 — Shared cancellation:** detach a superseded revision from unfinished work. Continue while another eligible revision needs the shared run; otherwise stop computation while preserving its allocation and recoverable progress. A later identical submission resumes that evaluation rather than receiving fresh draws. Preserve completed historical evidence. Q7 bounds bulky-data retention while preserving random identity.
- **Q4 — Author limits:** each admitted unfinished revision/profile request counts toward its author's two-evaluation limit, including shared computation. Joining requires a free slot; completed-evidence reuse does not. Reserve compute cost once per shared run. Duplicate submissions cannot improve its queue position.
- **Q5 — Corrections:** an execution, rules, reference, or random-protocol correction makes affected evidence invalid or superseded and creates a traceable replacement under corrected versions; authors cannot select the more favorable result. For analysis-only corrections, recompute from original completed session records when sufficient, otherwise replay the original allocation under unchanged execution semantics. Publish separately versioned analysis without counting it as another independent sample.
- **Q6 — Author deletion and required removal:** preserve shared evidence while another legitimate revision or retained copy relies on it. Remove deleted-author identity and prose, show “Deleted author” in source attribution, and retain technical provenance. Delayed jobs cannot restore deleted listings. A validated removal requiring underlying executable content to be disabled also blocks reuse of affected evidence, including through surviving copies. Explicitly mark evidence unavailable where it cannot legitimately remain available.
- **Q7 — Orphaned-data retention:** preserve evidence and recovery data while a legitimate revision or saved history depends on them. After the last dependency disappears, retain bulky evaluation data for 30 days unless account deletion or required removal demands earlier cleanup. Retain a minimal matching/allocation record without author identity or prose while the evaluation version remains eligible for reuse. A later identical submission replays the original allocation if checkpoints have been purged. Lost allocation or prohibited reuse yields unavailable evidence, never a silent fresh sample. This bounds retained progress without weakening the no-reroll rule.

## Integrated contract — accepted in Q8

### Identity and normalization

Keep three distinct records: the revision/profile request, the shared execution run with its original random allocation, and the versioned analysis of that run. A revision references evidence; its author does not own the shared run. An evaluation's full identity includes its analysis version even when an authorized analysis-only correction shares the underlying execution run.

The complete reuse key consists of:

- The versioned canonical encoding of validated executable instructions, including instruction-schema and normalization versions. Encode equivalent exact numeric values consistently and resolve permitted defaults explicitly. Preserve ordered instructions and action groups, targets, priorities, conditions, progression/counter configuration, caps, fallback and stop/settlement behavior. Exclude only non-executing metadata such as titles, prose, author identity and revision IDs. Renaming or editing a description cannot request new random outcomes. No algebraic simplification or proof of general behavioral equivalence is required.
- The full benchmark profile and its version: game/variant, every table condition and betting constraint, starting funds and base unit, scheduled opportunities, simulated-player behavior, cycle restart/funding/stopping/final-settlement conventions, and all other simulation inputs. A profile name alone is insufficient.
- Pinned engine/game semantics, interpreter and rule definitions, exact reference assets, random protocol, analysis implementation and analysis configuration, with immutable content identities. Identical version labels with different artifacts are not a match. UI/app branding, author names, worker count and scheduling are not new evaluation conditions.

Use a versioned deterministic encoding and a content fingerprint for indexed lookup. Retain the manifest needed to audit that fingerprint while evidence is retained. A detected digest/manifest conflict is an integrity error and must not silently share evidence or allocate another sample. Normalize only the agreed representational differences; a compiler optimization must preserve execution and random consumption rather than silently redefining equality. Routine UI or deployment changes cannot be used to manufacture rerolls through unnecessary evaluation-version changes.

An analysis-only correction creates a different full evaluation identity. Its explicit predecessor relationship authorizes reuse of the original execution run; it is not an ordinary cache hit between mismatched analysis versions. This reconciles Q2's full-version match with Q5's corrected-analysis reuse.

### Allocation, concurrency and recovery

Register a single candidate for a canonical specification before dispatch. At first admission, atomically bind its authoritative run identity, pinned execution manifest, cryptographically sourced unique Philox run key and session indices 0–99,999. No simulation outcomes are generated before that durable allocation. Enforce unique specification registration and collision-free run-key allocation in the authoritative registry. Simultaneous identical submissions converge on that record; a losing registration attempt joins it without dispatching a second sample.

Preserve the accepted Philox4x32-10 word/counter/lane protocol, 100,000 completed-session requirement, 200 scheduled opportunities plus full final settlement, complete-session denominators and statistical/display gates. The shared evidence represents 100,000 sessions regardless of how many revisions reference it. Sharing creates no independent replication.

Before allocating anything, distinguish a never-evaluated specification from an existing queued, running, paused, complete, failed, invalid, prohibited or payload-evicted evaluation. Neither a failed job nor a missing payload is a cache miss authorizing a fresh sample. A lost or unreconciled allocation registry blocks fresh allocation for the affected namespace until recovery establishes its history; backup restoration cannot silently turn old specifications into new candidates.

Workers use exclusive session ownership with stale-worker fencing and idempotent completion keys tied to run and session index. Retry unfinished sessions from checkpoints, or replay the same indices from their original allocation where required. Never include a finalized session twice, replace an expensive settlement with a new draw, or turn an execution failure into a completed result. Reduction follows the accepted stable ordering/exact-analysis contract.

An ambiguous dispatch or completion acknowledgement is reconciled against authoritative records. Retry does not create another run, charge reservation or public result. Duplicate physical work caused by failure recovery must still be accounted for within the compute budget even though it contributes no duplicate evidence.

### Admission, sharing and cancellation

An admitted unfinished revision/profile request occupies one of that author's two slots, including a request attached to shared computation. Requests held before admission occupy no slot. A repeated delivery of the same request is idempotent; a separate revision/profile request is a separate association. Reusing completed valid evidence requires no in-flight slot.

Reserve shared execution cost once. Joining an existing run does not duplicate its reservation; any additional analysis/replay work needs its own measured remaining-cost allowance. Preserve the $100 monthly compute ceiling, $90 admission envelope, bounded batch authorization and budget-pause behavior from [Standardized simulation feasibility and expensive-strategy policy](https://github.com/0xRowdy/true-count/issues/31#issuecomment-5579089385). No join bypasses an author's slot limit or changes the run's original queue position. Cache eviction and later replay do not exempt repeated computation from cost controls.

Measure request attachment/admission waits separately from the run's original admission-to-completion time. Joins, pauses, supersession, month rollover and retries cannot reset the original run clock or conceal a latency miss.

Supersession, unpublication, deletion or loss of eligibility removes that revision's request from active demand and prevents later publication to it. Continue unfinished computation only while another eligible admitted request needs it. A saved historical copy can justify retention without automatically requesting new computation. When no active demand remains, fence/checkpoint and stop dispatch. Serialize a new join against final-detachment/cancellation so work is neither discarded beneath a valid dependent nor allowed to republish a removed revision. Release spending reservations only after outstanding work can no longer incur unaccounted charges.

Later eligible demand for the same specification resumes the same allocation, subject to available slots, budget and capacity. Repeated submission cannot improve its queue position. If progress was legitimately purged, replaying its original allocation repeats computation, not statistical sampling. Already completed superseded evidence remains historical evidence under its original versions and references.

### Corrections and current eligibility

Never rewrite completed result payloads or their pinned provenance. Record correction status and replacement links separately. A proven defect quarantines affected evidence immediately; current comparisons must not continue using it while replacement work waits. Unaffected evidence remains eligible under its existing rules.

An execution, rules, reference or random-protocol correction produces an operator-controlled corrected specification and a traceable replacement run with a new unique allocation. All affected identical submissions share that replacement. Authors cannot select old versus new evidence, trigger arbitrary reruns, or choose among samples. An affected evaluation is not displayed as currently valid merely because its replacement is waiting for budget or has failed.

For an analysis-only correction, use sufficient original finalized session records to recompute the full required analysis. If they are insufficient, replay the original 100,000 session allocations using the pinned, unchanged execution semantics. Verify any retained outcomes against replay. If required execution artifacts or allocation cannot be recovered, report unavailable corrected evidence rather than inventing results or allocating fresh draws. A correction that actually changes execution must use the execution-correction path.

The revised analysis has its own version, configuration, timestamp and predecessor link. The original sample identity remains visible, and the sample count is never doubled. Operator-controlled correction rollout and qualification determine current eligible versions uniformly, not by which produces a favorable result.

### Provenance, deletion and retention

Each revision/profile association records its revision reference, requested full specification, whether it initiated or joined/reused the evaluation, its attachment time, shared run/evaluation identity, completion or reuse time, original source-revision relationship, and any correction/predecessor relationship. The run records its canonical inputs, pinned artifacts, original key and index allocation, execution status, completed-session coverage and analysis identities. Public views need clear evaluation date, applicable versions/profile and shared/corrected/historical/unavailable status; internal keys and registry details need not appear in the player interface.

Keep authorship, remixes, ratings and popularity attached to their own revisions and accounts. Sharing computation does not merge those records. Source deletion replaces controlled personal attribution with “Deleted author,” removes controlled author prose, and preserves permitted nonpersonal source relationships. It cannot restore a deleted listing or cause a surviving author's evidence to disappear solely because that author did not initiate the computation.

Apply validated executable-removal restrictions to affected evidence and future matching requests as well as existing copies. Do not infer that numerical equivalence permits bypassing a removal. Distinguish voluntary delisting, account deletion and validated required removal under [Community content rights and author deletion](https://github.com/0xRowdy/true-count/issues/29#issuecomment-5573968803). Preserved evidence requires a legitimate surviving basis; otherwise make it unavailable and perform the required cleanup.

While legitimate revision/history dependencies remain, retain their required evidence and recovery records. After the last dependency disappears, bulky manifests, checkpoints and session/result payloads enter a 30-day retention period. Earlier account-deletion or required-removal cleanup takes precedence, including the accepted seven-day active-system deletion target where applicable. A legitimate new dependency arriving before purge cancels orphan cleanup; purge and attachment must be serialized.

The surviving minimal matching/allocation record contains only the content fingerprint, version/specification identities needed to match it, original run allocation, and required lifecycle/reuse restriction state. It contains no author identity, prose or private practice history. Preserve it while the evaluation version remains eligible for reuse. Retire that version from new reuse before removing the record, and do not later re-enable it without recovering its authoritative allocation history. Preserve the global no-reused-random-tuples constraint in allocation controls. Version retirement does not erase evidence still required by legitimate history dependencies.

Content fingerprints and opaque provenance are not automatically anonymous. [US launch privacy rights and release disclosures](https://github.com/0xRowdy/true-count/issues/36) must inventory this category, its purpose, access, version-retirement expiry trigger and purge owner, and qualify it against the accepted deletion/removal contract. If required cleanup prevents keeping an allocation, preserve unavailability rather than introducing an implicit reroll exception. Recovery controls must also prevent restored backups from reviving removed public content or treating previously allocated specifications as new.

### Required implementation scenarios

These are qualification requirements, not tests performed during planning.

| Scenario | Required result |
| --- | --- |
| Two authors submit identical instructions and profile concurrently | One registered run/allocation and one compute reservation; separate request slots and revision provenance. |
| Rename a strategy or write the same number differently | Same normalized specification and evidence; no additional independent sessions. |
| Change an instruction, table condition or pinned execution dependency | Different full specification; a new run only through normal authoritative admission. |
| Worker crashes or retries after uncertain completion | Same session indices/draws; one included completion per index; actual retry costs remain counted. |
| Original author supersedes while another admitted request remains | Detach the superseded revision, continue the shared run, publish only to eligible dependents. |
| Final dependent detaches concurrently with a new join | Atomic membership/cancellation ordering; no fresh sample, stale publication or lost legitimate dependency. |
| Author already has two unfinished admitted requests | Hold the new join until a slot is available; completed-evidence reuse remains available. |
| Correct execution versus correct analysis only | New traceable run for changed execution; original execution allocation for revised analysis; no favorable selection. |
| Original author deletes their account | Hide owned contributions immediately, sanitize source attribution, preserve permitted surviving evidence, and block delayed republication. |
| Validated removal disables the underlying executable | Affected evidence cannot be reused through existing copies or new identical submissions. |
| Identical submission after 30-day orphan checkpoint purge | Replay the original allocation under budget controls, or report unavailable if recovery is impossible/prohibited. |
| Restore a backup with stale allocation, deletion or correction state | Reconcile authoritative controls before allocating or serving evidence; no duplicate allocation or revived invalid evidence. |

### Resolution and handoffs

This explicitly corrects [Community simulation capacity and operating budget](https://github.com/0xRowdy/true-count/issues/19#issuecomment-5564607629): safe reuse attaches revisions to the original authoritative evaluation and random allocation; independently allocated run keys do not necessarily produce identical draws. Its original cancel-on-supersede wording is refined to remove a dependency and stop shared computation only when no eligible admitted demand remains.

The architecture's revision-specific manifest is clarified into revision request provenance plus a shared execution manifest; its unique-key and deterministic-recovery rules are preserved. Analysis-only corrections explicitly share the old execution allocation through predecessor provenance.

The existing privacy/disclosure decision consumes the minimal-record retention category and the existing worker-hosting/qualification decision consumes shared reservation, concurrency, replay and recovery scenarios. Registry, cache, production workers, paid experiments and deployment remain implementation work. No additional product ticket is required merely to implement the contracts recorded here.
