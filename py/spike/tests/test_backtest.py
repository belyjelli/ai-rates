import numpy as np
import pytest

from backtest import (
    DAY_MS,
    HOUR_MS,
    daily_net,
    leg_cashflows,
    settlement_times,
    summarize,
    synthetic_run,
)

DAY0 = 1_767_225_600_000  # 2026-01-01T00:00:00Z
EMPTY = (np.array([], dtype=np.int64), np.array([]))


def test_settlement_times_are_int64_epoch_ms():
    # Found in the Workers spike: on wasm32 the default numpy int is 32-bit and epoch-ms overflows.
    ts = settlement_times(DAY0, 3, 8)
    assert ts.dtype == np.int64
    assert ts.tolist() == [DAY0, DAY0 + 8 * HOUR_MS, DAY0 + 16 * HOUR_MS]


def test_hourly_long_vs_8h_short_hand_computed():
    long_cf = leg_cashflows(settlement_times(DAY0, 24, 1), np.full(24, 0.0001), np.full(24, 100.0), 1.0, "long")
    short_cf = leg_cashflows(settlement_times(DAY0, 3, 8), np.full(3, 0.0003), np.full(3, 100.0), 1.0, "short")

    days, daily = daily_net(long_cf, short_cf)

    # Long pays 24 x 0.01 = 0.24; short receives 3 x 0.03 = 0.09.
    assert days.tolist() == [DAY0]
    assert daily.tolist() == pytest.approx([-0.15])


def test_cashflows_bucket_by_utc_day():
    ts = np.array([DAY0 + 23 * HOUR_MS, DAY0 + DAY_MS, DAY0 + DAY_MS + HOUR_MS], dtype=np.int64)
    cf = leg_cashflows(ts, np.full(3, 0.0001), np.full(3, 100.0), 1.0, "short")

    days, daily = daily_net(cf, EMPTY)

    assert days.tolist() == [DAY0, DAY0 + DAY_MS]
    assert daily.tolist() == pytest.approx([0.01, 0.02])


def test_missing_settlement_is_not_forward_filled():
    short_ts = np.array([DAY0, DAY0 + 16 * HOUR_MS], dtype=np.int64)  # the 08:00 settlement is missing
    short_cf = leg_cashflows(short_ts, np.full(2, 0.0003), np.full(2, 100.0), 1.0, "short")

    _, daily = daily_net(EMPTY, short_cf)

    assert daily.tolist() == pytest.approx([0.06])


def test_cashflows_use_mark_at_settlement():
    _, values = leg_cashflows(settlement_times(DAY0, 2, 8), np.full(2, 0.0001), np.array([100.0, 200.0]), 2.0, "short")
    assert values.tolist() == pytest.approx([0.02, 0.04])


def test_summary_payback_never_when_not_profitable():
    long_cf = leg_cashflows(settlement_times(DAY0, 24, 1), np.full(24, 0.0001), np.full(24, 100.0), 1.0, "long")
    _, daily = daily_net(long_cf, EMPTY)
    summary = summarize(daily, one_time_costs=1.0)
    assert summary["payback_days"] is None
    assert summary["win_rate"] == 0.0


def test_rejects_unknown_side():
    with pytest.raises(ValueError):
        leg_cashflows(np.array([DAY0]), np.array([0.0]), np.array([1.0]), 1.0, "flat")


def test_synthetic_run_shape():
    result = synthetic_run(days=30)
    assert result["days"] == 30
    assert result["funding"] > 0  # short leg carries the positive expected rate
    assert result["payback_days"] is not None
