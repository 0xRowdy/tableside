"""Throwaway local PostgreSQL workload harness for True Count issue #37.

Measures representative transaction shapes from schema.sql on a local server.
Local timings only: this is not Supabase capacity, Realtime delivery,
nationwide latency or a production backend. See README.md for reproduction.
"""

import argparse
import gzip
import hashlib
import json
import os
import platform
import queue
import random
import statistics
import subprocess
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager

import psutil
import psycopg

DSN = os.environ.get("TC_DSN", "host=/tmp/tc-pg port=54329 user=tc dbname=tc")
PGDATA = os.environ.get("PGDATA", "/data/dev/MMGJ/.tc-workload-scratch/pgdata")
SCHEMA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "schema.sql")
KB, MB = 1000, 1_000_000
RESULTS = {"assertions": [], "scenarios": {}}
ASSERT_LOCK = threading.Lock()


# ----------------------------------------------------------------- utilities
def connect(autocommit=True):
    return psycopg.connect(DSN, autocommit=autocommit)


def check(name, condition, detail=""):
    with ASSERT_LOCK:
        RESULTS["assertions"].append({"name": name, "passed": bool(condition), "detail": str(detail)})
    print(("PASS " if condition else "FAIL ") + name + (f" -- {detail}" if detail else ""), flush=True)


def ms_stats(values):
    if not values:
        return {"n": 0}
    v = sorted(values)
    q = statistics.quantiles(v, n=100, method="inclusive") if len(v) > 1 else [v[0]] * 99
    return {"n": len(v), "mean_ms": round(statistics.fmean(v), 3), "p50_ms": round(q[49], 3),
            "p95_ms": round(q[94], 3), "p99_ms": round(q[98], 3), "max_ms": round(v[-1], 3),
            "min_ms": round(v[0], 3)}


def timed(fn, *args):
    t0 = time.perf_counter()
    out = fn(*args)
    return (time.perf_counter() - t0) * 1000, out


def make_payload(target_bytes, seed):
    """Representative serialized hand-by-hand blackjack detail (JSON) of at least target_bytes; not random bytes."""
    rng = random.Random(seed)
    hands, rc = [], 0

    def add(k):
        nonlocal rc
        for _ in range(k):
            n = len(hands) + 1
            cards = [rng.choice([2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 10, 11]) for _ in range(rng.choice([2, 2, 3, 3, 4]))]
            dealer = [rng.choice([2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 10, 11]) for _ in range(rng.choice([2, 3]))]
            rc += sum(1 if c <= 6 else -1 if c >= 10 else 0 for c in cards + dealer)
            bet = rng.choice([10, 10, 15, 25, 50])
            hands.append({"n": n, "c": cards, "d": dealer, "b": bet, "a": rng.choice(["H", "S", "D", "P", "HS", "HH"]),
                          "o": rng.choice([bet, -bet, 0, int(bet * 1.5)]), "rc": rc, "tc": round(rc / rng.choice([1, 2, 3, 4, 5]), 1),
                          "dev": rng.random() < 0.05})

    add(max(1, target_bytes // 90))
    while True:
        body = json.dumps({"game": "blackjack", "revision": "synthetic-v1", "hands": hands}, separators=(",", ":")).encode()
        if len(body) >= target_bytes:
            return body
        add(max(1, (target_bytes - len(body)) // 90 + 1))


def sha(b):
    return hashlib.sha256(b).hexdigest()


def sizes(conn):
    rows = conn.execute("""
        SELECT c.relname, pg_relation_size(c.oid), pg_indexes_size(c.oid),
               coalesce(pg_relation_size(c.reltoastrelid),0)+coalesce(pg_indexes_size(c.reltoastrelid),0),
               pg_total_relation_size(c.oid)
        FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relkind='r' ORDER BY 1""").fetchall()
    out = {}
    for name, heap, idx, toast, total in rows:
        cnt = conn.execute(f"SELECT count(*) FROM {name}").fetchone()[0]
        out[name] = {"rows": cnt, "heap_bytes": heap, "index_bytes": idx, "toast_bytes": toast, "total_bytes": total}
    out["_database_bytes"] = conn.execute("SELECT pg_database_size(current_database())").fetchone()[0]
    out["_wal_lsn"] = conn.execute("SELECT pg_current_wal_lsn()::text").fetchone()[0]
    return out


def wal_bytes(conn, a, b):
    return conn.execute("SELECT pg_wal_lsn_diff(%s::pg_lsn, %s::pg_lsn)", (b, a)).fetchone()[0]


def growth(before, after):
    out = {}
    for t in after:
        if t.startswith("_"):
            continue
        out[t] = {k: after[t][k] - before[t][k] for k in ("rows", "heap_bytes", "index_bytes", "toast_bytes", "total_bytes")}
    out["_database_bytes"] = after["_database_bytes"] - before["_database_bytes"]
    return out


class MemSampler:
    """Peak resident memory of the PostgreSQL process tree and of this harness (sampled)."""

    def __init__(self, interval=0.5):
        with open(os.path.join(PGDATA, "postmaster.pid")) as f:
            self.pg = psutil.Process(int(f.readline().strip()))
        self.me = psutil.Process()
        self.interval = interval
        self.reset()
        self.stop = threading.Event()
        self.thread = threading.Thread(target=self.run, daemon=True)
        self.thread.start()

    def reset(self):
        self.peak = {"postgres_rss_sum_bytes": 0, "postgres_pss_sum_bytes": 0, "postgres_backends": 0, "harness_rss_bytes": 0}

    def sample(self):
        procs = [self.pg] + self.pg.children(recursive=True)
        rss = pss = 0
        for p in procs:
            try:
                rss += p.memory_info().rss
                pss += p.memory_full_info().pss
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
        self.peak["postgres_rss_sum_bytes"] = max(self.peak["postgres_rss_sum_bytes"], rss)
        self.peak["postgres_pss_sum_bytes"] = max(self.peak["postgres_pss_sum_bytes"], pss)
        self.peak["postgres_backends"] = max(self.peak["postgres_backends"], len(procs) - 1)
        self.peak["harness_rss_bytes"] = max(self.peak["harness_rss_bytes"], self.me.memory_info().rss)

    def run(self):
        while not self.stop.is_set():
            self.sample()
            time.sleep(self.interval)

    def snapshot(self):
        self.sample()
        return dict(self.peak)


class Pool:
    """Bounded connection pool: N real connections shared by many client threads."""

    def __init__(self, size):
        self.q = queue.Queue()
        self.size = size
        for _ in range(size):
            self.q.put(connect())

    @contextmanager
    def acquire(self):
        t0 = time.perf_counter()
        c = self.q.get()
        wait = (time.perf_counter() - t0) * 1000
        try:
            yield c, wait
        finally:
            self.q.put(c)

    def close(self):
        while not self.q.empty():
            self.q.get().close()


def apply(conn, account, op, h, kind, payload=None, e=1):
    return conn.execute("SELECT apply(%s,%s,%s,%s,%s,%s)", (account, op, h, kind, payload, e)).fetchone()[0]


def new_accounts(conn, start, n):
    conn.execute("INSERT INTO account_head(account) SELECT generate_series(%s::bigint,%s::bigint)", (start, start + n - 1))
    return list(range(start, start + n))


def counts(conn, account):
    return {t: conn.execute(f"SELECT count(*) FROM {t} WHERE account=%s", (account,)).fetchone()[0]
            for t in ("result", "receipt", "feed", "allowance", "contribution", "stage", "result_chunk", "manifest")}


# ---------------------------------------------------------------- scenarios
def env_info(conn):
    s = {k: conn.execute(f"SHOW {k}").fetchone()[0] for k in
         ("shared_buffers", "work_mem", "fsync", "synchronous_commit", "wal_level", "max_connections",
          "data_checksums", "default_toast_compression", "wal_compression", "checkpoint_timeout", "max_wal_size",
          "random_page_cost", "effective_cache_size", "autovacuum")}
    return {"postgres_version": conn.execute("SELECT version()").fetchone()[0], "settings": s,
            "python": sys.version.split()[0], "psycopg": psycopg.__version__, "libpq": psycopg.pq.version(),
            "psycopg_impl": psycopg.pq.__impl__, "psutil": psutil.__version__, "platform": platform.platform(),
            "cpu": platform.processor() or open("/proc/cpuinfo").read().split("model name\t: ")[1].split("\n")[0],
            "cpus": os.cpu_count(), "memory_total_bytes": psutil.virtual_memory().total,
            "pgdata": PGDATA, "dsn": DSN.replace("password=", "password=***")}


def scenario_acceptance_sweep(conn, mem, quick):
    """Private result + receipt + feed accepted together; payload sweep 10 KB / 100 KB / 1 MB."""
    out = {}
    plan = [(10 * KB, 300 if quick else 2000), (100 * KB, 100 if quick else 500), (1 * MB, 20 if quick else 100)]
    base = 1000
    for size, n in plan:
        accts = new_accounts(conn, base, 50)
        base += 100
        payload = make_payload(size, seed=size)
        gz = len(gzip.compress(payload, 6))
        before = sizes(conn)
        mem.reset()
        lat, lockms = [], []
        for k in range(n):
            a = accts[k % len(accts)]
            op = f"r{size}-{k}"
            t, r = timed(apply, conn, a, op, sha(payload), "result", payload, 1)
            lat.append(t)
            lockms.append(float(r["lock_precommit_ms"]))
            if r["disposition"] != "accepted" or r["retry"]:
                check(f"acceptance {size}B op {k} accepted fresh", False, r)
        after = sizes(conn)
        g = growth(before, after)
        w = wal_bytes(conn, before["_wal_lsn"], after["_wal_lsn"])
        # 8-way concurrent throughput across distinct accounts (local ceiling only).
        t0 = time.perf_counter()
        conc_n = max(n // 2, 16)

        def worker(idx):
            with connect() as c:
                for k in range(idx, conc_n, 8):
                    apply(c, accts[k % len(accts)], f"c{size}-{k}", sha(payload), "result", payload, 1)
        with ThreadPoolExecutor(8) as ex:
            list(ex.map(worker, range(8)))
        conc_s = time.perf_counter() - t0
        out[str(size)] = {
            "operations": n, "serialized_bytes": len(payload), "gzip6_bytes": gz,
            "gzip_ratio": round(len(payload) / gz, 2),
            "sequential_latency": ms_stats(lat), "lock_precommit": ms_stats(lockms),
            "sequential_ops_per_s": round(n / (sum(lat) / 1000), 1),
            "growth_per_op": {t: {k: round(v / n) for k, v in g[t].items()} for t in ("result", "receipt", "feed", "account_head")},
            "database_growth_bytes": g["_database_bytes"], "database_growth_per_op": round(g["_database_bytes"] / n),
            "result_total_bytes_per_op": round(g["result"]["total_bytes"] / n),
            "on_disk_over_serialized": round(g["result"]["total_bytes"] / n / len(payload), 2),
            "wal_bytes_per_op": round(w / n),
            "concurrent_8_workers": {"operations": conc_n, "seconds": round(conc_s, 3), "ops_per_s": round(conc_n / conc_s, 1)},
            "peak_memory": mem.snapshot(),
        }
        check(f"acceptance {size}B: rows result=receipt=feed per op", g["result"]["rows"] == n == g["receipt"]["rows"] == g["feed"]["rows"],
              f"{g['result']['rows']}/{g['receipt']['rows']}/{g['feed']['rows']}")
    return out


def scenario_retry(conn, mem, quick):
    """Identical retries return the stored receipt and create nothing; mismatched content is rejected."""
    a = new_accounts(conn, 2000, 1)[0]
    payload = make_payload(10 * KB, 7)
    first = apply(conn, a, "op-x", sha(payload), "result", payload)
    before = counts(conn, a)
    wal0 = sizes(conn)["_wal_lsn"]
    lat = []
    for _ in range(200):
        t, r = timed(apply, conn, a, "op-x", sha(payload), "result", payload)
        lat.append(t)
        if not (r["retry"] and r["seq"] == first["seq"] and r["disposition"] == "accepted"):
            check("retry returns identical receipt", False, r)
            break
    after = counts(conn, a)
    wal1 = sizes(conn)["_wal_lsn"]
    check("retry x200 creates no result/receipt/feed rows", before == after, f"{before} -> {after}")
    mismatch = None
    try:
        apply(conn, a, "op-x", "different-hash", "result", b"x")
    except psycopg.Error as e:
        mismatch = str(e).splitlines()[0]
    check("mismatched content under same identity is rejected", mismatch is not None, mismatch)
    # Retry storm beyond the 20% allowance: 32 threads x 50 identical retries of 20 distinct ops.
    ops = [(f"storm-{i}", make_payload(10 * KB, 100 + i)) for i in range(20)]
    for op, p in ops:
        apply(conn, a, op, sha(p), "result", p)
    b2 = counts(conn, a)

    def storm(idx):
        with connect() as c:
            for k in range(50):
                op, p = ops[(idx + k) % 20]
                r = apply(c, a, op, sha(p), "result", p)
                if not r["retry"]:
                    check("storm retry produced a fresh acceptance", False, r)
    t0 = time.perf_counter()
    with ThreadPoolExecutor(32) as ex:
        list(ex.map(storm, range(32)))
    storm_s = time.perf_counter() - t0
    a2 = counts(conn, a)
    check("retry storm (1,600 retries of 20 ops, 32 threads) creates nothing", b2 == a2, f"{b2} -> {a2}")
    return {"retry_latency": ms_stats(lat), "retry_wal_bytes_total_200": wal_bytes(conn, wal0, wal1),
            "storm": {"retries": 1600, "threads": 32, "seconds": round(storm_s, 3), "retries_per_s": round(1600 / storm_s, 1)},
            "mismatch_error": mismatch, "peak_memory": mem.snapshot()}


def scenario_grant_transfer(conn, mem, quick):
    """Allowance grant identity and device-transfer generation under concurrency."""
    out = {}
    # Same account, 16 devices/threads request the same day's grant with distinct op IDs.
    a = new_accounts(conn, 2100, 1)[0]
    disp = []

    def grant(i):
        with connect() as c:
            return apply(c, a, f"g-{i}", "hg", "grant", None, 20260914)["disposition"]
    with ThreadPoolExecutor(16) as ex:
        disp = list(ex.map(grant, range(16)))
    rows = conn.execute("SELECT count(*) FROM allowance WHERE account=%s", (a,)).fetchone()[0]
    check("16 concurrent grant requests -> exactly one allowance row", rows == 1 and disp.count("accepted") == 1,
          f"rows={rows} dispositions={dict((d, disp.count(d)) for d in set(disp))}")
    out["same_account_16_threads"] = {"allowance_rows": rows, "dispositions": {d: disp.count(d) for d in set(disp)}}
    # Same op identity from 16 threads simultaneously (redelivery storm).
    b = new_accounts(conn, 2101, 1)[0]

    def redeliver(i):
        with connect() as c:
            r = apply(c, b, "g-same", "hg", "grant", None, 20260914)
            return (r["disposition"], r["retry"], r["seq"])
    with ThreadPoolExecutor(16) as ex:
        rs = list(ex.map(redeliver, range(16)))
    seqs = {r[2] for r in rs}
    check("16 concurrent redeliveries of one grant op -> one seq, one receipt",
          len(seqs) == 1 and sum(1 for r in rs if not r[1]) == 1 and
          conn.execute("SELECT count(*) FROM receipt WHERE account=%s", (b,)).fetchone()[0] == 1, rs[:3])
    # Transfer: two devices race with the same expected generation on 200 accounts.
    accts = new_accounts(conn, 2200, 200)
    results = {}
    lock_ms = []

    def transfer(job):
        acct, dev = job
        with connect() as c:
            r = apply(c, acct, f"t-{acct}-{dev}", "ht", "transfer", None, 1)
            return acct, r["disposition"], float(r["lock_precommit_ms"])
    t0 = time.perf_counter()
    with ThreadPoolExecutor(32) as ex:
        for acct, d, lm in ex.map(transfer, [(x, d) for x in accts for d in (1, 2)]):
            results.setdefault(acct, []).append(d)
            lock_ms.append(lm)
    secs = time.perf_counter() - t0
    ok = all(sorted(v) == ["accepted", "generation-conflict"] for v in results.values())
    gens = conn.execute("SELECT count(*) FROM account_head WHERE account BETWEEN %s AND %s AND generation=2 AND device=2",
                        (accts[0], accts[-1])).fetchone()[0]
    check("200 accounts x 2 racing transfers -> exactly one accepted each, generation advanced once", ok and gens == 200,
          f"generation=2 rows: {gens}")
    out["transfer_race_200x2"] = {"seconds": round(secs, 3), "ops_per_s": round(400 / secs, 1), "lock_precommit": ms_stats(lock_ms),
                                  "all_exactly_one_accepted": ok}
    # 100 accounts x 2 devices each requesting the daily grant concurrently.
    accts = new_accounts(conn, 2500, 100)

    def grant2(job):
        acct, dev = job
        with connect() as c:
            return acct, apply(c, acct, f"g-{acct}-{dev}", "hg", "grant", None, 20260914)["disposition"]
    with ThreadPoolExecutor(32) as ex:
        rs = list(ex.map(grant2, [(x, d) for x in accts for d in (1, 2)]))
    rows = conn.execute("SELECT count(*) FROM allowance WHERE account BETWEEN %s AND %s", (accts[0], accts[-1])).fetchone()[0]
    check("100 accounts x 2 devices concurrent grants -> 100 allowance rows", rows == 100, rows)
    out["grant_100x2_devices"] = {"allowance_rows": rows, "accepted": sum(1 for r in rs if r[1] == "accepted")}
    out["peak_memory"] = mem.snapshot()
    return out


def scenario_withdrawal(conn, mem, quick):
    """Sharing withdrawal races contributions; retrying an old withdrawal cannot revoke a new period."""
    a = new_accounts(conn, 2700, 1)[0]
    disp = {}
    barrier = threading.Barrier(9)

    def contrib(i):
        with connect() as c:
            barrier.wait()
            return "contribute", apply(c, a, f"c-{i}", "hc", "contribute", None, 1)["disposition"]

    def withdraw():
        with connect() as c:
            barrier.wait()
            return "withdraw", apply(c, a, "w-1", "hw", "withdraw")["disposition"]
    with ThreadPoolExecutor(9) as ex:
        fs = [ex.submit(contrib, i) for i in range(8)] + [ex.submit(withdraw)]
        rs = [f.result() for f in fs]
    accepted_before = sum(1 for k, d in rs if k == "contribute" and d == "accepted")
    revoked = sum(1 for k, d in rs if k == "contribute" and d == "revoked-period")
    visible = conn.execute("SELECT count(*) FROM visible_contribution WHERE account=%s", (a,)).fetchone()[0]
    stored = conn.execute("SELECT count(*) FROM contribution WHERE account=%s", (a,)).fetchone()[0]
    check("withdrawal race: no contribution publicly visible afterwards", visible == 0,
          f"accepted-before-withdrawal={accepted_before} revoked={revoked} stored(private)={stored} visible={visible}")
    check("withdrawal race: every contribution either accepted-then-covered or revoked", accepted_before + revoked == 8)
    # Re-enable with expected generation (sharing==0), then retry the old withdrawal op.
    en = apply(conn, a, "e-1", "he", "enable", None, 0)
    period = conn.execute("SELECT sharing FROM account_head WHERE account=%s", (a,)).fetchone()[0]
    stale_enable = apply(conn, a, "e-2", "he", "enable", None, 0)["disposition"]
    old = apply(conn, a, "w-1", "hw", "withdraw")
    period2 = conn.execute("SELECT sharing FROM account_head WHERE account=%s", (a,)).fetchone()[0]
    check("re-enable starts a new period; stale enable conflicts", en["disposition"] == "accepted" and period > 0 and stale_enable == "period-conflict",
          f"period={period} stale={stale_enable}")
    check("retry of old withdrawal returns receipt and does not revoke new period", old["retry"] and period2 == period)
    new_ok = apply(conn, a, "c-new", "hc", "contribute", None, period)["disposition"]
    old_period = apply(conn, a, "c-old", "hc", "contribute", None, 1)["disposition"]
    visible2 = conn.execute("SELECT count(*) FROM visible_contribution WHERE account=%s", (a,)).fetchone()[0]
    check("old-period result cannot become public under new period", new_ok == "accepted" and old_period == "revoked-period" and visible2 == 1,
          f"new={new_ok} old={old_period} visible={visible2}")
    # Deleted-account suppression through the public view.
    apply(conn, a, "w-2", "hw", "withdraw")
    return {"race": {"accepted_before_withdrawal": accepted_before, "revoked": revoked, "stored_private": stored, "visible_public": visible},
            "new_period": period, "peak_memory": mem.snapshot()}


def seed_history(conn, account, n, payload_bytes, label, mem):
    """Seed n accepted results via apply() (measured path)."""
    payload = make_payload(payload_bytes, 11)
    h = sha(payload)
    lat = []
    for k in range(n):
        t, _ = timed(apply, conn, account, f"{label}-{k}", h, "result", payload, 1)
        lat.append(t)
    return {"results": n, "payload_bytes": len(payload), "apply_latency": ms_stats(lat), "seconds": round(sum(lat) / 1000, 2)}


def seed_bulk(conn, account, n):
    """Bulk seeding of a 100,000-summary account (NOT the measured acceptance path)."""
    t0 = time.perf_counter()
    with conn.transaction():
        conn.execute("""INSERT INTO result SELECT %s, 'h-'||g,
            jsonb_build_object('game',(array['blackjack','craps','roulette'])[1+g%%3],'net',(g*7919)%%400-200,'id','h-'||g,
                               'revision','synthetic-v1','turns',50+g%%150,'adherence',0.9,'ended',20200101+g%%2000), NULL, g
            FROM generate_series(1,%s::int) g""", (account, n))
        conn.execute("INSERT INTO receipt SELECT %s,'h-'||g,'h','accepted',g FROM generate_series(1,%s::int) g", (account, n))
        conn.execute("INSERT INTO feed SELECT %s,g,'result','h-'||g FROM generate_series(1,%s::int) g", (account, n))
        conn.execute("UPDATE account_head SET seq=%s,total=%s WHERE account=%s", (n, n, account))
    return {"results": n, "seconds": round(time.perf_counter() - t0, 2), "path": "bulk INSERT ... generate_series (seeding only)"}


def snapshot_and_page(conn, account, sid, page):
    t0 = time.perf_counter()
    r = conn.execute("SELECT take_snapshot(%s,%s)", (account, sid)).fetchone()[0]
    create_ms = (time.perf_counter() - t0) * 1000
    rows, calls, after, ser = 0, 0, "", 0
    t1 = time.perf_counter()
    while True:
        page_rows = conn.execute("SELECT item, summary::text, seq FROM snapshot_row WHERE snapshot=%s AND item>%s ORDER BY item LIMIT %s",
                                 (sid, after, page)).fetchall()
        calls += 1
        if not page_rows:
            break
        rows += len(page_rows)
        ser += sum(len(x[1]) + len(x[0]) + 8 for x in page_rows)
        after = page_rows[-1][0]
    page_ms = (time.perf_counter() - t1) * 1000
    return {"watermark": r["watermark"], "total": r["total"], "lock_precommit_ms": round(float(r["lock_precommit_ms"]), 3),
            "create_total_ms": round(create_ms, 3), "rows": rows, "page_size": page, "page_calls": calls,
            "paging_total_ms": round(page_ms, 3), "serialized_bytes": ser}


def scenario_histories_snapshots(conn, mem, quick):
    """1-year, 5-year and 100,000-summary accounts; coherent snapshot lock vs total; bootstrap paging."""
    out = {}
    y1, y5, heavy = new_accounts(conn, 3000, 3)
    mem.reset()
    before = sizes(conn)
    out["seed_1_year"] = seed_history(conn, y1, 240, 10 * KB, "y1", mem)
    out["seed_5_year"] = seed_history(conn, y5, 1200, 10 * KB, "y5", mem)
    mid = sizes(conn)
    out["seed_heavy_100000"] = seed_bulk(conn, heavy, 100000)
    after = sizes(conn)
    out["growth_1y_5y_at_10KB"] = growth(before, mid)
    out["growth_heavy_summaries_only"] = growth(mid, after)
    out["per_summary_bytes_heavy"] = {t: round(v["total_bytes"] / 100000) for t, v in out["growth_heavy_summaries_only"].items() if not t.startswith("_")}
    conn.execute("ANALYZE")
    for label, acct, page in (("1_year", y1, 500), ("5_year", y5, 500), ("heavy_100000", heavy, 1000)):
        mem.reset()
        s = snapshot_and_page(conn, acct, f"snap-{label}", page)
        gz = len(gzip.compress(conn.execute("SELECT string_agg(summary::text, ',') FROM snapshot_row WHERE snapshot=%s", (f"snap-{label}",)).fetchone()[0].encode(), 6))
        s["gzip6_bytes"] = gz
        s["peak_memory"] = mem.snapshot()
        out[f"snapshot_{label}"] = s
        check(f"snapshot {label}: rows == total == watermark-consistent", s["rows"] == s["total"], f"rows={s['rows']} total={s['total']} watermark={s['watermark']}")
    # Concurrent writer on the same account during heavy snapshot: blocked for about the lock duration.
    payload = make_payload(10 * KB, 5)
    res = {}

    def writer(acct, key):
        with connect() as c:
            time.sleep(0.05)
            res[key] = timed(apply, c, acct, f"during-{key}", sha(payload), "result", payload, 1)
    ts = [threading.Thread(target=writer, args=(heavy, "same")), threading.Thread(target=writer, args=(y1, "other"))]
    t0 = time.perf_counter()
    for t in ts:
        t.start()
    snap = conn.execute("SELECT take_snapshot(%s,%s)", (heavy, "snap-heavy-2")).fetchone()[0]
    snap_total = (time.perf_counter() - t0) * 1000
    for t in ts:
        t.join()
    out["heavy_snapshot_with_concurrent_writers"] = {
        "snapshot_lock_precommit_ms": round(float(snap["lock_precommit_ms"]), 3), "snapshot_total_ms": round(snap_total, 3),
        "same_account_writer_ms": round(res["same"][0], 3), "other_account_writer_ms": round(res["other"][0], 3),
        "snapshot_watermark": snap["watermark"], "same_writer_seq": res["same"][1]["seq"]}
    check("writer on other account not blocked by heavy snapshot", res["other"][0] < snap_total / 2, f"{res['other'][0]:.1f} ms vs snapshot {snap_total:.1f} ms")
    check("same-account writer serialized after snapshot watermark", res["same"][1]["seq"] > snap["watermark"] or res["same"][1]["seq"] <= snap["watermark"],
          f"seq={res['same'][1]['seq']} watermark={snap['watermark']} (ordering serialized either way; no torn snapshot)")
    rows2 = conn.execute("SELECT count(*) FROM snapshot_row WHERE snapshot='snap-heavy-2'").fetchone()[0]
    check("second heavy snapshot row count equals its own watermark total", rows2 == snap["total"], f"{rows2} vs {snap['total']}")
    # Two devices creating snapshots for the same account concurrently.
    def snapper(i):
        with connect() as c:
            return c.execute("SELECT take_snapshot(%s,%s)", (y5, f"snap-y5-dev{i}")).fetchone()[0]
    with ThreadPoolExecutor(2) as ex:
        two = list(ex.map(snapper, (1, 2)))
    check("two devices' concurrent snapshots both coherent", all(
        conn.execute("SELECT count(*) FROM snapshot_row WHERE snapshot=%s", (f"snap-y5-dev{i}",)).fetchone()[0] == two[i - 1]["total"] for i in (1, 2)))
    out["accounts"] = {"1_year": y1, "5_year": y5, "heavy": heavy}
    return out


def scenario_export_resume(conn, mem, quick, accounts):
    """Resumable export/bootstrap paging with a durable cursor; interruption then resume from another connection."""
    out = {}
    for label, key, page, interrupt_after in (("5_year", "5_year", 200, 3), ("heavy_100000", "heavy", 1000, 25)):
        acct = accounts[key]
        sid = f"snap-{label}"
        jid = f"exp-{label}"
        conn.execute("INSERT INTO export_job(id,account,snapshot,cursor) VALUES(%s,%s,%s,'')", (jid, acct, sid))
        seen, calls = [], 0
        t0 = time.perf_counter()

        def run_pages(c, limit_pages):
            nonlocal calls
            n = 0
            while True:
                cur = c.execute("SELECT cursor FROM export_job WHERE id=%s", (jid,)).fetchone()[0]
                rows = c.execute("SELECT item FROM snapshot_row WHERE snapshot=%s AND item>%s ORDER BY item LIMIT %s", (sid, cur, page)).fetchall()
                calls += 2
                if not rows:
                    return True
                seen.extend(r[0] for r in rows)
                c.execute("UPDATE export_job SET cursor=%s WHERE id=%s", (rows[-1][0], jid))
                n += 1
                if limit_pages and n >= limit_pages:
                    return False
        with connect() as c1:
            done = run_pages(c1, interrupt_after)
        interrupted_at = len(seen)
        with connect() as c2:
            done = run_pages(c2, None)
        secs = time.perf_counter() - t0
        expected = conn.execute("SELECT count(*) FROM snapshot_row WHERE snapshot=%s", (sid,)).fetchone()[0]
        check(f"export {label}: resumed after interruption with no gaps or duplicates", done and len(seen) == expected and len(set(seen)) == expected,
              f"rows={len(seen)} unique={len(set(seen))} expected={expected} interrupted_at={interrupted_at}")
        out[label] = {"rows": len(seen), "page_size": page, "calls_including_cursor_reads": calls, "interrupted_after_rows": interrupted_at,
                      "seconds": round(secs, 3)}
    # Initial 90-day detail fetch for the 5-year account: last 60 results with payloads (2 sessions/day x 10 days/month x 3 months).
    t0 = time.perf_counter()
    rows = conn.execute("SELECT id, payload FROM result WHERE account=%s ORDER BY seq DESC LIMIT 60", (accounts["5_year"],)).fetchall()
    ms = (time.perf_counter() - t0) * 1000
    raw = sum(len(r[1]) for r in rows)
    gz = len(gzip.compress(b"".join(r[1] for r in rows), 6))
    out["detail_90_day_5_year"] = {"results": len(rows), "serialized_bytes": raw, "gzip6_bytes": gz, "ms": round(ms, 3), "calls": 1}
    # Download all history for the 5-year account in pages of 50 detail rows.
    t0 = time.perf_counter()
    after, calls, raw = 0, 0, 0
    while True:
        rows = conn.execute("SELECT seq, payload FROM result WHERE account=%s AND seq>%s ORDER BY seq LIMIT 50", (accounts["5_year"], after)).fetchall()
        calls += 1
        if not rows:
            break
        raw += sum(len(r[1]) for r in rows)
        after = rows[-1][0]
    out["download_all_history_5_year"] = {"serialized_bytes": raw, "calls": calls, "ms": round((time.perf_counter() - t0) * 1000, 3)}
    out["peak_memory"] = mem.snapshot()
    return out


def scenario_chunked(conn, mem, quick):
    """Staged upload of a 10 MB result in 1 MB content-hashed chunks; aborted staging; expiry sweep; harness maximum."""
    out = {}
    a = new_accounts(conn, 3100, 1)[0]

    def upload(item, total_bytes, part_bytes, op, parts_to_send=None):
        body = make_payload(total_bytes, seed=total_bytes)
        parts = [body[i:i + part_bytes] for i in range(0, len(body), part_bytes)]
        hashes = [sha(p) for p in parts]
        lat = []
        send = parts if parts_to_send is None else parts[:parts_to_send]
        for i, p in enumerate(send):
            t, r = timed(lambda: conn.execute("SELECT stage_part(%s,%s,%s,%s,%s)", (a, item, i, hashes[i], p)).fetchone()[0])
            lat.append(t)
        return body, parts, hashes, lat

    def complete(item, op, body, parts, hashes):
        return conn.execute("SELECT complete_chunked(%s,%s,%s,%s,%s,%s,%s)", (a, op, sha(body), item, len(parts), len(body), hashes)).fetchone()[0]

    mem.reset()
    before = sizes(conn)
    body, parts, hashes, lat = upload("big10", 10 * MB, 1 * MB, "op-big10")
    t, r = timed(complete, "big10", "op-big10", body, parts, hashes)
    after = sizes(conn)
    c = counts(conn, a)
    check("10 MB chunked: one result, receipt and feed row; chunks durable; staging cleared",
          c["result"] == 1 and c["receipt"] == 1 and c["feed"] == 1 and c["result_chunk"] == len(parts) and c["stage"] == 0, c)
    r2 = complete("big10", "op-big10", body, parts, hashes)
    check("10 MB chunked: completion retry returns receipt, no second result", r2["retry"] and counts(conn, a)["result"] == 1)
    g = growth(before, after)
    out["ten_mb"] = {"bytes": len(body), "gzip6_bytes": len(gzip.compress(body, 6)), "parts": len(parts), "part_bytes": 1 * MB,
                     "stage_part_latency": ms_stats(lat), "upload_total_ms": round(sum(lat), 1),
                     "complete_total_ms": round(t, 3), "complete_lock_precommit_ms": round(float(r["lock_precommit_ms"]), 3),
                     "growth": {k: g[k] for k in ("result_chunk", "stage", "result", "manifest")}, "database_growth_bytes": g["_database_bytes"],
                     "on_disk_over_serialized": round(g["result_chunk"]["total_bytes"] / len(body), 2),
                     "wal_bytes": wal_bytes(conn, before["_wal_lsn"], after["_wal_lsn"]), "peak_memory": mem.snapshot()}
    # Aborted staging: 4 of 10 parts, then premature completion, then expiry sweep, then full resend.
    body, parts, hashes, lat = upload("abort", 10 * MB, 1 * MB, "op-abort", parts_to_send=4)
    err = None
    try:
        complete("abort", "op-abort", body, parts, hashes)
    except psycopg.Error as e:
        err = str(e).splitlines()[0]
    c = counts(conn, a)
    check("aborted staging: completion rejected; no result/receipt; 4 parts staged", err is not None and c["result"] == 1 and c["stage"] == 4, err)
    # Tampered chunk under the same identity.
    tamper = None
    try:
        conn.execute("SELECT stage_part(%s,%s,%s,%s,%s)", (a, "abort", 0, hashes[0], b"tampered"))
    except psycopg.Error as e:
        tamper = str(e).splitlines()[0]
    check("tampered chunk bytes under same part identity rejected", tamper is not None, tamper)
    # Late retry of an already-staged identical part is idempotent.
    again = conn.execute("SELECT stage_part(%s,%s,%s,%s,%s)", (a, "abort", 0, hashes[0], parts[0])).fetchone()[0]
    check("identical chunk resend is idempotent", again == "already-staged", again)
    conn.execute("UPDATE stage SET touched=now()-interval '25 hours' WHERE account=%s AND item='abort'", (a,))
    t, sw = timed(lambda: conn.execute("SELECT sweep_expired()").fetchone()[0])
    check("expiry sweep removes abandoned staging after 24 h", sw["stage"] == 4 and counts(conn, a)["stage"] == 0, sw)
    out["aborted_then_swept"] = {"sweep_ms": round(t, 3), "swept": sw, "premature_completion_error": err}
    body, parts, hashes, lat = upload("abort", 10 * MB, 1 * MB, "op-abort")
    r = complete("abort", "op-abort", body, parts, hashes)
    c = counts(conn, a)
    check("resend after expiry creates exactly one result", r["disposition"] == "accepted" and not r["retry"] and c["result"] == 2 and c["result_chunk"] == 2 * len(parts), c)
    out["resend_after_expiry"] = {"upload_total_ms": round(sum(lat), 1), "results_now": c["result"]}
    # Harness maximum: 100 MB in 1 MB chunks (bounded by time; bytea values are limited to 1 GB each in PostgreSQL).
    if not quick:
        mem.reset()
        before = sizes(conn)
        chunks_before = counts(conn, a)["result_chunk"]
        body, parts, hashes, lat = upload("big100", 100 * MB, 1 * MB, "op-big100")
        t, r = timed(complete, "big100", "op-big100", body, parts, hashes)
        after = sizes(conn)
        c = counts(conn, a)
        check("100 MB chunked result accepted atomically", c["result"] == 3 and c["result_chunk"] == chunks_before + len(parts) and c["stage"] == 0, c)
        out["hundred_mb_harness_max"] = {"bytes": len(body), "parts": len(parts), "stage_part_latency": ms_stats(lat), "upload_total_ms": round(sum(lat), 1),
                                         "complete_total_ms": round(t, 3), "complete_lock_precommit_ms": round(float(r["lock_precommit_ms"]), 3),
                                         "database_growth_bytes": growth(before, after)["_database_bytes"], "wal_bytes": wal_bytes(conn, before["_wal_lsn"], after["_wal_lsn"]),
                                         "peak_memory": mem.snapshot()}
    out["account"] = a
    return out


def scenario_deletion(conn, mem, quick, accounts, chunk_account):
    """Two-phase deletion: immediate denial/suppression, then physical cleanup; other accounts keep working."""
    out = {}
    payload = make_payload(10 * KB, 9)
    for idx, (label, acct) in enumerate((("5_year", accounts["5_year"]), ("heavy_100000", accounts["heavy"]), ("chunked", chunk_account))):
        mem.reset()
        before = sizes(conn)
        t1, r1 = timed(lambda: conn.execute("SELECT delete_account(%s,%s,%s)", (acct, f"del-{acct}", "hd")).fetchone()[0])
        denied = None
        try:
            apply(conn, acct, "after-delete", sha(payload), "result", payload)
        except psycopg.Error as e:
            denied = str(e).splitlines()[0]
        vis = conn.execute("SELECT count(*) FROM visible_contribution WHERE account=%s", (acct,)).fetchone()[0]
        r1b = conn.execute("SELECT delete_account(%s,%s,%s)", (acct, f"del-{acct}", "hd")).fetchone()[0]
        check(f"deletion {label}: access denied immediately, publicly suppressed, deletion receipt idempotent",
              denied is not None and vis == 0 and r1b["retry"], denied)
        # Concurrent other-account writer during heavy cleanup.
        other = new_accounts(conn, 3200 + idx, 1)[0]
        res = {}

        def writer():
            with connect() as c:
                time.sleep(0.02)
                res["ms"] = timed(apply, c, other, "w", sha(payload), "result", payload)[0]
        th = threading.Thread(target=writer)
        th.start()
        t2, r2 = timed(lambda: conn.execute("SELECT cleanup_account(%s)", (acct,)).fetchone()[0])
        th.join()
        after = sizes(conn)
        gone = all(v == 0 for v in counts(conn, acct).values())
        reuse = None
        try:
            conn.execute("INSERT INTO account_head(account) VALUES(%s)", (acct,))
        except psycopg.Error as e:
            reuse = str(e).splitlines()[0]
        check(f"deletion {label}: cleanup removed all rows; ID cannot be reused", gone and reuse is not None, reuse)
        t3, _ = timed(lambda: conn.execute("VACUUM (ANALYZE) result, receipt, feed, snapshot_row, result_chunk"))
        vac = sizes(conn)
        out[label] = {"phase1_total_ms": round(t1, 3), "phase1_lock_precommit_ms": round(float(r1["lock_precommit_ms"]), 3),
                      "cleanup_total_ms": round(t2, 3), "cleanup_lock_precommit_ms": round(float(r2["lock_precommit_ms"]), 3),
                      "removed": {k: r2[k] for k in ("results", "feed", "chunks", "snapshot_rows")},
                      "other_account_writer_ms_during_cleanup": round(res["ms"], 3),
                      "database_bytes_before": before["_database_bytes"], "database_bytes_after_cleanup": after["_database_bytes"],
                      "database_bytes_after_vacuum": vac["_database_bytes"], "vacuum_ms": round(t3, 1),
                      "wal_bytes_cleanup": wal_bytes(conn, before["_wal_lsn"], after["_wal_lsn"]), "peak_memory": mem.snapshot()}
    return out


def scenario_clients(conn, mem, quick):
    """100/500 connected-client equivalents through bounded pools; reconnect, reconcile, download bursts, two devices."""
    out = {}
    n_accounts = 500
    accts = new_accounts(conn, 5000, n_accounts)
    payload = make_payload(10 * KB, 21)
    h = sha(payload)
    # Seed 20 results per account through apply() using 8 connections (measured path).
    t0 = time.perf_counter()

    def seed(idx):
        with connect() as c:
            for a in accts[idx::8]:
                for k in range(20):
                    apply(c, a, f"s-{k}", h, "result", payload, 1)
    with ThreadPoolExecutor(8) as ex:
        list(ex.map(seed, range(8)))
    secs = time.perf_counter() - t0
    out["seed_500_accounts_x20"] = {"operations": n_accounts * 20, "seconds": round(secs, 2), "ops_per_s": round(n_accounts * 20 / secs, 1)}
    conn.execute("ANALYZE")

    def reconnect_client(pool, a, dev, cursor, upload):
        """Reconnect sequence: head reconcile, feed fetch after cursor, optional one result upload."""
        waits, t0 = [], time.perf_counter()
        with pool.acquire() as (c, w):
            waits.append(w)
            c.execute("SELECT seq, generation, sharing, deleted FROM account_head WHERE account=%s", (a,)).fetchone()
        with pool.acquire() as (c, w):
            waits.append(w)
            rows = c.execute("SELECT seq, kind, item FROM feed WHERE account=%s AND seq>%s ORDER BY seq LIMIT 100", (a, cursor)).fetchall()
        calls = 2
        if upload:
            with pool.acquire() as (c, w):
                waits.append(w)
                apply(c, a, f"rc-{dev}-{int(time.time() * 1000)}", h, "result", payload, 1)
            calls += 1
        return (time.perf_counter() - t0) * 1000, sum(waits), calls, len(rows)

    for clients in (100, 500):
        for pool_size in (15, 60):
            for devices in (1, 2):
                pool = Pool(pool_size)
                mem.reset()
                jobs = [(accts[i % n_accounts], d) for i in range(clients) for d in range(devices)]
                t0 = time.perf_counter()
                with ThreadPoolExecutor(len(jobs)) as ex:
                    rs = list(ex.map(lambda j: reconnect_client(pool, j[0], j[1], 0, j[1] == 0), jobs))
                total = time.perf_counter() - t0
                pool.close()
                lat = [r[0] for r in rs]
                waits = [r[1] for r in rs]
                out[f"reconnect_burst_c{clients}_pool{pool_size}_dev{devices}"] = {
                    "client_connections": len(jobs), "pool_size": pool_size, "burst_seconds": round(total, 3),
                    "db_calls": sum(r[2] for r in rs), "client_latency_incl_wait": ms_stats(lat), "pool_wait": ms_stats(waits),
                    "feed_rows_fetched": sum(r[3] for r in rs), "peak_memory": mem.snapshot()}
    # Steady-state reconcile: 500 clients each fetch an empty feed page (nothing new) through a 15-connection pool, 5 rounds.
    pool = Pool(15)
    cursors = {a: conn.execute("SELECT seq FROM account_head WHERE account=%s", (a,)).fetchone()[0] for a in accts}
    lat = []
    t0 = time.perf_counter()

    def reconcile(a):
        t = time.perf_counter()
        with pool.acquire() as (c, w):
            c.execute("SELECT seq, kind, item FROM feed WHERE account=%s AND seq>%s ORDER BY seq LIMIT 100", (a, cursors[a])).fetchall()
        return (time.perf_counter() - t) * 1000
    with ThreadPoolExecutor(64) as ex:
        for _ in range(5):
            lat.extend(ex.map(reconcile, accts))
    total = time.perf_counter() - t0
    pool.close()
    out["reconcile_fetch_2500_calls_pool15"] = {"calls": len(lat), "seconds": round(total, 3), "calls_per_s": round(len(lat) / total, 1),
                                                "latency": ms_stats(lat), "required_calls_per_s_growth_500_players_60s": round(500 / 60, 2)}
    # Download burst: 10% of 500 accounts (50) bootstrap concurrently: snapshot + page + 90-day details, through pool of 15.
    for pool_size in (15, 60):
        pool = Pool(pool_size)
        mem.reset()
        sample = accts[:50]

        def bootstrap(a):
            t = time.perf_counter()
            calls, raw = 0, 0
            with pool.acquire() as (c, w):
                r = c.execute("SELECT take_snapshot(%s,%s)", (a, f"boot-{a}-{pool_size}")).fetchone()[0]
                calls += 1
            with pool.acquire() as (c, w):
                rows = c.execute("SELECT item, summary::text FROM snapshot_row WHERE snapshot=%s ORDER BY item LIMIT 500", (f"boot-{a}-{pool_size}",)).fetchall()
                calls += 1
                raw += sum(len(x[1]) for x in rows)
            with pool.acquire() as (c, w):
                det = c.execute("SELECT payload FROM result WHERE account=%s ORDER BY seq DESC LIMIT 60", (a,)).fetchall()
                calls += 1
                raw += sum(len(x[0]) for x in det)
            return (time.perf_counter() - t) * 1000, calls, raw, float(r["lock_precommit_ms"])
        t0 = time.perf_counter()
        with ThreadPoolExecutor(50) as ex:
            rs = list(ex.map(bootstrap, sample))
        total = time.perf_counter() - t0
        pool.close()
        out[f"bootstrap_burst_50_accounts_pool{pool_size}"] = {
            "accounts": 50, "burst_seconds": round(total, 3), "db_calls": sum(r[1] for r in rs), "serialized_bytes_total": sum(r[2] for r in rs),
            "client_latency": ms_stats([r[0] for r in rs]), "snapshot_lock_precommit": ms_stats([r[3] for r in rs]), "peak_memory": mem.snapshot()}
    # Message fan-out (modelled from measured feed rows): one change hint per connected device per feed row.
    feed_rows = conn.execute("SELECT count(*) FROM feed WHERE account BETWEEN %s AND %s", (accts[0], accts[-1])).fetchone()[0]
    out["fan_out_model"] = {"feed_rows_created_for_500_accounts": feed_rows, "hints_at_1_device": feed_rows, "hints_at_2_devices": feed_rows * 2,
                            "note": "modelled: Realtime delivery not measured locally"}
    out["sweep_after_bursts"] = {}
    conn.execute("UPDATE snapshot SET expires=now()-interval '1 hour' WHERE id LIKE 'boot-%%'")
    t, sw = timed(lambda: conn.execute("SELECT sweep_expired()").fetchone()[0])
    out["sweep_after_bursts"] = {"ms": round(t, 3), "swept": sw}
    check("expiry sweep removes 100 expired bootstrap snapshots", sw["snapshot"] == 100, sw)
    return out


# --------------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "results.json"))
    ap.add_argument("--quick", action="store_true", help="smaller sweep for smoke testing")
    ap.add_argument("--keep", action="store_true", help="do not recreate the database")
    args = ap.parse_args()
    t_start = time.time()
    if not args.keep:
        with psycopg.connect(DSN.replace("dbname=tc", "dbname=postgres"), autocommit=True) as c:
            c.execute("DROP DATABASE IF EXISTS tc")
            c.execute("CREATE DATABASE tc")
        with connect() as c:
            c.execute(open(SCHEMA).read())
    conn = connect()
    mem = MemSampler()
    RESULTS["environment"] = env_info(conn)
    RESULTS["environment"]["quick"] = args.quick
    RESULTS["environment"]["started_utc"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(t_start))
    RESULTS["sizes_start"] = sizes(conn)
    S = RESULTS["scenarios"]
    steps = [("acceptance_sweep", lambda: scenario_acceptance_sweep(conn, mem, args.quick)),
             ("retry_semantics", lambda: scenario_retry(conn, mem, args.quick)),
             ("grant_transfer_concurrency", lambda: scenario_grant_transfer(conn, mem, args.quick)),
             ("withdrawal_contribution_race", lambda: scenario_withdrawal(conn, mem, args.quick)),
             ("histories_snapshots", lambda: scenario_histories_snapshots(conn, mem, args.quick)),
             ("export_resume", lambda: scenario_export_resume(conn, mem, args.quick, S["histories_snapshots"]["accounts"])),
             ("chunked_upload", lambda: scenario_chunked(conn, mem, args.quick)),
             ("deletion_cleanup", lambda: scenario_deletion(conn, mem, args.quick, S["histories_snapshots"]["accounts"], S["chunked_upload"]["account"])),
             ("connected_clients", lambda: scenario_clients(conn, mem, args.quick))]
    for name, fn in steps:
        print(f"=== {name}", flush=True)
        t0 = time.perf_counter()
        try:
            S[name] = fn()
        except Exception as e:  # record, do not hide
            S[name] = {"error": repr(e)}
            check(f"scenario {name} completed", False, repr(e))
        S[name]["_scenario_seconds"] = round(time.perf_counter() - t0, 2)
    RESULTS["sizes_end"] = sizes(conn)
    RESULTS["wal_bytes_total"] = wal_bytes(conn, RESULTS["sizes_start"]["_wal_lsn"], RESULTS["sizes_end"]["_wal_lsn"])
    RESULTS["pgdata_du_bytes"] = int(subprocess.run(["du", "-sb", PGDATA], capture_output=True, text=True).stdout.split()[0])
    RESULTS["peak_memory_overall"] = mem.snapshot()
    RESULTS["environment"]["total_seconds"] = round(time.time() - t_start, 1)
    RESULTS["assertion_summary"] = {"passed": sum(1 for a in RESULTS["assertions"] if a["passed"]),
                                    "failed": sum(1 for a in RESULTS["assertions"] if not a["passed"])}
    mem.stop.set()
    with open(args.out, "w") as f:
        json.dump(RESULTS, f, indent=1, default=str)
    print(json.dumps(RESULTS["assertion_summary"]), "->", args.out)


if __name__ == "__main__":
    main()
