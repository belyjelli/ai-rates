"""L3 estimator: does a liquidation move predicted funding?

Implements section 5 of plans/phase4-l3-preregistration.md and nothing else. The specification was
committed before this was ever run; if a choice here is not in the specification, it is a bug.

    python3 py/l3/analyse.py events.csv

Reads the CSV produced by extract.sql. Needs numpy, pandas and scipy only -- no statsmodels, because
the estimator is a bootstrap over markets rather than a regression (see the specification for why).
"""

from __future__ import annotations

import sys

import numpy as np
import pandas as pd

BOOTSTRAP = 10_000
# Pre-registered power floor. A cluster bootstrap over a handful of clusters invents intervals:
# coin-flip noise across three markets returned -0.4167 [-0.5000, -0.2500]. See section 6.
MIN_MARKETS = 10
SEED = 20260913  # Fixed so the interval is reproducible, not shopped for.


def per_market_means(events: pd.DataFrame, side: str) -> pd.Series:
    """Mean DiD per market for one side. Step 2 of the estimator."""
    subset = events[events["side"] == side]
    key = subset["venue_id"] + "\t" + subset["venue_symbol"]
    return subset.groupby(key)["did"].mean()


def bootstrap_ci(values: np.ndarray, rng: np.random.Generator) -> tuple[float, float]:
    """95% interval by resampling MARKETS, which is the cluster (step 4)."""
    if len(values) < 2:
        return (float("nan"), float("nan"))
    draws = rng.choice(values, size=(BOOTSTRAP, len(values)), replace=True).mean(axis=1)
    return (float(np.percentile(draws, 2.5)), float(np.percentile(draws, 97.5)))


def report_side(events: pd.DataFrame, side: str, rng: np.random.Generator) -> dict:
    means = per_market_means(events, side)
    values = means.to_numpy()
    estimate = float(values.mean()) if len(values) else float("nan")
    low, high = bootstrap_ci(values, rng)

    # Step 5: one market holds ~29% of all events, so the result must survive its removal.
    loo_estimate = float("nan")
    if len(values) > 1:
        biggest = per_market_counts(events, side).idxmax()
        without = means.drop(index=biggest, errors="ignore").to_numpy()
        loo_estimate = float(without.mean()) if len(without) else float("nan")

    subset = events[events["side"] == side]
    return {
        "side": side,
        "events": int(len(subset)),
        "markets": int(len(values)),
        "estimate": estimate,
        "ci_low": low,
        "ci_high": high,
        "leave_one_out": loo_estimate,
        # Pre-trend diagnostic: a directional pre-window means the DiD is contaminated.
        "mean_pre": float(subset["d_pre"].mean()) if len(subset) else float("nan"),
        "zero_post_pct": (
            100.0 * float((subset["d_post"] == 0).mean()) if len(subset) else float("nan")
        ),
    }


def per_market_counts(events: pd.DataFrame, side: str) -> pd.Series:
    subset = events[events["side"] == side]
    key = subset["venue_id"] + "\t" + subset["venue_symbol"]
    return subset.groupby(key)["did"].size()


def main(path: str) -> int:
    events = pd.read_csv(path)
    if events.empty:
        print("no events extracted -- nothing to estimate")
        return 1

    # Section 3: the three boundaries become two changes and one difference-in-differences.
    events["d_post"] = events["apr_post"] - events["apr_0"]
    events["d_pre"] = events["apr_0"] - events["apr_pre"]
    events["did"] = events["d_post"] - events["d_pre"]

    # Section 3 sample floor: markets with at least five events.
    key = events["venue_id"] + "\t" + events["venue_symbol"]
    keep = key.map(key.value_counts()) >= 5
    dropped = int((~keep).sum())
    events = events[keep]

    rng = np.random.default_rng(SEED)
    print(f"events {len(events)}  (dropped {dropped} in markets with fewer than 5)")
    print(f"markets {events.groupby([events.venue_id, events.venue_symbol]).ngroups}")
    print()
    print("APR points, predicted funding. Negative = predicted funding fell after the event.")
    print(f"{'side':<6} {'events':>7} {'markets':>8} {'DiD':>9} {'95% CI':>22} {'leave-1-out':>12} {'pre':>8} {'zero%':>7}")

    results = []
    for side in ("long", "short"):
        r = report_side(events, side, rng)
        results.append(r)
        # An uncomputable figure prints as n/a rather than nan: nan in a results table invites
        # being read as a number.
        ci = (
            "n/a"
            if np.isnan(r["ci_low"])
            else f"[{r['ci_low']:+.4f}, {r['ci_high']:+.4f}]"
        )
        loo = "n/a" if np.isnan(r["leave_one_out"]) else f"{r['leave_one_out']:+.4f}"
        print(
            f"{r['side']:<6} {r['events']:>7} {r['markets']:>8} {r['estimate']:>+9.4f} "
            f"{ci:>22} {loo:>12} {r['mean_pre']:>+8.4f} {r['zero_post_pct']:>6.1f}%"
        )

    print()
    # Section 6, applied mechanically rather than by eye.
    #
    # A criterion that CANNOT be evaluated has to say so out loud. With one market there is no
    # bootstrap interval and no leave-one-out, and the first version of this block stayed silent in
    # that case -- which reads exactly like "passed" -- while also printing a FRAGILE line, because
    # sign(nan) != sign(estimate) is true. Both were found by the synthetic smoke test.
    for r in results:
        if r["markets"] < 2:
            print(
                f"INSUFFICIENT: the {r['side']} side has {r['markets']} market(s), so no interval "
                "and no leave-one-out exist. Neither confirmed nor falsified."
            )
            continue
        if r["markets"] < MIN_MARKETS:
            # Demonstrated, not assumed: coin-flip noise across three markets produced
            # -0.4167 [-0.5000, -0.2500], an interval excluding zero from data with no effect.
            print(
                f"UNDERPOWERED: the {r['side']} side has {r['markets']} markets, below the "
                f"pre-registered floor of {MIN_MARKETS}. Its interval is not evidence."
            )
        if r["ci_low"] < 0 < r["ci_high"]:
            print(f"NULL: the {r['side']} interval spans zero.")
        if not np.isnan(r["leave_one_out"]) and np.sign(r["leave_one_out"]) != np.sign(
            r["estimate"]
        ):
            print(f"FRAGILE: the {r['side']} sign flips when the largest market is removed.")

    # Only sides that were actually evaluable can contradict each other.
    usable = [r for r in results if r["markets"] >= 2 and not np.isnan(r["estimate"])]
    signs = [np.sign(r["estimate"]) for r in usable]
    if len(signs) == 2 and signs[0] == signs[1] and signs[0] != 0:
        print("FALSIFIED: long and short share a sign -- consistent with both tracking price.")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        raise SystemExit(2)
    raise SystemExit(main(sys.argv[1]))
