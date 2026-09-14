# Backend workload feasibility harness

Throwaway local measurement harness for [issue #37](https://github.com/0xRowdy/true-count/issues/37). It exercises the representative transaction shapes in `schema.sql` against a rootless local PostgreSQL 18.6 server and writes `results.json`. Findings are written up in [`docs/research/backend-workload-measurements.md`](../../docs/research/backend-workload-measurements.md).

This is not the production backend: no Supabase project, no RLS/auth, no Realtime, no provider integration, no cloud run. Timings are local workstation timings only.

## Files

- `schema.sql` — synthetic tables and PL/pgSQL operations (`apply`, `take_snapshot`, `stage_part`, `complete_chunked`, `sweep_expired`, `delete_account`, `cleanup_account`).
- `harness.py` — scenarios, assertions and measurements (psycopg 3, psutil). Writes `results.json`.
- `run.sh` — obtains PostgreSQL without root, initialises a cluster on a real disk, creates the venv, records `pg_test_fsync` output to `fsync.txt`, runs the harness.
- `requirements.txt` — pinned Python dependencies.
- `results.json` — the committed run referenced by the research note.
- `fsync.txt` — `pg_test_fsync` output for the disk used by the committed run.

## Reproduce

Requirements: Linux x86_64, Python 3.12+ with `venv`, `curl`, `tar` with zstd support, ~2 GB free on a real (non-tmpfs) disk, network access to download the PostgreSQL tarball. No sudo.

```bash
# optional overrides (defaults shown)
export TC_WORK=/tmp/tc-pg                                   # binaries, venv, socket directory
export PGDATA=/data/dev/MMGJ/.tc-workload-scratch/pgdata    # MUST be on a real disk; /tmp is tmpfs on this host
./run.sh            # full sweep (70-160 s on the recorded hardware; see the variance note in the research report)
./run.sh --quick    # smaller sweep for smoke testing
```

`run.sh` does, in order:

1. Downloads `postgresql-18.6.0-x86_64-unknown-linux-gnu.tar.gz` from the `theseus-rs/postgresql-binaries` GitHub release and verifies its published SHA-256.
2. If the host lacks `libxml2.so.2` (Arch/Omarchy ships libxml2 2.15 as `.so.16`), extracts `libxml2.so.2` from the archived Arch package `libxml2-2.13.8-1` and `libicu{uc,data,i18n}.so.76` from `icu-76.1-1` into `$TC_WORK/extlib`, loaded via `LD_LIBRARY_PATH`. Nothing is installed system-wide.
3. `initdb` (user `tc`, trust auth on a Unix socket only, `--locale=C`, PostgreSQL 18 default data checksums on) and appends the overrides listed in the script (port 54329, `max_connections = 250`, `log_lock_waits`, `track_io_timing`). All other settings are PostgreSQL defaults (`shared_buffers = 128MB`, `fsync = on`, `synchronous_commit = on`, `default_toast_compression = pglz`).
4. Starts the server with `pg_ctl`, creates the venv, installs `requirements.txt`.
5. Runs `pg_test_fsync -s 2` against the data disk and the harness.

The harness drops and recreates database `tc` unless `--keep` is given. Stop the server afterwards with:

```bash
LD_LIBRARY_PATH=$TC_WORK/extlib $TC_WORK/pgsql-gnu/bin/pg_ctl -D $PGDATA stop
```

## What the harness does not measure

Supabase compute limits, PostgREST/Edge Function overhead, Realtime delivery, authentication, mobile clients, network latency, webhook delivery, store verification, or backups. See the research note for the full boundary list.
