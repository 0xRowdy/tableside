"""Offline planning arithmetic, not a measured capacity model. See linked research note."""

import json
import math


def packages(usage, included, size, price):
    return math.ceil(max(0, usage - included) / size) * price


def revenuecat(monthly_transactions, annual_transactions):
    mtr = monthly_transactions * 5.99 + annual_transactions * 39.99
    return {"mtr": round(mtr, 2), "charge": round(mtr * 0.01 if mtr >= 2500 else 0, 2)}


def lambda_cost(requests, seconds=0.1, memory_gib=0.125, free=True):
    # Conservative uncompressed logs retained for 30 days, one scan/month.
    gb_seconds = requests * seconds * memory_gib
    bytes_gib = requests * 1024 / 2**30
    cost = max(0, requests - (1e6 if free else 0)) * 0.20 / 1e6
    cost += max(0, gb_seconds - (400000 if free else 0)) * 0.0000166667
    cost += max(0, bytes_gib - (100 if free else 0)) * 0.09
    cost += max(0, bytes_gib - (5 if free else 0)) * (0.50 + 0.03 + 0.005)
    return round(cost, 4)


def scenario(mau, devices):
    retry = 1.2
    sessions = mau * 20
    minutes = sessions * 20
    subscribers = mau // 10
    # Daily and stale foreground checks deliberately not assumed to coalesce.
    store_checks = subscribers * (30 + 10 + 2)
    webhooks = subscribers * 2
    grants = mau * 10
    transfers = mau // 10
    withdrawals = mau // 100
    deletes = mau // 100
    exports = mau // 10
    changes = sessions + grants + transfers + withdrawals + store_checks + deletes
    calls = {
        "reconcile": minutes * devices,
        "open_reconnect": sessions * devices,
        "auth_refresh": mau * 10 * devices,
        "result_acceptance": sessions,
        "grant_transfer_withdrawal": grants + transfers + withdrawals,
        "notification_fetch": changes * devices,
        "billing_webhook_ingress": webhooks,
        "store_verification_job": store_checks,
        "export_and_bootstrap_create": exports * 2,
        "deletion_request_and_cleanup": deletes * 2,
        "hourly_expiry_sweep": 720,
    }
    calls = {key: round(value * retry) for key, value in calls.items()}
    backend = sum(calls.values())
    probes = round((minutes * 2 + sessions) * devices * retry)
    messages = round(changes * (1 + devices) * retry)
    emails = round(mau * 2 * retry)
    events = round((sessions * 10 + 3000) * retry)
    costs = {
        "supabase_pro_micro": 25,
        "workers_at_1ms_cpu_per_probe": round(5 + max(0, probes - 1e7) * 0.30 / 1e6
                                                 + max(0, probes - 3e7) * 0.02 / 1e6, 4),
        "realtime_peak": packages(mau // 10 * devices, 500, 1000, 10),
        "realtime_messages": packages(messages, 5e6, 1e6, 2.50),
        "resend_capacity": 0 if emails <= 3000 else 20,
        "posthog_analytics_starting_rate": round(max(0, events - 1e6) * 0.00005, 2),
        "posthog_errors_at_1000_per_month": 0,
        "lambda_1pct_fallback_remaining_free": lambda_cost(probes * 0.01),
        "revenuecat_all_monthly": revenuecat(subscribers, 0)["charge"],
    }
    return {
        "mau": mau, "devices": devices, "backend_calls_before_pages_chunks": backend,
        "calls_by_operation": calls, "primary_probe_attempts": probes,
        "messages": messages, "peak_connections": mau // 10 * devices,
        "email_attempts": emails, "analytics_events": events,
        "costs_before_disk_storage_egress_edge_other": costs,
        "subtotal": round(sum(costs.values()), 2),
        "all_backend_calls_through_edge_increment": packages(backend, 2e6, 1e6, 2),
        "lambda_all_primary_failed_remaining_free": lambda_cost(probes),
        "lambda_all_primary_failed_no_free": lambda_cost(probes, free=False),
        "lambda_1second_all_primary_failed_remaining_free": lambda_cost(probes, seconds=1),
        "workers_10ms_increment": round(max(0, probes * 10 - 3e7) * 0.02 / 1e6, 4),
        "new_result_gb_per_month": {str(size): sessions * size / 1e9 for size in (10000, 100000, 1000000)},
        "revenuecat_annual_cohort": revenuecat(0, subscribers),
    }


if __name__ == "__main__":
    print(json.dumps([scenario(mau, devices) for mau in (1000, 5000)
                      for devices in (1, 2)], indent=2))
