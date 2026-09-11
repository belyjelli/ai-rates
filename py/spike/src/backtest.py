"""Funding-only backtest math for the Python Worker spike.

Follows the rules in plans/development-plan.md: each leg's cashflows are summed at its own
settlement times (no resampling or forward-fill), then bucketed by UTC day.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

HOUR_MS = 3_600_000


def settlement_times(start_ms: int, count: int, step_hours: float) -> np.ndarray:
    """Epoch-ms settlement timestamps as int64.

    Python Workers run on wasm32, where numpy's default integer is 32-bit, so epoch-ms arithmetic
    on a plain np.arange overflows there even though it works on 64-bit CPython.
    """
    return np.int64(start_ms) + np.arange(count, dtype=np.int64) * np.int64(step_hours * HOUR_MS)


def leg_cashflows(
    settled_at_ms: np.ndarray,
    rates: np.ndarray,
    marks: np.ndarray,
    qty: float,
    side: str,
) -> pd.Series:
    """Per-settlement funding cashflow in quote currency. A positive rate means longs pay."""
    if side not in ("long", "short"):
        raise ValueError(f"side must be 'long' or 'short', got {side!r}")
    sign = -1.0 if side == "long" else 1.0
    index = pd.to_datetime(settled_at_ms, unit="ms", utc=True)
    return pd.Series(sign * qty * marks * rates, index=index)


def daily_net(long_cashflows: pd.Series, short_cashflows: pd.Series) -> pd.Series:
    combined = pd.concat([long_cashflows, short_cashflows])
    return combined.groupby(combined.index.floor("D")).sum().sort_index()


def summarize(daily: pd.Series, one_time_costs: float) -> dict:
    days = int(daily.size)
    funding = float(daily.sum())
    avg_daily = funding / days if days else 0.0
    return {
        "days": days,
        "funding": funding,
        "net": funding - one_time_costs,
        "avg_daily": avg_daily,
        "win_rate": float((daily > 0).mean()) if days else 0.0,
        "payback_days": one_time_costs / avg_daily if avg_daily > 0 else None,
    }


def synthetic_run(days: int = 30, seed: int = 7, size: float = 10_000.0) -> dict:
    """Long an hourly-settling venue, short an 8h venue, on synthetic rates."""
    rng = np.random.default_rng(seed)
    start = 1_767_225_600_000  # 2026-01-01T00:00:00Z
    mark = 100_000.0
    qty = size / mark

    long_ts = settlement_times(start, days * 24, 1)
    short_ts = settlement_times(start, days * 3, 8)
    long_cf = leg_cashflows(
        long_ts, rng.normal(-0.00001, 0.00002, long_ts.size), np.full(long_ts.size, mark), qty, "long"
    )
    short_cf = leg_cashflows(
        short_ts, rng.normal(0.0002, 0.0001, short_ts.size), np.full(short_ts.size, mark), qty, "short"
    )
    taker_fees = 4 * size * 0.0005  # entry + exit on both legs
    return summarize(daily_net(long_cf, short_cf), taker_fees)
