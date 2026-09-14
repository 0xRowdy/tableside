#!/usr/bin/env bash
# Reproduce the local PostgreSQL workload measurements for issue #37.
# Rootless: portable PostgreSQL 18.6.0 binaries + two archived Arch libraries. No sudo, no Docker, no cloud.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK="${TC_WORK:-/tmp/tc-pg}"
export PGDATA="${PGDATA:-/data/dev/MMGJ/.tc-workload-scratch/pgdata}"   # must be on a real disk, not tmpfs
export LD_LIBRARY_PATH="$WORK/extlib"
PGBIN="$WORK/pgsql-gnu/bin"
mkdir -p "$WORK/extlib" "$(dirname "$PGDATA")"

if [ ! -x "$PGBIN/postgres" ]; then
  cd "$WORK"
  curl -sSL -o pg.tar.gz https://github.com/theseus-rs/postgresql-binaries/releases/download/18.6.0/postgresql-18.6.0-x86_64-unknown-linux-gnu.tar.gz
  curl -sSL -o pg.tar.gz.sha256 https://github.com/theseus-rs/postgresql-binaries/releases/download/18.6.0/postgresql-18.6.0-x86_64-unknown-linux-gnu.tar.gz.sha256
  sha256sum -c <(awk '{print $1"  pg.tar.gz"}' pg.tar.gz.sha256)
  mkdir -p pgsql-gnu && tar -xzf pg.tar.gz -C pgsql-gnu --strip-components=1
  # The gnu build links libxml2.so.2 (and that library links ICU 76). Hosts with libxml2 >= 2.14 / ICU 78 need these shims.
  if ldd "$PGBIN/postgres" | grep -q 'libxml2.so.2 => not found'; then
    curl -sSL -o libxml2.pkg.tar.zst https://archive.archlinux.org/packages/l/libxml2/libxml2-2.13.8-1-x86_64.pkg.tar.zst
    curl -sSL -o icu.pkg.tar.zst https://archive.archlinux.org/packages/i/icu/icu-76.1-1-x86_64.pkg.tar.zst
    mkdir -p pkgx pkgi && tar --zstd -xf libxml2.pkg.tar.zst -C pkgx && tar --zstd -xf icu.pkg.tar.zst -C pkgi
    cp -a pkgx/usr/lib/libxml2.so.2* pkgi/usr/lib/libicuuc.so.76* pkgi/usr/lib/libicudata.so.76* pkgi/usr/lib/libicui18n.so.76* extlib/
  fi
  "$PGBIN/postgres" --version
fi

if [ ! -f "$PGDATA/PG_VERSION" ]; then
  "$PGBIN/initdb" -D "$PGDATA" -U tc --auth=trust --encoding=UTF8 --locale=C >/dev/null
  cat >> "$PGDATA/postgresql.conf" <<'EOF'
# --- true-count workload harness overrides ---
port = 54329
listen_addresses = '127.0.0.1'
unix_socket_directories = '/tmp/tc-pg'
max_connections = 250
log_lock_waits = on
log_min_duration_statement = -1
track_io_timing = on
EOF
fi
"$PGBIN/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1 || "$PGBIN/pg_ctl" -D "$PGDATA" -l "$(dirname "$PGDATA")/pg.log" -w start

if [ ! -x "$WORK/venv/bin/python" ]; then
  python3 -m venv "$WORK/venv"
  "$WORK/venv/bin/pip" install --quiet -r "$HERE/requirements.txt"
fi

"$PGBIN/pg_test_fsync" -f "$(dirname "$PGDATA")/fsync.tmp" -s 2 > "$HERE/fsync.txt" 2>&1 || true
rm -f "$(dirname "$PGDATA")/fsync.tmp"
"$WORK/venv/bin/python" "$HERE/harness.py" --out "$HERE/results.json" "$@"
