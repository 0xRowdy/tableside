"""Offline planning arithmetic for True Count issue #37. Not a measured capacity model.

Every number in docs/research/backend-workload-provider-pricing.md is produced by this script:

    python3 calculate.py            # writes results.json next to this file and prints the summary tables

Rates are USD list prices checked against first-party pages on 2026-09-14 (URLs in the research note).
Measured inputs are read from ../backend-workload-feasibility/results.json when present; otherwise the
documented fallbacks are used and flagged. Illustrative sensitivity inputs (10% subscribers, two emails per
MAU, ten analytics events per session, 20% retries) are labelled illustrative and are not product limits.
"""

import json
import math
import os

HERE = os.path.dirname(os.path.abspath(__file__))
MEASURED_PATH = os.path.join(HERE, "..", "backend-workload-feasibility", "results.json")

# --------------------------------------------------------------------------- rates (checked 2026-09-14)
RATES = {
    "supabase_pro_month": 25.0,              # includes $10 compute credit covering one Micro
    "supabase_compute_credit": 10.0,
    "micro_hour": 0.01344,                   # ~$10/month; 1 GB RAM; 60 direct connections; 200 pooler clients
    "small_hour": 0.0206,                    # ~$15/month; 2 GB RAM; 90 / 400
    "disk_included_gb": 8.0, "disk_gb_month": 0.125, "disk_min_provisioned_gb": 8.0, "disk_provision_factor": 1.2,
    "egress_included_gb": 250.0, "egress_gb": 0.09,
    "edge_included": 2_000_000, "edge_per_million": 2.0,
    "realtime_conn_included": 500, "realtime_conn_package": 1000, "realtime_conn_package_price": 10.0,
    "realtime_msg_included": 5_000_000, "realtime_msg_package": 1_000_000, "realtime_msg_package_price": 2.50,
    "realtime_capped_pro_connections_limit": 500, "realtime_uncapped_pro_connections_limit": 10_000,
    "auth_mau_included": 100_000, "auth_mau": 0.00325,
    "pitr_7d_month": 100.0, "log_drain_month": 60.0, "pro_log_retention_days": 7,
    "workers_paid_month": 5.0, "workers_req_included": 10_000_000, "workers_req_per_million": 0.30,
    "workers_cpu_ms_included": 30_000_000, "workers_cpu_ms_per_million": 0.02,
    "workers_logs_included": 20_000_000, "workers_logs_per_million": 0.60,
    "lambda_req_per_million": 0.20, "lambda_gb_second": 0.0000166667, "lambda_free_requests": 1_000_000, "lambda_free_gb_seconds": 400_000,
    "cloudwatch_ingest_gb": 0.50, "cloudwatch_storage_gb_month": 0.03, "cloudwatch_free_gb": 5.0, "cloudwatch_insights_scan_gb": 0.005,
    "aws_dto_free_gb": 100.0, "aws_dto_gb": 0.09,
    "posthog_free_events": 1_000_000,
    "posthog_anonymous_tiers": [(2_000_000, 0.00005), (15_000_000, 0.0000343), (50_000_000, 0.0000295)],
    "posthog_identified_tiers": [(2_000_000, 0.000198), (15_000_000, 0.0000697), (50_000_000, 0.000036)],
    "posthog_free_exceptions": 100_000, "posthog_exception": 0.00037,
    "revenuecat_mtr_threshold": 2500.0, "revenuecat_rate": 0.01,
    "premium_monthly_usd": 5.99, "premium_annual_usd": 39.99,       # provisional launch prices (docs/research/launch-pricing.md)
    "resend_free_month": 3000, "resend_free_day": 100, "resend_pro_month": 20.0, "resend_pro_included": 50_000,
    "b2_tb_month": 6.95, "b2_free_gb": 10.0, "b2_egress_free_multiple": 3.0, "b2_egress_gb": 0.01,
}

# --------------------------------------------------------------------------- fixed and illustrative inputs
ILLUSTRATIVE = {"subscriber_fraction": 0.10, "emails_per_mau": 2, "events_per_session": 10, "ops_events_month": 3000,
                "retry_factor": 1.2, "bootstrap_fraction": 0.10, "download_all_fraction": 0.01,
                "reconcile_response_bytes": 600, "hint_bytes": 200, "probe_response_bytes": 300,
                "lambda_seconds": 0.1, "lambda_memory_gib": 0.125, "log_bytes_per_request": 1024}
FIXED = {"active_days": 10, "sessions_per_day": 2, "session_minutes": 20}


def measured_inputs():
    """Pull per-operation disk, WAL and transfer figures from the harness run when available."""
    fallback = {"source": "fallback (no results.json)", "disk_ratio": {10_000: 1.0, 100_000: 1.0, 1_000_000: 1.0},
                "fixed_bytes_per_result": 600, "summary_bytes": 270, "receipt_bytes": 115, "feed_bytes": 91,
                "gzip_ratio": {10_000: 1.0, 100_000: 1.0, 1_000_000: 1.0}, "snapshot_row_bytes_serialized": 142,
                "wal_ratio": {10_000: 1.0, 100_000: 1.0, 1_000_000: 1.0}}
    if not os.path.exists(MEASURED_PATH):
        return fallback
    r = json.load(open(MEASURED_PATH))
    acc = r["scenarios"]["acceptance_sweep"]
    m = {"source": "measured (" + os.path.relpath(MEASURED_PATH, HERE) + ", " + r["environment"]["started_utc"] + ")",
         "disk_ratio": {}, "gzip_ratio": {}, "wal_ratio": {}, "serialized_bytes": {}}
    for size in (10_000, 100_000, 1_000_000):
        a = acc[str(size)]
        g = a["growth_per_op"]
        m["disk_ratio"][size] = a["database_growth_per_op"] / a["serialized_bytes"]
        m["gzip_ratio"][size] = a["gzip_ratio"]
        m["wal_ratio"][size] = a["wal_bytes_per_op"] / a["serialized_bytes"]
        m["serialized_bytes"][size] = a["serialized_bytes"]
    heavy = r["scenarios"]["histories_snapshots"]
    m["summary_bytes"] = heavy["per_summary_bytes_heavy"]["result"]
    m["receipt_bytes"] = heavy["per_summary_bytes_heavy"]["receipt"]
    m["feed_bytes"] = heavy["per_summary_bytes_heavy"]["feed"]
    m["snapshot_row_bytes_serialized"] = heavy["snapshot_heavy_100000"]["serialized_bytes"] / heavy["snapshot_heavy_100000"]["rows"]
    m["snapshot_gzip_ratio"] = heavy["snapshot_heavy_100000"]["serialized_bytes"] / heavy["snapshot_heavy_100000"]["gzip6_bytes"]
    m["fixed_bytes_per_result"] = m["summary_bytes"] + m["receipt_bytes"] + m["feed_bytes"]
    return m


# --------------------------------------------------------------------------- helpers
def packages(usage, included, size, price):
    return math.ceil(max(0.0, usage - included) / size) * price


def tiered(events, free, tiers):
    cost, prev = 0.0, free
    if events <= free:
        return 0.0
    for upper, rate in tiers:
        if events > prev:
            cost += (min(events, upper) - prev) * rate
            prev = upper
    if events > prev:
        cost += (events - prev) * tiers[-1][1]
    return round(cost, 2)


def lambda_cost(requests, seconds, memory_gib, free=True, log_bytes=1024):
    gb_seconds = requests * seconds * memory_gib
    log_gib = requests * log_bytes / 2**30
    cost = max(0.0, requests - (RATES["lambda_free_requests"] if free else 0)) * RATES["lambda_req_per_million"] / 1e6
    cost += max(0.0, gb_seconds - (RATES["lambda_free_gb_seconds"] if free else 0)) * RATES["lambda_gb_second"]
    cost += max(0.0, log_gib - (RATES["cloudwatch_free_gb"] if free else 0)) * (RATES["cloudwatch_ingest_gb"] + RATES["cloudwatch_storage_gb_month"] + RATES["cloudwatch_insights_scan_gb"])
    cost += max(0.0, log_gib - (RATES["aws_dto_free_gb"] if free else 0)) * RATES["aws_dto_gb"]
    return round(cost, 4)


def revenuecat(monthly_subs, annual_subs):
    mtr = monthly_subs * RATES["premium_monthly_usd"] + annual_subs * RATES["premium_annual_usd"]
    charge = mtr * RATES["revenuecat_rate"] if mtr >= RATES["revenuecat_mtr_threshold"] else 0.0
    return {"mtr": round(mtr, 2), "charge": round(charge, 2)}


def disk_cost_for_size_gb(db_gb):
    provisioned = max(RATES["disk_min_provisioned_gb"], db_gb * RATES["disk_provision_factor"])
    return round(max(0.0, provisioned - RATES["disk_included_gb"]) * RATES["disk_gb_month"], 2), round(provisioned, 2)


# --------------------------------------------------------------------------- scenario model
def scenario(mau, devices, payload_bytes, measured, months=12, identified_events=True, compression=True):
    I, R = ILLUSTRATIVE, RATES
    retry = I["retry_factor"]
    sessions = mau * FIXED["active_days"] * FIXED["sessions_per_day"]
    minutes = sessions * FIXED["session_minutes"]
    subscribers = int(mau * I["subscriber_fraction"])
    store_checks = subscribers * (30 + 10 + 2)      # daily reconciliation + boundary/lifecycle + six-hour foreground refresh, not coalesced
    webhooks = subscribers * 2
    grants = mau * FIXED["active_days"]
    transfers = mau // 10
    withdrawals = mau // 100
    deletes = mau // 100
    exports = mau // 10
    bootstraps = int(mau * I["bootstrap_fraction"])
    changes = sessions + grants + transfers + withdrawals + store_checks + deletes
    calls = {
        "reconcile_60s": minutes * devices,
        "open_reconnect": sessions * devices,
        "auth_refresh": mau * 10 * devices,
        "result_acceptance": sessions,
        "grant_transfer_withdrawal": grants + transfers + withdrawals,
        "notification_fetch": changes * devices,
        "billing_webhook_ingress": webhooks,
        "store_verification_job": store_checks,
        "export_and_bootstrap_create": exports + bootstraps,
        "bootstrap_pages_and_detail": bootstraps * 3,
        "deletion_request_and_cleanup": deletes * 2,
        "hourly_expiry_sweep": 720,
    }
    calls = {k: round(v * retry) for k, v in calls.items()}
    backend_calls = sum(calls.values())
    probes = round((minutes * 2 + sessions) * devices * retry)
    # Realtime: Postgres Changes counts one message per subscribed client per change; Broadcast counts 1 + subscribers.
    messages_changes = round(changes * devices * retry)
    messages_broadcast = round(changes * (1 + devices) * retry)
    peak_connections = (mau // 10) * devices
    emails = round(mau * I["emails_per_mau"] * retry)
    events = round((sessions * I["events_per_session"] + I["ops_events_month"]) * retry)

    # Disk: measured on-disk bytes per accepted result (payload TOAST + receipt + feed + indexes), no compression sensitivity.
    ratio = measured["disk_ratio"][payload_bytes] if compression else 1.0 + measured["fixed_bytes_per_result"] / payload_bytes
    bytes_per_result = payload_bytes * ratio
    new_gb_month = sessions * bytes_per_result / 1e9
    raw_gb_month = sessions * payload_bytes / 1e9
    wal_gb_month = sessions * payload_bytes * measured["wal_ratio"][payload_bytes] / 1e9
    disk_costs = []
    for month in range(1, months + 1):
        c, prov = disk_cost_for_size_gb(new_gb_month * month)
        disk_costs.append(c)
    disk_month12, prov12 = disk_cost_for_size_gb(new_gb_month * 12)
    disk_month60, prov60 = disk_cost_for_size_gb(new_gb_month * 60)

    # Egress (uncached, private): reconcile responses, hints, bootstrap summaries + 90-day detail, download-all, exports.
    summaries_per_account_year1 = FIXED["active_days"] * FIXED["sessions_per_day"] * 12
    bootstrap_bytes = summaries_per_account_year1 * measured["snapshot_row_bytes_serialized"] + 60 * payload_bytes
    download_all_bytes = summaries_per_account_year1 * 5 * payload_bytes
    egress_gb = (calls["reconcile_60s"] * I["reconcile_response_bytes"] + calls["notification_fetch"] * I["reconcile_response_bytes"]
                 + messages_changes * I["hint_bytes"] + bootstraps * bootstrap_bytes + exports * bootstrap_bytes
                 + int(mau * I["download_all_fraction"]) * download_all_bytes) * retry / 1e9
    probe_egress_gb = probes * I["probe_response_bytes"] / 1e9   # Workers: no egress charge

    costs = {
        "supabase_pro_with_micro": R["supabase_pro_month"],
        "supabase_disk_month12_at_growth_rate": disk_month12,
        "supabase_egress": round(packages(egress_gb, R["egress_included_gb"], 1, R["egress_gb"]), 2),
        "supabase_realtime_peak_connections": packages(peak_connections, R["realtime_conn_included"], R["realtime_conn_package"], R["realtime_conn_package_price"]),
        "supabase_realtime_messages": packages(messages_changes, R["realtime_msg_included"], R["realtime_msg_package"], R["realtime_msg_package_price"]),
        "workers_paid_probes_1ms": round(R["workers_paid_month"] + max(0, probes - R["workers_req_included"]) * R["workers_req_per_million"] / 1e6
                                         + max(0, probes - R["workers_cpu_ms_included"]) * R["workers_cpu_ms_per_million"] / 1e6, 4),
        "workers_logs_one_per_probe": round(max(0, probes - R["workers_logs_included"]) * R["workers_logs_per_million"] / 1e6, 4),
        "lambda_1pct_fallback": lambda_cost(probes * 0.01, I["lambda_seconds"], I["lambda_memory_gib"]),
        "resend": 0.0 if emails <= R["resend_free_month"] else R["resend_pro_month"],
        "posthog_events_identified" if identified_events else "posthog_events_anonymous":
            tiered(events, R["posthog_free_events"], R["posthog_identified_tiers"] if identified_events else R["posthog_anonymous_tiers"]),
        "posthog_errors_under_100k": 0.0,
        "revenuecat_all_monthly_plans": revenuecat(subscribers, 0)["charge"],
    }
    subtotal = round(sum(costs.values()), 2)
    return {
        "inputs": {"mau": mau, "devices": devices, "payload_bytes": payload_bytes, "sessions": sessions, "minutes": minutes,
                   "subscribers_illustrative": subscribers, "identified_events": identified_events, "compression_as_measured": compression},
        "calls_by_operation": calls, "backend_calls": backend_calls, "probe_attempts": probes,
        "realtime": {"peak_connections": peak_connections, "messages_postgres_changes": messages_changes, "messages_broadcast": messages_broadcast,
                     "exceeds_capped_pro_connection_limit": peak_connections > R["realtime_capped_pro_connections_limit"]},
        "emails": emails, "email_per_day_average": round(emails / 30, 1), "analytics_events": events,
        "disk": {"bytes_per_result_on_disk": round(bytes_per_result), "raw_payload_gb_month": round(raw_gb_month, 3),
                 "on_disk_gb_month": round(new_gb_month, 3), "wal_gb_month": round(wal_gb_month, 3),
                 "db_gb_month12": round(new_gb_month * 12, 2), "provisioned_gb_month12": prov12, "cost_month12": disk_month12,
                 "db_gb_month60": round(new_gb_month * 60, 2), "provisioned_gb_month60": prov60, "cost_month60": disk_month60,
                 "year1_average_monthly_cost": round(sum(disk_costs) / 12, 2)},
        "egress": {"uncached_gb": round(egress_gb, 3), "probe_gb_workers_free": round(probe_egress_gb, 3),
                   "bootstrap_bytes_per_new_device": round(bootstrap_bytes), "download_all_bytes_5_year": round(download_all_bytes)},
        "costs": costs, "subtotal_month": subtotal, "subtotal_plus_disk_month60": round(subtotal - disk_month12 + disk_month60, 2),
        "gap_vs_50": round(max(0.0, subtotal - 50.0), 2),
        "sensitivities": {
            "supabase_edge_if_all_calls_use_edge_functions": packages(backend_calls, R["edge_included"], 1_000_000, R["edge_per_million"]),
            "posthog_events_other_rate": tiered(events, R["posthog_free_events"], R["posthog_anonymous_tiers"] if identified_events else R["posthog_identified_tiers"]),
            "revenuecat_annual_cohort": revenuecat(0, subscribers),
            "lambda_all_primary_failed": lambda_cost(probes, I["lambda_seconds"], I["lambda_memory_gib"]),
            "lambda_all_primary_failed_no_free_tier": lambda_cost(probes, I["lambda_seconds"], I["lambda_memory_gib"], free=False),
            "lambda_1s_all_primary_failed": lambda_cost(probes, 1.0, I["lambda_memory_gib"]),
            "workers_10ms_cpu_increment": round(max(0, probes * 10 - R["workers_cpu_ms_included"]) * R["workers_cpu_ms_per_million"] / 1e6, 4),
            "realtime_messages_if_broadcast": packages(messages_broadcast, R["realtime_msg_included"], R["realtime_msg_package"], R["realtime_msg_package_price"]),
            "disk_cost_month12_no_toast_compression": disk_cost_for_size_gb(sessions * (payload_bytes + measured["fixed_bytes_per_result"]) / 1e9 * 12)[0],
        },
    }


def beta_overlap(overlap_days=30, cleanup_days=7, testers=50, export_bytes=12_000_000):
    """Temporary isolated beta project alongside production. Micro compute has no second compute credit."""
    R = RATES
    hours = (overlap_days + cleanup_days) * 24
    compute = round(hours * R["micro_hour"], 2)
    notices = testers * 2                      # entry notice + shutdown notice; free tier is 100/day
    export_gb = testers * export_bytes * 2 / 1e9   # export plus one regeneration
    return {"overlap_days": overlap_days, "cleanup_days_after_shutdown": cleanup_days, "testers": testers,
            "second_micro_project_compute": compute, "second_project_disk_included_gb": R["disk_included_gb"],
            "beta_notice_emails": notices, "notice_days_needed_at_free_daily_cap": math.ceil(notices / R["resend_free_day"]),
            "beta_export_burst_gb": round(export_gb, 3), "beta_egress_cost": packages(export_gb, R["egress_included_gb"], 1, R["egress_gb"]),
            "shutdown_fencing_and_cleanup_jobs": "compute only; within the second project's Micro hours above",
            "total_overlap_cost": compute, "per_extra_overlap_day": round(24 * R["micro_hour"], 3),
            "note": "Separate RevenueCat sandbox, PostHog project, Resend domain, Workers/Lambda routes add no listed charge; cleanup retention of provider copies is a qualification task, not a priced item."}


def post_mvp(db_gb, dump_ratio, restore_exercises_per_quarter=1):
    """Independent B2 backups, restore exercises and AI operations: separate subtotal, not an MVP gate."""
    R = RATES
    dump_gb = db_gb / dump_ratio
    source_transfer_gb = dump_gb * 30                     # one full dump per day leaves Supabase as uncached egress
    stored_gb = dump_gb * 3                              # three retained daily copies
    b2_storage = round(max(0.0, stored_gb - R["b2_free_gb"]) * R["b2_tb_month"] / 1000, 4)
    restore_gb_month = dump_gb * restore_exercises_per_quarter / 3
    b2_egress = round(max(0.0, restore_gb_month - stored_gb * R["b2_egress_free_multiple"]) * R["b2_egress_gb"], 4)
    lam = lambda_cost(30, 900, 1.0, free=True, log_bytes=65536)       # 30 dumps x 15-minute Lambda at 1 GiB (illustrative executor)
    return {"db_gb": db_gb, "dump_ratio": dump_ratio, "dump_gb": round(dump_gb, 3), "source_transfer_gb_month": round(source_transfer_gb, 2),
            "b2_stored_gb": round(stored_gb, 3), "b2_storage": b2_storage, "b2_restore_egress": b2_egress,
            "supabase_egress_for_dumps": round(packages(source_transfer_gb, 0, 1, R["egress_gb"]), 2),
            "supabase_egress_note": "charged only beyond the shared 250 GB uncached allowance; shown at full rate as the worst case",
            "executor_lambda_illustrative": lam,
            "restore_exercise_compute": "unpriced: isolated restore target (a Supabase branch at $0.01344/h or a second project) for the exercise duration",
            "pitr_alternative_if_ever_adopted": round(R["pitr_7d_month"] + (R["small_hour"] * 730 - R["supabase_compute_credit"]), 2),
            "ai_operations": "unpriced: model/agent hosting and token costs depend on an unselected implementation",
            "subtotal_priced": round(b2_storage + b2_egress + lam, 2)}


def fit_ladder(measured):
    """Growth scenario: which labelled changes would be needed to reach $50. Each step is a proposal, not a decision."""
    base = scenario(5000, 2, 100_000, measured, identified_events=True)
    steps, running = [], base["subtotal_month"]
    steps.append({"step": "growth base: 5,000 MAU, two devices, 100 KB results, identified analytics events", "subtotal": running})
    running = round(running - base["costs"]["posthog_events_identified"] + base["sensitivities"]["posthog_events_other_rate"], 2)
    steps.append({"step": "send only anonymous analytics events (no person profiles)", "subtotal": running})
    running = round(running - base["costs"]["supabase_realtime_peak_connections"], 2)
    steps.append({"step": "one Realtime connection per player (background device disconnects) keeps peak within 500", "subtotal": running})
    running = round(running - base["costs"]["resend"], 2)
    steps.append({"step": "transactional email stays within Resend free tier (needs <= 3,000/month and <= 100/day; illustrative 2/MAU exceeds it)", "subtotal": running})
    running = round(running - base["costs"]["revenuecat_all_monthly_plans"], 2)
    steps.append({"step": "treat RevenueCat's 1% of MTR as revenue-linked cost outside the fixed backend target (policy decision required)", "subtotal": running})
    running = round(running - base["costs"]["supabase_disk_month12_at_growth_rate"], 2)
    steps.append({"step": "month-1 rather than month-12 disk (history accumulates; this is timing, not a saving)", "subtotal": running})
    return steps


def crossing(measured, devices=1, payload=100_000, identified=True):
    """MAU at which the modelled monthly subtotal first exceeds $40 (alert) and $50 (target)."""
    out = {"alert_40_mau": None, "target_50_mau": None, "points": []}
    for mau in range(1000, 5001, 250):
        s = scenario(mau, devices, payload, measured, identified_events=identified)["subtotal_month"]
        out["points"].append({"mau": mau, "subtotal": s})
        if out["alert_40_mau"] is None and s > 40:
            out["alert_40_mau"] = mau
        if out["target_50_mau"] is None and s > 50:
            out["target_50_mau"] = mau
    return out


def markdown(out):
    """Tables pasted verbatim into docs/research/backend-workload-provider-pricing.md."""
    S = out["scenarios"]
    m = out["measured"]
    lines = ["<!-- generated by experiments/backend-workload-pricing/calculate.py -->", "",
             "### Measured inputs used by the model", "",
             "| Input | 10 KB | 100 KB | 1 MB | Source |", "| --- | ---: | ---: | ---: | --- |"]
    if "serialized_bytes" in m:
        lines.append("| Serialized result bytes | " + " | ".join(f"{m['serialized_bytes'][s]:,}" for s in (10_000, 100_000, 1_000_000)) + " | measured |")
        lines.append("| On-disk bytes per accepted result (payload + receipt + feed + indexes) / serialized | " + " | ".join(f"{m['disk_ratio'][s]:.2f}" for s in (10_000, 100_000, 1_000_000)) + " | measured (pglz TOAST) |")
        lines.append("| WAL bytes per accepted result / serialized | " + " | ".join(f"{m['wal_ratio'][s]:.2f}" for s in (10_000, 100_000, 1_000_000)) + " | measured |")
        lines.append("| gzip -6 ratio of the serialized artifact | " + " | ".join(f"{m['gzip_ratio'][s]:.2f}" for s in (10_000, 100_000, 1_000_000)) + " | measured (synthetic JSON) |")
        lines.append(f"| Summary + receipt + feed bytes per result without payload | {m['fixed_bytes_per_result']} | | | measured (100,000-summary account) |")
        lines.append(f"| Snapshot row serialized bytes | {m['snapshot_row_bytes_serialized']:.0f} | | | measured |")
    lines += ["", "### Modelled monthly counts", "",
              "| Scenario | Backend calls | Probe attempts | Peak Realtime connections | Realtime messages (Postgres Changes) | Emails | Analytics events | Uncached egress GB | New on-disk GB/month | DB GB after 12 / 60 months |",
              "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |"]
    for mau in (1000, 5000):
        for dev in (1, 2):
            for pay in (10_000, 100_000, 1_000_000):
                s = S[f"mau{mau}_dev{dev}_payload{pay}_identified"]
                lines.append(f"| {mau:,} MAU, {dev} device{'s' if dev > 1 else ''}, {pay // 1000 if pay < 1_000_000 else 1} {'KB' if pay < 1_000_000 else 'MB'} | "
                             f"{s['backend_calls']:,} | {s['probe_attempts']:,} | {s['realtime']['peak_connections']:,} | {s['realtime']['messages_postgres_changes']:,} | "
                             f"{s['emails']:,} | {s['analytics_events']:,} | {s['egress']['uncached_gb']:.2f} | {s['disk']['on_disk_gb_month']:.3f} | "
                             f"{s['disk']['db_gb_month12']:.1f} / {s['disk']['db_gb_month60']:.1f} |")
    lines += ["", "### Priced line items (USD/month, month 12 of accumulation, identified analytics events)", ""]
    items = list(S["mau1000_dev1_payload10000_identified"]["costs"].keys())
    header = "| Line item | " + " | ".join(f"{mau // 1000}k MAU {dev}dev {pay // 1000 if pay < 1_000_000 else 1}{'KB' if pay < 1_000_000 else 'MB'}"
                                            for mau in (1000, 5000) for dev in (1, 2) for pay in (10_000, 100_000, 1_000_000)) + " |"
    lines.append(header)
    lines.append("| --- |" + " ---: |" * 12)
    for item in items:
        row = f"| {item} | " + " | ".join(f"{S[f'mau{mau}_dev{dev}_payload{pay}_identified']['costs'].get(item, 0):.2f}"
                                        for mau in (1000, 5000) for dev in (1, 2) for pay in (10_000, 100_000, 1_000_000)) + " |"
        lines.append(row)
    lines.append("| **Subtotal** | " + " | ".join(f"**{S[f'mau{mau}_dev{dev}_payload{pay}_identified']['subtotal_month']:.2f}**"
                                                for mau in (1000, 5000) for dev in (1, 2) for pay in (10_000, 100_000, 1_000_000)) + " |")
    lines.append("| Gap versus $50 | " + " | ".join(f"{S[f'mau{mau}_dev{dev}_payload{pay}_identified']['gap_vs_50']:.2f}"
                                                  for mau in (1000, 5000) for dev in (1, 2) for pay in (10_000, 100_000, 1_000_000)) + " |")
    lines.append("| Subtotal with anonymous analytics events instead | " + " | ".join(f"{S[f'mau{mau}_dev{dev}_payload{pay}_anonymous']['subtotal_month']:.2f}"
                                                                                   for mau in (1000, 5000) for dev in (1, 2) for pay in (10_000, 100_000, 1_000_000)) + " |")
    lines.append("| Subtotal at month 60 disk instead of month 12 | " + " | ".join(f"{S[f'mau{mau}_dev{dev}_payload{pay}_identified']['subtotal_plus_disk_month60']:.2f}"
                                                                               for mau in (1000, 5000) for dev in (1, 2) for pay in (10_000, 100_000, 1_000_000)) + " |")
    lines += ["", "### Sensitivities (USD/month)", "", "| Sensitivity | 1k MAU 1dev 10KB | 1k MAU 2dev 100KB | 5k MAU 1dev 100KB | 5k MAU 2dev 100KB | 5k MAU 2dev 1MB |", "| --- | ---: | ---: | ---: | ---: | ---: |"]
    cols = ["mau1000_dev1_payload10000_identified", "mau1000_dev2_payload100000_identified", "mau5000_dev1_payload100000_identified", "mau5000_dev2_payload100000_identified", "mau5000_dev2_payload1000000_identified"]
    for key in S[cols[0]]["sensitivities"]:
        vals = []
        for c in cols:
            v = S[c]["sensitivities"][key]
            vals.append(f"{v['charge']:.2f} (MTR {v['mtr']:,.0f})" if isinstance(v, dict) else f"{v:.2f}")
        lines.append(f"| {key} | " + " | ".join(vals) + " |")
    lines += ["", "### Growth fit ladder (each step is a proposal requiring a decision, not an accepted change)", "", "| Running subtotal | After |", "| ---: | --- |"]
    for st in out["fit_ladder_growth"]:
        lines.append(f"| {st['subtotal']:.2f} | {st['step']} |")
    lines += ["", "### Modelled crossing of the $40 alert and $50 target (100 KB results, identified events)", "", "| Devices | First MAU step above $40 | First MAU step above $50 | Points |", "| --- | ---: | ---: | --- |"]
    for k, label in (("crossing_1_device_100KB_identified", "1"), ("crossing_2_devices_100KB_identified", "2")):
        c = out[k]
        lines.append(f"| {label} | {c['alert_40_mau']} | {c['target_50_mau']} | " + ", ".join(f"{p['mau']}: {p['subtotal']:.2f}" for p in c["points"]) + " |")
    b = out["beta_overlap"]
    lines += ["", "### Beta/production overlap (temporary)", "", "| Item | Value |", "| --- | --- |",
              f"| Second Micro project for {b['overlap_days']} overlap days + {b['cleanup_days_after_shutdown']} cleanup days at $0.01344/h (no second compute credit) | ${b['second_micro_project_compute']:.2f} |",
              f"| Each additional overlap day | ${b['per_extra_overlap_day']:.3f} |",
              f"| Second project disk included | {b['second_project_disk_included_gb']:.0f} GB |",
              f"| Beta notices for {b['testers']} testers (entry + shutdown) | {b['beta_notice_emails']} emails; {b['notice_days_needed_at_free_daily_cap']} day(s) at the 100/day free cap |",
              f"| Export burst (each tester exports twice, 12 MB five-year history) | {b['beta_export_burst_gb']:.2f} GB; ${b['beta_egress_cost']:.2f} within the 250 GB allowance |",
              f"| Shutdown fencing, job cancellation, cleanup retries | {b['shutdown_fencing_and_cleanup_jobs']} |",
              f"| Total priced overlap | ${b['total_overlap_cost']:.2f} for the modelled window |"]
    lines += ["", "### Post-MVP subtotal (separate; not an MVP gate)", "", "| Case | DB GB | Dump GB (gzip ratio as measured) | Source transfer GB/month (daily full dump) | B2 stored GB (3 copies) | B2 storage $ | Supabase egress $ if beyond allowance | Executor (illustrative Lambda) $ | Priced subtotal $ |", "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |"]
    for k, v in out["post_mvp"].items():
        lines.append(f"| {k} | {v['db_gb']:.2f} | {v['dump_gb']:.3f} | {v['source_transfer_gb_month']:.1f} | {v['b2_stored_gb']:.2f} | {v['b2_storage']:.2f} | {v['supabase_egress_for_dumps']:.2f} | {v['executor_lambda_illustrative']:.2f} | {v['subtotal_priced']:.2f} |")
    lines.append(f"\nPITR alternative if ever adopted (7-day add-on plus Small compute beyond the credit): ${out['post_mvp']['launch_10KB_year1']['pitr_alternative_if_ever_adopted']:.2f}/month. AI operations and restore-exercise compute: unpriced.")
    return "\n".join(lines)


def main():
    import sys
    measured = measured_inputs()
    out = {"rates_checked": "2026-09-14", "rates": {k: v for k, v in RATES.items()}, "illustrative": ILLUSTRATIVE, "measured": measured,
           "scenarios": {}, "beta_overlap": beta_overlap(), "post_mvp": {}}
    for mau in (1000, 5000):
        for devices in (1, 2):
            for payload in (10_000, 100_000, 1_000_000):
                for ident in (True, False):
                    key = f"mau{mau}_dev{devices}_payload{payload}_{'identified' if ident else 'anonymous'}"
                    out["scenarios"][key] = scenario(mau, devices, payload, measured, identified_events=ident)
    for label, db_gb in (("launch_10KB_year1", out["scenarios"]["mau1000_dev1_payload10000_identified"]["disk"]["db_gb_month12"]),
                         ("launch_100KB_year1", out["scenarios"]["mau1000_dev1_payload100000_identified"]["disk"]["db_gb_month12"]),
                         ("growth_100KB_year1", out["scenarios"]["mau5000_dev1_payload100000_identified"]["disk"]["db_gb_month12"]),
                         ("growth_100KB_year5", out["scenarios"]["mau5000_dev1_payload100000_identified"]["disk"]["db_gb_month60"])):
        out["post_mvp"][label] = post_mvp(db_gb, measured.get("gzip_ratio", {}).get(100_000, 1.0) if isinstance(measured.get("gzip_ratio"), dict) else 1.0)
    out["fit_ladder_growth"] = fit_ladder(measured)
    out["crossing_1_device_100KB_identified"] = crossing(measured)
    out["crossing_2_devices_100KB_identified"] = crossing(measured, devices=2)
    with open(os.path.join(HERE, "results.json"), "w") as f:
        json.dump(out, f, indent=1)
    if "--markdown" in sys.argv:
        print(markdown(out))
        return
    # Summary tables for the research note.
    print(f"measured inputs: {measured['source']}")
    print("scenario | subtotal | gap vs $50 | disk m12 | egress GB | peak conns | msgs | emails | events | RC MTR")
    for key, s in out["scenarios"].items():
        c = s["costs"]
        print(f"{key} | ${s['subtotal_month']} | ${s['gap_vs_50']} | ${c['supabase_disk_month12_at_growth_rate']} | {s['egress']['uncached_gb']} | "
              f"{s['realtime']['peak_connections']} | {s['realtime']['messages_postgres_changes']} | {s['emails']} | {s['analytics_events']} | "
              f"${revenuecat(s['inputs']['subscribers_illustrative'], 0)['mtr']}")
    for key in ("mau1000_dev1_payload10000_identified", "mau5000_dev2_payload100000_identified"):
        print("\n" + key)
        for k, v in out["scenarios"][key]["costs"].items():
            print(f"  {k}: ${v}")
        print("  sensitivities:", json.dumps(out["scenarios"][key]["sensitivities"]))
        print("  disk:", json.dumps(out["scenarios"][key]["disk"]))
    print("\nfit ladder (growth):")
    for s in out["fit_ladder_growth"]:
        print(f"  ${s['subtotal']} after: {s['step']}")
    for k in ("crossing_1_device_100KB_identified", "crossing_2_devices_100KB_identified"):
        print(k, "alert $40 at MAU", out[k]["alert_40_mau"], "| target $50 exceeded at MAU", out[k]["target_50_mau"],
              "|", " ".join(f"{p['mau']}:${p['subtotal']}" for p in out[k]["points"]))
    print("\nbeta overlap:", json.dumps(out["beta_overlap"]))
    for k, v in out["post_mvp"].items():
        print("post-MVP", k, json.dumps(v))


if __name__ == "__main__":
    main()
