# Ranking evaluation — pre-registration

**Written 2026-09-15, before any variant's realised return was computed.** `ranking-system-design.md`
§6 fixes the success criteria and says they "are not to be revised after looking". It does not fix how
they are computed from stored data. This document fixes that, so the evaluation is a test rather than a
choice made after seeing numbers.

Everything below was decided from **integrity and feasibility** checks only:
- the candidate table's shape;
- that each night stores exactly one pick per variant per asset;
- that the daily funding fold covers the window.

No variant's realised funding, cost or turnover was looked at. The evaluator (`packages/core/src/ranking-eval.ts`)
was written and tested on synthetic data only.

After the first real run, this file changes only through §9.

---

## 1. What exists

- **Candidates.** `market_pair_candidates` (migration 018), written nightly by `refreshRankedPairs`. It
  stores one row per candidate pair and one boolean per pre-registered variant:

  | variant | flag |
  | --- | --- |
  | A widest | `chosen_widest` |
  | B settled | `chosen_settled` |
  | C shrunk | `chosen_shrunk` |
  | D hysteresis | `chosen_hysteresis` |
  | E capacity | `chosen_capacity` |

  Each row also carries `deployable_usd`, which is 2% of the thinner leg's open interest.
- **Coverage, checked 2026-09-15.**
  - The first run day is **2026-09-14**.
  - Run days 2026-09-14 (1,411 assets) and 2026-09-15 (1,405 assets) each have exactly one pick per
    variant per asset.
  - Run day 2026-09-14 was written by the Bun collector and 2026-09-15 onward by its Go port, which
    reproduces the same arithmetic (`plans/go-collector.md` §10).
- **Realised funding.** `market_funding_daily` holds one row per market per UTC day: `rate_sum`, the
  sum of settled rates, as fractions of notional. It is re-folded hourly over a 70-day lookback, so
  settlements backfilled late still land in their day.

## 2. Departures from the design, stated as departures

1. **Earliest evaluation is 2026-09-29 06:00Z, not 2026-09-26.** The design assumed instrumentation
   before 2026-09-14. Data starts on 2026-09-14, and two non-overlapping 7-night windows plus each
   final held day need data through 2026-09-28.
2. **There is no cross-asset ranking.** The table does not store variant A's live spread, so no
   variant can be ordered across assets the same way. Every variant therefore holds **every** asset's
   selected pair at that pair's deployable size. Returns are normalised per $1M of capital, so the
   comparison measures which pair each variant selects, weighted by how much money that pair can
   hold. That is the question the flags answer.

## 3. Definitions, fixed in advance

- **Windows.** Two non-overlapping 7-night windows:
  - **W1:** run days 2026-09-14 to 2026-09-20.
  - **W2:** run days 2026-09-21 to 2026-09-27.
- **Held day.** A pick made on run day *d* earns the settled funding of UTC day *d + 1*. The job runs
  within day *d*, so no settlement it could not have seen is used to choose.
- **Position size.** `deployable_usd` of the picked row. A row with unknown depth has size 0.
- **Gross.** For each position, each held day: `size × (short leg rate_sum − long leg rate_sum)`.
  Positive funding is paid by longs to shorts.
  - A leg with no fold row for the day counts as 0 and is reported in `missingLegDays`. Nothing is
    imputed.
- **Costs.** Four taker fills at 5 bps round-trip a pair, so opening or closing a pair (both legs)
  costs `0.001 × size`. On each night after a window's first:
  - **Pair changed:** `0.001 × previous size + 0.001 × new size`.
  - **Asset newly held:** `0.001 × new size`.
  - **Asset no longer held:** `0.001 × previous size`.
  - **Same pair, different size:** no cost. This simplification is applied equally to every variant.
- **Formation night.** Each window's first night forms the book: no costs are charged into it, and
  its held-day funding counts. Both windows are formed the same way for every variant, so they are
  scored independently.
- **Capital.** Mean over the window's 7 nights of total size held.
- **Per $1M.** `metric ÷ mean capital × 1,000,000`, for net (gross − costs) and for gross.
- **Turnover.** For each night after the first:
  - take the assets held both that night and the night before;
  - count the fraction whose picked pair changed.

  The window's turnover is the mean over its 6 transitions.

## 4. The evaluator

`evaluateWindow(start, picks, rates)` computes §3 for one window; `decide(windows)` applies §6. Both are
pure and tested on hand-computed synthetic cases in `ranking-eval.test.ts`. The extraction queries and
the runner are in `scripts/ranking-eval/`.

## 5. Validity — a window is invalid, not estimated, when

- a run day has no picks for any variant (a missed nightly run);
- a variant picks twice for one asset on one night;
- the variants disagree on which assets they pick for on a night;
- a held day has no fold rows at all.

An invalid window is not repaired. The evaluation moves to the next complete 7-night window, and
this document records the substitution in §9 before that window is run.

## 6. Decision rule — the design's criteria, operationalised

For each variant *v* in B–E, in **every** window:

1. **Primary:** net per $1M of *v* must be greater than net per $1M of A.
2. **Turnover guardrail:** turnover of *v* ≤ 0.30.
3. **Yield guardrail:** gross per $1M of *v* ≥ gross per $1M of A − 0.25 × |gross per $1M of A|.
   The absolute value keeps the rule meaningful if the control's gross is negative.

A variant that passes all three in every window is eligible.
- **The winner** is the eligible variant with the highest mean net per $1M across windows.
- **Ties** go to higher mean capital (the design's tie-break: deployable dollars at 2% participation),
  then to the earlier, simpler variant in A–E order. The design says to ship D, not the whole stack,
  when D wins.
- **If no variant is eligible, nothing is promoted, and the result is reported as such.**

## 7. Known limitations, stated before the result

- Funding only. Price moves between legs, basis drift and liquidation risk are not modelled.
- Fees are the retail 5 bps taker assumption the job uses, not any client's tier.
- Two windows are the minimum; the design prefers four. The rule has no significance test, because the
  design's rule is deterministic. A result is evidence for this fortnight, not a law.
- Resizing is free, and 2% participation assumes no market impact.
- The hysteresis constants (`BAND_CUBE_ROOT_C = 0`, a four-week horizon) are the pre-registered
  defaults. Calibrating `c` is a later step and must not happen on these windows.

## 8. Reproduction

See `scripts/ranking-eval/README.md`: extract `picks.csv` and `rates.csv` read-only on hklab, then
`bun scripts/ranking-eval/evaluate.ts picks.csv rates.csv`. The runner refuses to start before
2026-09-29 06:00Z.

## 9. Amendments

None.
