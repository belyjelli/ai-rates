# L3 pre-registration — do liquidations move predicted funding?

**Written 2026-09-13, before any estimate was produced.** The Phase 4 plan is explicit that an
unregistered study "will find whatever it is asked to find", and it already pre-registered the 8.06%
sign-flip base rate for that reason. This document fixes the specification.

Everything below was decided from **feasibility** measurements only — coverage, cadence, how often
the outcome is observable, how much control supply exists. No measurement of *direction* or *effect*
informed any choice here, and the estimator had not been run when this was committed.

After the first estimate is run, this file changes only through §9.

---

## 1. Why this departs from the plan's method sketch

The plan proposed a panel regression at **settlement** resolution: liquidation notional and count as
regressors, outcome the funding change or sign flip "in the next N settlements". Gate and Bybit
settle 8-hourly, so 1.5 days of liquidation history yields about **four settlements per market**. No
amount of liquidation volume repairs that — the constraint binds on the outcome, not the regressor.

`funding_snapshots` samples every market every **60 seconds** and stores the venue's *predicted*
rate, which drifts between settlements. So the outcome is measured at minute resolution and the
estimator is an **event study**, not a settlement panel. This is a deliberate departure and is
recorded as one.

**What this can claim.** The predicted rate is the venue's own forward estimate, not a settled
payment. A move in it is a move in what the market expects to pay — the quantity a trader reacts
to — but it is not proof a realised settlement changed. Results say **"predicted funding"**, never
"funding paid".

## 2. Data, and the measurements that shaped the design

- **Events:** `liquidations`, 15,120 rows, 2026-09-11 21:45Z → 2026-09-13 09:34Z, venues gate + okx.
- **Series:** `funding_snapshots`, 12.58M rows, 2026-09-11 18:27Z → 2026-09-13 09:39Z, 60s cadence,
  index `funding_snapshots_market (venue_id, venue_symbol, observed_at DESC)`.
- Snapshots start 3h18m before the first liquidation: **0 events left-truncated**. 659 of 15,120
  (4.4%) fall within 30 minutes of the series end and are **excluded**.

**The predicted rate moves, but only in some markets.** Counting actual changes (not distinct
values): mean **10.7–15.8 changes/hour**, median **0**. Over 6 hours, 530 of 970 gate markets and
280 of 479 okx markets never changed at all. So a market-liveness gate is mandatory, and it is cheap:
**5,366 of 6,066 events (88%)** already sit in markets changing ≥6 times per 6 hours.

**Window chosen blind.** Share of gated events whose outcome moved at all: **10m 54.6%, 30m 58.4%,
60m 60.3%, 120m 54.2%** (120m loses 42% of events to truncation, which is why it falls). The curve
is flat, so **30 minutes** is fixed — longer buys nothing and costs sample. This was measured with
no split by side and no signed statistic.

## 3. Definitions, fixed in advance

- **Event.** One `liquidations` row. Rows sharing `(venue_id, venue_symbol, minute)` collapse into
  one event; `notional_usd` sums; `side` is the side with the larger summed notional; ties dropped.
- **`t`** is the event's floored minute.
- **`apr(x)`** is `rate / basis_hours * 876000` at the nearest snapshot at or before `x` — the
  project's existing conversion, not a new one.
- **Post change:** `Δpost = apr(t+30m) − apr(t)`. **Pre change:** `Δpre = apr(t) − apr(t−30m)`.
- **Primary statistic (per event):** `DiD = Δpost − Δpre`.
- **Price diagnostics:** `Δmark_post`, `Δmark_pre`, same boundaries.
- **Sample.** Markets with **≥5 events** *and* **≥6 rate changes per 6h**. An event missing any of
  the three snapshot boundaries is dropped.

## 4. Hypothesis, with a direction

Forced closes push price and positioning the same way. A cascade of **long** liquidations is forced
selling: the perp trades below index, so predicted funding should **fall**. Short liquidations should
push it **up**.

- **H1 (primary, directional):** mean `DiD` is **negative** for long-liquidation events and
  **positive** for short-liquidation events.
- **H0:** mean `DiD` is zero on both sides.

**One primary specification**: `DiD` at 30 minutes, sample per §3, estimator per §5, long and short
reported **separately**. Horizons of 10 and 60 minutes are **secondary robustness only** and may not
be promoted to the headline whatever they show.

## 5. Estimator

Difference-in-differences within each event, aggregated by market:

1. Per event, `DiD = Δpost − Δpre`. Using the event's own pre-window as its control means market and
   event fixed effects are automatic, and — unlike a matched clean window — **no market is dropped**.
2. Per market and side, the mean `DiD`.
3. Across markets, the unweighted mean of those per-market means.
4. **Bootstrap over markets, 10,000 resamples**, for a 95% interval. Markets are the cluster.
5. **Leave-one-market-out**, because one market holds **28.8%** of all events. If excluding it flips
   the sign or spans zero, the result is reported as driven by a single market.

**Why not a matched clean-window control as primary.** 166 of 451 live markets (37%) have *no* minute
without a liquidation within ±30m, and they hold 31% of events — the busiest markets, where any
effect should be largest. Selecting on that is selecting on treatment intensity. The matched design
therefore becomes a planned amendment (§9) once more calendar time supplies clean windows.

**Why not clustered OLS.** 1.5 days of 60-second observations are heavily autocorrelated; OLS would
report intervals far tighter than the information present. `statsmodels` being absent locally is
convenient, not the reason.

**Pre-trend diagnostic.** `Δpre` is reported by side. If it is already directional before the event,
the DiD is contaminated and the write-up must say so.

## 6. What would falsify H1

- The bootstrap interval for either side spans zero.
- Long and short effects **share a sign** — more consistent with both tracking price than with
  positioning pressure.
- Leave-one-market-out flips the sign.
- `Δpre` is directional, indicating a pre-trend rather than a response.

**A side with fewer than two markets is `INSUFFICIENT`**, not null and not fragile: with one market
there is no bootstrap interval and no leave-one-out, so the side is neither confirmed nor falsified
and must be reported as unevaluated. This matters because short events are far rarer than long ones,
so a thin short side is a likely outcome rather than an edge case.

**A side with fewer than ten markets is `UNDERPOWERED`** and its interval may not be read as
evidence, whatever it says. Fixed here, while still blind to every real estimate, because choosing
this floor after seeing a result would be a researcher degree of freedom. The number is not
arbitrary: a smoke test on **pure coin-flip noise** across three markets produced an estimate of
−0.4167 with a bootstrap interval of [−0.5000, −0.2500] — excluding zero, from data containing no
effect whatsoever. A cluster bootstrap over a handful of clusters manufactures confident-looking
findings, and this study's own design makes small market counts likely.

**A null is the expected outcome and is publishable.** The plan's warning is against a study that
cannot fail.

## 7. Known limitations, stated before the result

- **~40% of events have `Δpost` exactly zero** even after the liveness gate. Zeros are retained: they
  are real "no move" information, and they pull the estimate toward the null, making the test
  conservative. It also means the **median is 0 by construction**, so the mean is the only usable
  central statistic.
- **Concentration.** Mean 26.6 events/market but **median 3**; one market holds 28.8% of events.
  Hence the bootstrap over markets and the leave-one-out.
- **1.5 days, one regime.** A pilot, not an estimate of a stable relationship.
- **Two venues**, gate and okx. No Bybit or Hyperliquid liquidation feed exists yet.
- **Predicted, not settled**, funding — §1.
- **De-duplication understates busy minutes.** Migration 012 keys on the event's own content, so two
  identical liquidations in one second collapse. Cascades are exactly when that happens, so treatment
  intensity is understated and the estimate is conservative in magnitude.

## 8. Reproduction

`py/l3/extract.sql` produces one row per event; `py/l3/analyse.py` computes §5. See `py/l3/README.md`.

## 9. Amendments

- *(none yet)*

**Pre-commit revision history.** A first draft of this file specified a matched clean-window control,
a median-based estimator, and claimed the predicted rate "moves once per 4–8 minutes". All three were
wrong and were corrected **before commit and before any estimate**, by the feasibility measurements
in §2 and §5: the rate's median change count is 0/hour (I had read distinct values, not changes), the
median outcome is 0 so a median estimator returns 0 by construction, and 37% of live markets have no
clean control window at all.

A synthetic smoke test of `analyse.py` — run on fabricated rows with a known answer, never on real
events — then found two defects in the mechanical §6 logic before any real estimate existed: a side
with one market produced a `nan` interval that **silently suppressed the NULL verdict** (silence
reading as "passed"), and simultaneously emitted a false `FRAGILE`, because `sign(nan)` never equals
`sign(estimate)`. Both are fixed, and the `INSUFFICIENT` rule above was added in response.
