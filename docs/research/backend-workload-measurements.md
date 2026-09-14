# Backend workload local database measurements

Evidence for [Backend workload and cost feasibility](https://github.com/0xRowdy/true-count/issues/37), read together with the [feasibility report](backend-workload-feasibility.md) and the [provider pricing note](backend-workload-provider-pricing.md). Measured 2026-09-14 on a developer workstation with a rootless local PostgreSQL 18.6 server. Everything here is a **local** measurement of a throwaway representative implementation: it is not Supabase capacity, Realtime delivery, authenticated API behaviour, mobile synchronization, nationwide latency, webhook delivery or store verification. Harness, schema, commands and raw results: [`experiments/backend-workload-feasibility/`](../../experiments/backend-workload-feasibility/) (`results.json` is the committed run; `fsync.txt` is the disk sync record).

Labels: **measured** (this run), **modelled** (arithmetic over measured counts), **assumed** (documented provider or PostgreSQL behaviour not exercised here).

## Environment

| Item | Value |
| --- | --- |
| Host | Omarchy (Arch-based) Linux 7.2.3-arch1-3, x86_64, glibc 2.44; Intel Core i7-7700K (4 cores / 8 threads, 4.2 GHz); 31 GiB RAM |
| Storage for the data directory | `/data`, XFS on an LVM VDO pool (host-side compression and deduplication) over a Samsung 860 EVO 1 TB SATA SSD. `/tmp` is tmpfs and was used only for binaries, the venv and the Unix socket, never for data. `pg_test_fsync -s 2`: fdatasync 446 ops/s (2.24 ms/op), open_datasync 436 ops/s, fsync 189 ops/s. |
| PostgreSQL | 18.6 ("PostgreSQL 18.6 on x86_64-pc-linux-gnu, compiled by gcc (Debian 12.2.0-14+deb12u1) 12.2.0, 64-bit"). No server binaries exist on the host (only the `psql` 18.6 client); no Docker daemon; no sudo used. |
| How the server was obtained | Route (a) from the ticket: portable release `postgresql-18.6.0-x86_64-unknown-linux-gnu.tar.gz` from [theseus-rs/postgresql-binaries](https://github.com/theseus-rs/postgresql-binaries/releases/tag/18.6.0), SHA-256 `bb3d09f876b2383e25a8c9ce09e32d185a03656a23d074f5195542b1b1b3ca61` verified against the published `.sha256`. The `musl` variant fails to execute here because `/lib/ld-musl-x86_64.so.1` is absent. The `gnu` build fails to load because it links `libxml2.so.2` while the host ships libxml2 2.15.4 as `.so.16`; resolved without installing anything by extracting `libxml2.so.2.13.8` from the archived Arch package `libxml2-2.13.8-1` and `libicu{uc,data,i18n}.so.76` from `icu-76.1-1` into a private directory on `LD_LIBRARY_PATH`. Route (b) was probed and not needed: `pip download pgserver` finds no wheel for Python 3.14 ("No matching distribution found"). Route (c) (PGlite) was not used. |
| Cluster | `initdb -U tc --auth=trust --encoding=UTF8 --locale=C` (PostgreSQL 18 default data checksums on). Overrides: `port = 54329`, `listen_addresses = '127.0.0.1'`, `unix_socket_directories = '/tmp/tc-pg'`, `max_connections = 250`, `log_lock_waits = on`, `track_io_timing = on`. Everything else default: `shared_buffers = 128MB`, `work_mem = 4MB`, `fsync = on`, `synchronous_commit = on`, `wal_level = replica`, `default_toast_compression = pglz`, `wal_compression = off`, `checkpoint_timeout = 5min`, `max_wal_size = 1GB`, `autovacuum = on`. |
| Client | Python 3.14.7 venv; psycopg 3.3.5 (binary wheel, libpq 18.0.6); psutil 7.2.2; `requirements.txt` pinned. |
| Commands | `experiments/backend-workload-feasibility/run.sh` (download and verify, shim libraries, `initdb`, `pg_ctl start`, venv, `pg_test_fsync`, `harness.py --out results.json`). Committed run started 2026-09-14T22:54:33Z, 156.3 s wall clock, database `tc` recreated from `schema.sql` at start. |

Differences from Supabase Micro that matter when reading timings: Micro has 1 GB RAM and shared 2-core compute on network-attached gp3 disk (3,000 IOPS, 125 MB/s) with hard-coded 60 direct / 200 pooler connections; this host has 8 threads, 31 GiB RAM and a local SATA SSD behind a compressing block layer. Supabase's `shared_buffers` for Micro is not published on the pages checked and was not modelled.

## Synthetic operation definitions

All operations are PL/pgSQL functions in [`schema.sql`](../../experiments/backend-workload-feasibility/schema.sql), each running in one transaction, with no RLS, authentication or provider calls.

| Operation | What it does |
| --- | --- |
| `apply(account, op, hash, kind, payload, expected)` | Locks the account synchronization-head row (`FOR UPDATE`), rejects deleted accounts, returns the stored receipt for a repeated `op` (rejecting a different `hash` under the same `op`), otherwise allocates the next account sequence and commits the state change, receipt and feed row together. Kinds: `result` (insert private result + payload, total+1), `grant` (one allowance row per account/reset key; duplicates become `existing-grant`), `transfer` (device transfer requiring the expected ownership generation; else `generation-conflict`), `withdraw` (sharing period set to 0), `enable` (new sharing period requiring the expected generation; else `period-conflict`), `contribute` (public contribution accepted only under the current non-zero period; else `revoked-period`). Returns `lock_precommit_ms`, measured inside the function from lock acquisition to just before return; the client separately measures total round-trip time. |
| `take_snapshot(account, id)` | Under the head lock, writes the snapshot header (watermark = current sequence, totals) and copies every result summary into immutable `snapshot_row`s in the same transaction. Pages are then read outside the lock. |
| `stage_part(account, item, part, hash, bytes)` | Private staging of one content-hashed chunk; the server computes `sha256(bytes)` and rejects a mismatch; identical resends are idempotent (`already-staged`) and refresh `touched`. |
| `complete_chunked(account, op, hash, item, parts, bytes, part_hashes[])` | Under the head lock, receipt-checked like `apply`; verifies part count, total bytes and per-part hashes against staged rows; then in one transaction writes manifest, result summary, durable chunks (moved from staging), receipt and feed row. Incomplete staging raises and commits nothing. |
| `sweep_expired()` | Deletes staging rows untouched for 24 h, and snapshots/export jobs past their 24 h expiry. |
| `delete_account(account, op, hash)` | Phase 1 under the head lock: `deleted = true`, sharing period 0, deletion receipt and feed row. Public view `visible_contribution` excludes deleted accounts and revoked periods. |
| `cleanup_account(account)` | Phase 2: inserts a tombstone, then deletes the head row with cascades (results, chunks, receipts, feed, snapshots, exports, staging). A trigger refuses re-insertion of a tombstoned account ID. |
| Feed fetch, snapshot paging, export cursor | Plain SQL: `SELECT ... FROM feed WHERE account=$1 AND seq>$2 ORDER BY seq LIMIT 100`; `SELECT ... FROM snapshot_row WHERE snapshot=$1 AND item>$2 ORDER BY item LIMIT n`; `export_job.cursor` updated after each page. |

Payloads are representative serialized artifacts, not random bytes: JSON hand-by-hand blackjack detail (cards, dealer cards, bet, action, outcome, running/true count, deviation flag, about 90 bytes per hand) generated to at least the target size. Synthetic JSON is more repetitive than real play, so the compression ratios below are likely optimistic; the pricing note carries a no-compression sensitivity for that reason.

## Results

### Result + receipt + feed acceptance, payload sweep (measured)

Sequential `apply(kind='result')` on one connection across 50 accounts, then an 8-connection concurrent run across distinct accounts.

| | 10 KB | 100 KB | 1 MB |
| --- | ---: | ---: | ---: |
| Operations | 2,000 | 500 | 100 |
| Serialized bytes | 10,022 | 100,002 | 1,000,356 |
| gzip -6 bytes (ratio) | 1,850 (5.42) | 15,841 (6.31) | 151,272 (6.61) |
| Round-trip latency ms: mean / p50 / p95 / p99 / max | 4.81 / 4.39 / 7.55 / 11.09 / 22.7 | 11.83 / 11.49 / 16.83 / 18.75 / 22.3 | 70.0 / 68.0 / 94.8 / 101.9 / 106.3 |
| Head-lock-to-return ms: mean / p50 / p95 / p99 / max | 0.54 / 0.38 / 1.16 / 2.65 / 6.13 | 5.07 / 5.29 / 8.92 / 10.87 / 11.57 | 54.3 / 51.2 / 76.3 / 81.3 / 85.1 |
| Sequential throughput (one connection) | 207.8 ops/s | 84.5 ops/s | 14.3 ops/s |
| 8 concurrent connections | 797.5 ops/s | 278.6 ops/s | 45.6 ops/s |
| `result` growth per op: heap / index / TOAST / total bytes | 176 / 61 / 2,781 / 3,043 | 147 / 49 / 22,725 / 22,954 | 246 / 0 / 215,368 / 215,695 |
| `receipt` total bytes per op | 209 | 197 | (page-quantized; see note) |
| `feed` total bytes per op | 127 | 115 | 82 |
| Database growth per op (all relations) | 3,379 | 23,282 | 215,777 |
| WAL bytes per op | 3,600 | 24,209 | 221,389 |
| On-disk result bytes / serialized bytes | 0.30 | 0.23 | 0.22 |
| Peak PostgreSQL PSS (sum) / backends | 194 MB / 17 | 197 MB / 17 | 241 MB / 17 |

Notes. The payload is stored out of line in TOAST with pglz, which compressed the synthetic JSON about 3.3–4.6×; stored bytes are therefore far below serialized bytes, while WAL is about equal to stored bytes plus fixed overhead (`wal_compression` off). Per-op index and heap growth is quantized in 8 KB pages, so the fixed receipt/feed overhead is better read from the 2,000-op column and from the 100,000-summary account below (summary 269 + receipt 116 + feed 92 = 477 bytes per result without payload). Throughput is bound by `fdatasync` at 10 KB and by TOAST writing at 1 MB.

Assertions passed: for every size, result rows = receipt rows = feed rows = operations; every acceptance was fresh (`retry = false`).

### Repeated retries and identity–content mismatch (measured)

| Check | Result |
| --- | --- |
| 200 identical retries of one accepted result | Every reply `retry = true`, same sequence and disposition; result/receipt/feed counts unchanged; latency mean 2.87 ms, p50 2.58, p95 5.33, p99 6.28; WAL 19,248 bytes total (96 bytes per retry: the `FOR UPDATE` row lock on the head row is logged; no rows are written) |
| Same `op`, different hash | Rejected: `identity-content mismatch` |
| Retry storm: 32 threads × 50 retries of 20 accepted ops (1,600 retries, 500% of the batch) | 5.37 s, 298 retries/s; no result, receipt or feed row created |

### Allowance grant and transfer concurrency (measured)

| Check | Result |
| --- | --- |
| 16 threads request the same day's grant for one account with distinct op IDs | 1 `accepted`, 15 `existing-grant`; exactly 1 allowance row |
| 16 threads redeliver the same grant op simultaneously | 1 fresh acceptance, 15 `retry = true` with the same sequence; 1 receipt |
| 200 accounts × 2 devices race a transfer with the same expected generation (32 threads) | Every account: exactly one `accepted` and one `generation-conflict`; generation advanced once on all 200; 0.89 s for 400 ops (448 ops/s); lock-to-return mean 7.5 ms, p50 4.35, p95 22.1, p99 25.4, max 31.7 under contention |
| 100 accounts × 2 devices request the daily grant concurrently | 100 accepted, 100 allowance rows |

### Sharing withdrawal versus contribution race (measured)

Eight contribution threads and one withdrawal thread released together by a barrier on one account with sharing period 1.

| Check | Committed run | Other runs of the same code |
| --- | --- | --- |
| Interleaving | 6 contributions accepted before the withdrawal, 2 arrived after it and were `revoked-period` | 2/6 and 8/0 in two earlier runs |
| Public visibility afterwards (`visible_contribution`) | 0 rows in every run; the 6 accepted rows remain stored privately and are covered by the withdrawal | 0 rows |
| Re-enable with expected generation 0 | Accepted; new period 11; a stale enable with the old expectation returns `period-conflict` | same |
| Retry of the old withdrawal op after re-enable | Returns the stored receipt (`retry = true`); period stays 11 | same |
| Contribution under period 11 / under old period 1 | `accepted` / `revoked-period`; exactly 1 visible row | same |

### Histories: 1-year, 5-year and one 100,000-summary account (measured)

| Account | Seeding path | Time | Growth |
| --- | --- | --- | --- |
| 1-year (240 results × 10 KB) | `apply()` | 1.22 s; mean 5.07 ms/op | with the 5-year account: `result` 4,292,608 B (TOAST 3,997,696), `receipt` 253,952, `feed` 122,880; database +4,669,440 B = 3,243 B per result |
| 5-year (1,200 results × 10 KB) | `apply()` | 6.16 s; mean 5.13 ms/op, p99 10.8, max 22.9 | (included above) |
| Heavy (100,000 summaries, no payload) | bulk `INSERT ... generate_series` (seeding only, not the acceptance path) | 30.2 s | `result` 26,886,144 B (heap 22.1 MB, index 4.7 MB) = 269 B/summary; `receipt` 11,567,104 = 116 B; `feed` 9,175,040 = 92 B; database +47,628,288 B = 476 B/summary |

### Coherent snapshot creation and bootstrap paging (measured; lock reported separately from total)

| Account | Rows | Lock-to-return (head lock held) | Create total (client) | Paging: page size / calls / time | Serialized bytes / gzip -6 |
| --- | ---: | ---: | ---: | --- | --- |
| 1-year | 240 | 6.5 ms | 15.4 ms | 500 / 2 / 0.96 ms | 21,140 / 705 |
| 5-year | 1,200 | 34.1 ms | 44.6 ms | 500 / 4 / 14.1 ms | 106,980 / 3,354 |
| Heavy 100,000 | 100,000 | 3,911.8 ms | 3,922.0 ms | 1,000 / 101 / 1,332.5 ms | 14,173,272 / 1,118,370 |

Concurrent writers during a second heavy snapshot: lock held 3,245.8 ms, total 3,262.6 ms; a writer on the same account was blocked 3,217.6 ms and then committed sequence 100,001 above watermark 100,000 (serialized, no torn snapshot); a writer on a different account completed in 105.9 ms (not lock-blocked, but slowed by the concurrent I/O; its uncontended latency is about 5 ms). Two devices creating snapshots of the 5-year account concurrently both produced row counts equal to their own watermark totals. Rows = totals = watermark held for every snapshot.

Measured limit: a bootstrap snapshot of a 100,000-summary account holds that account's head lock for 1.0–3.9 s locally (see variance below), blocking that account's own acceptances for the duration; other accounts are unaffected. Fifty concurrent bootstraps of 20-summary accounts held their locks for 0.5–13 ms each (p95 8.2 ms through a 15-connection pool; p95 31.9 ms, max 56 ms through a 60-connection pool, where more concurrent transactions contend for I/O).

### Resumable export and bootstrap (measured)

| Case | Rows | Page size | Calls (pages + cursor reads) | Interrupted after | Total time | Assertion |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| 5-year export | 1,200 | 200 | 14 | 600 rows (connection closed) | 0.054 s | resumed from stored cursor on a new connection; no gaps, no duplicates |
| Heavy export | 100,000 | 1,000 | 202 | 25,000 rows | 1.30 s | same |
| Initial 90-day detail, 5-year account | 60 results | 60 | 1 | | 5.2 ms | 600,600 B serialized; gzip 6,799 B (synthetic repetition; not representative) |
| Download all history, 5-year account | 1,200 results | 50 | 25 | | 101 ms | 12,012,000 B serialized |

### Staged upload, chunk completion, aborted staging, expiry, harness maximum (measured)

| Case | Result |
| --- | --- |
| 10 MB result (10,094,030 B) in 11 × 1 MB content-hashed parts | `stage_part` mean 61.0 ms, p50 64.3, p95 86.0, max 96.1; upload 671 ms total; `complete_chunked` 128.7 ms total, 13.2 ms under the head lock; `result_chunk` +2,195,456 B (TOAST 2,154,496; 0.22 of serialized); WAL 4,498,136 B; database +4,415,488 B (includes staging pages not yet vacuumed); gzip -6 1,506,260 B (6.7×). Exactly one result, receipt and feed row; 11 durable chunks; 0 staging rows. Completion retry returns the receipt and creates nothing. |
| Aborted staging: 4 of 11 parts, then completion | Rejected: `incomplete staging: 4 of 11 parts, 4000000 of 10094030 bytes`; no result or receipt; the 4 parts remain staged |
| Tampered bytes under an existing part identity and claimed hash | Rejected: `chunk hash mismatch` (see assertion record: the first harness version accepted this) |
| Identical resend of a staged part | `already-staged` (idempotent) |
| Staging backdated 25 h, then `sweep_expired()` | 4 rows removed in 4.6 ms; 0 staging rows |
| Full resend after expiry, then completion | Exactly one additional result (2 total, 22 chunks); upload 845.5 ms |
| Harness maximum: 103,863,312 B in 104 × 1 MB parts | `stage_part` mean 72.6 ms, p95 96.3, max 255.2; upload 7.55 s; completion 1,266.6 ms total, 589.5 ms under the head lock; database +43,917,312 B; WAL 45,835,912 B. Accepted atomically (3 results, 126 chunks, 0 staging rows). Not tested beyond 100 MB. Documented PostgreSQL limit (assumed, not exercised): 1 GB per `bytea` value, so per-chunk size is the binding field limit and the manifest is the practical one. |

### Deletion cleanup (measured)

| Account | Phase 1 (deny + suppress) | Phase 2 cleanup: total / under lock | Rows removed | Other-account writer during cleanup | Database bytes before → after cleanup → after `VACUUM` | WAL |
| --- | --- | --- | --- | ---: | --- | ---: |
| 5-year (+3 snapshots) | 289.5 ms total, 0.44 ms under lock (the remainder is an I/O stall on the client round trip, not lock time) | 103.7 / 91.7 ms | 1,200 results, 1,201 feed, 3,600 snapshot rows | 40.9 ms | 237,680,319 → 237,696,703 → 234,477,247 (vacuum 1.29 s) | 582,456 |
| Heavy 100,000 (+2 snapshots) | 3.4 ms, 0.33 ms under lock | 4,215.4 / 4,173.6 ms | 100,001 results, 100,002 feed, 200,000 snapshot rows | 16.3 ms | 234,477,247 → 234,477,247 → 158,908,943 (vacuum 0.70 s) | 28,167,912 |
| Chunked (3 results, 126 chunks, about 124 MB serialized) | 2.9 ms, 0.32 ms under lock | 60.1 / 30.4 ms | 3 results, 4 feed, 126 chunks | 32.8 ms | 158,908,943 → 159,069,887 → 133,142,207 (vacuum 0.21 s) | 770,088 |

After phase 1, `apply()` on the account raised `account unavailable`, the public view returned 0 rows, and a repeated deletion op returned its receipt. After cleanup, every per-account count was 0 and `INSERT INTO account_head` for the same ID was refused (`account id ... is tombstoned`). Cleanup does not reduce database size until `VACUUM` truncates trailing pages, and it never reduces provisioned disk on a managed provider (interpretation rule 4).

### Connected-client equivalents through a bounded pool (measured)

500 accounts were seeded with 20 results each through `apply()` on 8 connections (10,000 ops in 11.05 s, 905 ops/s). Each client thread then ran a reconnect sequence: head reconcile read, feed page after cursor, and (first device only) one 10 KB result upload; every step borrows a connection from a bounded pool. "Client connections" are threads, not database connections; the pool size is the number of real database connections.

| Clients × devices | Pool | Burst time | DB calls | Client latency incl. queue ms: p50 / p95 / p99 / max | Pool wait ms: p50 / p95 | Peak PostgreSQL PSS / backends |
| --- | ---: | ---: | ---: | --- | --- | --- |
| 100 × 1 | 15 | 0.141 s | 300 | 30.9 / 67.6 / 77.2 / 81.8 | 16.9 / 56.2 | 187 MB / 9 |
| 100 × 2 | 15 | 0.183 s | 500 | 17.6 / 49.5 / 85.0 / 89.0 | 3.5 / 42.2 | 225 MB / 24 |
| 100 × 1 | 60 | 0.188 s | 300 | 27.1 / 91.8 / 94.4 / 100.3 | 0.008 / 0.011 | 187 MB / 66 |
| 100 × 2 | 60 | 0.145 s | 500 | 11.9 / 37.4 / 43.1 / 49.2 | 0.007 / 0.009 | 187 MB / 9 |
| 500 × 1 | 15 | 0.545 s | 1,500 | 59.5 / 234.1 / 296.6 / 341.3 | 47.6 / 224.2 | 225 MB / 24 |
| 500 × 2 | 15 | 0.586 s | 2,500 | 43.9 / 206.9 / 279.5 / 382.2 | 36.2 / 197.8 | 226 MB / 24 |
| 500 × 1 | 60 | 0.388 s | 1,500 | 33.2 / 59.0 / 73.8 / 93.1 | 0.008 / 20.5 | 228 MB / 69 (RSS sum 1.41 GB) |
| 500 × 2 | 60 | 0.582 s | 2,500 | 27.6 / 81.9 / 116.6 / 142.2 | 0.007 / 29.8 | 187 MB / 69 |

Steady-state reconcile: 2,500 empty feed fetches (500 accounts × 5 rounds, 64 threads, 15-connection pool) in 0.575 s, 4,351 calls/s locally; p50 3.05 ms, p95 89.4 ms including queueing. The growth scenario's 60-second cadence needs 8.3 calls/s for 500 connected players (16.7 with two devices).

Download burst, 10% of accounts (50) bootstrapping concurrently (snapshot + first page + 90-day detail): 15-connection pool 0.173 s, 150 calls, 14,136,700 B serialized total (283 KB per account), client p50 37.4 ms, p95 62.7 ms; 60-connection pool 0.195 s, p50 48.9 ms, p95 85.4 ms.

Message fan-out (modelled from measured rows): 12,400 feed rows were created for the 500 accounts during this scenario; with one change hint per connected device that is 12,400 hints at one device and 24,800 at two. Realtime delivery itself was not measured.

Expiry sweep of the 100 bootstrap snapshots after backdating: 17.7 ms.

Memory: peak PostgreSQL process-tree PSS across the whole run was 241 MB (1 MB acceptance, 17 backends); with 69 backends PSS was 187–228 MB while the summed RSS reached 1.41 GB because each backend's RSS counts the 128 MB shared buffers it touched. PSS is the honest figure for "memory the server needs"; RSS sum is what a naive per-process monitor reports. Neither is Micro's behaviour: Micro's `shared_buffers` and its behaviour at 60 direct connections were not measured. Harness peak RSS 104 MB.

Totals for the run: 354 MB of WAL generated; database 147 MB at the end (after the three cleanups and vacuums); data directory 557 MB on disk including retained WAL segments (`max_wal_size = 1GB`).

### Run-to-run variance (measured)

The committed run was slower than an earlier run of the same harness (identical except for two assertion-arithmetic fixes) on the same host and data disk. Row counts, ratios and every disposition were identical; latencies were not.

| Metric | Earlier run (69.9 s total) | Committed run (156.3 s total) |
| --- | ---: | ---: |
| 10 KB acceptance p50 | 3.70 ms | 4.39 ms |
| 1 MB acceptance p50 | 25.0 ms | 68.0 ms |
| Heavy snapshot lock | 1,041 ms | 3,912 ms |
| Heavy cleanup under lock | 1,433 ms | 4,174 ms |
| 100 MB completion under lock | 228 ms | 589 ms |
| 500 × 2 clients, 60-pool, p50 | 564 ms (70 backends) | 27.6 ms (69 backends) |

The cause was not isolated. The data disk sits behind a compressing/deduplicating LVM VDO layer and the previous 500 MB database had just been dropped before the committed run; both runs are reported so that no single local latency is mistaken for a stable figure. Ratios (bytes per result, gzip, WAL per op) are stable across runs and are the inputs the pricing model uses.

## Assertion record

Committed run: 39 assertions passed, 0 failed (`results.json` → `assertions`). Issues found and fixed during the session, recorded because the ticket asks for failures explicitly:

1. **Server trusted the client's chunk hash (real defect, caught by the harness).** The first `stage_part` compared the client-supplied hash against the stored hash but never hashed the bytes, so tampered bytes under a truthful-looking hash were accepted (`FAIL tampered chunk bytes under same part identity rejected`). Fixed by computing `sha256(bytes)` server-side and rejecting mismatches; the assertion now passes. The production implementation must do the same and must not rely on a client hash for manifest verification.
2. **Harness arithmetic (not database behaviour).** Two chunk-count assertions hard-coded 10 and 100 parts; the payload generator produces at least the target size, so a 10.09 MB body takes 11 parts and a 103.9 MB body 104. The assertions now count actual parts. An earlier generator version under-shot the targets (8.5 KB / 86 KB / 885 KB); it was corrected before the committed run.
3. **`psycopg` binds small Python ints as `smallint`**, making `generate_series($1,$2)` ambiguous; explicit `::bigint` casts were added. No effect on results.

## Measured limits and what they mean

- Local single-connection acceptance ceiling on this disk: about 208 ops/s at 10 KB, 85 at 100 KB, 14 at 1 MB (fdatasync-bound at small sizes, TOAST-write-bound at 1 MB). The growth scenario averages 0.04 accepted sessions per second and a plausible peak of a few per second; the database path is not the constraint at any payload size, and no cloud throughput is claimed.
- Head-lock time per acceptance grows with payload: 0.4 ms at 10 KB, 5 ms at 100 KB, 51 ms at 1 MB (p50). Chunked completion holds the lock for 13 ms (10 MB) to 590 ms (100 MB) because chunks are moved under the lock; moving them before taking the lock is an implementation option that preserves the contract.
- Heavy-account snapshot creation holds that account's lock for seconds at 100,000 summaries (1.0–3.9 s locally). The consistent-watermark contract is preserved; the cost is borne only by that account. An incremental or pre-materialized summary snapshot for heavy accounts is a remaining implementation check, not a reason to weaken the watermark.
- Physical cleanup of a 100,000-summary account with two snapshots takes about 4 s under its own lock and 28 MB of WAL; other accounts continued at 16 ms. Space is reclaimed only by vacuum and never on the provider's provisioned-disk meter.
- A 15-connection pool absorbed a 1,000-client reconnect burst in 0.59 s locally with p99 queueing under 0.3 s; opening 60 connections did not make the burst faster in every case and multiplied backend memory. Bounded pooling is the right default; Micro's hard 60/200 limits stand regardless.
- Retries are cheap and safe: 96 bytes of WAL, no rows, about 2.6 ms.

## Not measured here

Supabase Micro compute, `shared_buffers`, Supavisor pooling, PostgREST or Edge Function overhead, RLS/authorization cost, Realtime connection or message delivery, mobile clients, network latency, webhook ordering, store verification, email delivery, backups, restore, and any behaviour under a 1 GB memory limit. The 10 MB and 100 MB chunked cases establish harness behaviour, not an accepted product maximum.
