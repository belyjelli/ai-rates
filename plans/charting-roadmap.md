# Charting roadmap — what the funding data can already draw

Written 2026-09-14, after two proposals arrived in the same session: a **perp fund-flow signal** for
6-hour market direction, and **CVD**. Both are answered here, and the answers turned into an
inventory: given what this system already stores, which charts are cheap, which are differentiated,
and which need infrastructure that does not exist.

Every figure is quoted with where it came from so a later reader can re-run it rather than trust it.
Where something is an opinion, it says so. Two of my own earlier claims are corrected below.

---

## 1. The two proposals

### 1a. Fund flow (ΔOI + funding delta) for a 6-hour direction call — **not as a direction product**

**The data is genuinely in hand.** `funding_snapshots` (001_init.sql:27) carries `mark_price`,
`index_price`, `open_interest_usd` and `volume_24h_usd` for every market on a 60-second cadence —
measured 2026-09-13 at 8,091,482 rows spanning 1.05 days, ~324k rows/hour, `mark_price` present on
every row. Signed flow is ΔOI in base units at a held mark, against the funding side. Marginal
ingestion cost is **zero**. That is the same correction already applied to top-of-book in Phase 4:
the substrate was never built, and the data turned out to be in hand.

**Three things stand between that and a signal.**

1. **Retention is deleting it.** `funding_snapshots` compresses after 1 day and drops after 30
   (001_init.sql:48-49), and unlike `funding_events` it **cannot be backfilled** — venues publish
   historical funding, not historical open interest. Live collection began 2026-09-11. So the
   evaluation window is capped at 30 rolling days and will contain one or two regimes, forever.
2. **This study has already been run once and returned a well-powered null.** L3
   (`plans/phase4-l3-preregistration.md`, pre-registered at `e075a5e` before the estimator saw data):
   liquidations → predicted-funding change at 30 minutes, 3,749 events across 175 markets. Long DiD
   **+6.3290 [−6.3714, +18.7149]**, short **−1.7469 [−14.1940, +9.6909]** — both intervals span zero,
   leave-one-market-out moves nothing. And the pre-trend fired loudly on both sides (**−6.53**,
   **−9.94**): funding was already falling before the events. That pre-trend is exactly the confound
   a flow→direction model walks into, because OI, funding, liquidations and price are all driven by
   the same thing. Any new study pre-registers its base rate first, as the **8.06%** 30-day funding
   sign-flip rate already was.
3. **ΔOI is not flow until the units are right.** Differencing `open_interest_usd` directly makes a
   5% price move read as 5% of "flow" with no position change. It has to be differenced in base units
   at a held mark. This project has been bitten by units three times — OKX tier bounds (3 orders of
   magnitude), liquidation `size` vs `order_size` (167/167 sign-inverted), top-of-book sizes
   (10,000× across gate/okx/bybit).

**Verdict.** Not a market-direction product: it does not move the binding commercial constraint
(§1 of [`ranking-system-design.md`](ranking-system-design.md) — $7.96M total capacity, ~$1.24M/yr
profit pool), and PMF §5's buyer is delta-neutral holding days to weeks. **Reframed as a carry
input it is worth building**: does signed flow predict a funding sign flip or a stability break at
6–24h? That feeds Layer B's asymmetric *exit* band, which today has no early-warning input at all
and is listed there as an unmeasured risk. Same signal, pointed at a decision the customer pays for.

### 1b. CVD — **no, and the blocker is structural rather than effort**

CVD is `Σ(taker buy − taker sell)` and needs a per-trade tape with **aggressor side**. Nothing here
has ever ingested a trade.

- **The adapter contract is the wrong shape.** `VenueAdapter` (`packages/adapters/src/types.ts:41-75`)
  is whole-venue REST sweeps on periodic tasks: `fetchSnapshots` at 60s, `fetchLeverageTiers?` daily,
  `fetchLiquidations?` every 5 minutes. The optional hooks' own comments explain the choice — one
  call covers the venue. A trade tape is per-market, continuous and unbounded.
- **REST cannot do it.** `recentTrades` returns the last N trades; at BTCUSDT volume most are missed
  between 60s polls, and a CVD with holes is not a noisy CVD, it is a different series.
- **So it is WebSockets, and no WebSocket client exists in this repo.** `phoenix.ts` and `perpl.ts`
  mention WS only in comments. Phase 6 is where WS streams are parked.
- **Volume lands on a shared instance.** `vaultdeck` shares TimescaleDB with 16 other tenants and
  already needed its background-worker pool raised 16 → 24 before compression policies would run.
  Trades are an order of magnitude past 8M snapshot rows/day and would have to be bucketed to
  1-minute signed notional at ingest, never stored raw.
- **Realistic scope** is therefore ~20–50 assets on 3–5 venues through a new long-lived process —
  not an adapter hook.

**And the buyer does not use it.** CVD is a discretionary entry-timing tool. It would be the first
thing in the system *requiring* sub-minute data, which re-opens the latency question PMF §5 settled.
Acquisition funnel at best, at higher infrastructure cost than the liquidation heatmap or whale
tracking, both of which are already parked there.

**The honest partial substitute, already available.** What people actually want from CVD — *is this
move new positions or closing ones* — is largely the OI-vs-price quadrant reading, derivable today
from `funding_snapshots`: price up + OI up = new longs, price up + OI down = shorts covering. It is
**not CVD and must never be labelled CVD**: with no aggressor side it cannot say who initiated. It
answers the same question for the carry customer at zero ingestion cost.

---

## 2. Correction to my own claim, recorded because it was nearly written into this plan

I said `index_price` was "entirely dead data". **Wrong on the read path.** Migration `020` made
`screener_pairs` compare `coalesce(mark_price, index_price)` for both the anchor and every candidate,
because HTX (337 swaps) and BitMart (228 perps) publish **no mark in any bulk call** and would
otherwise pass 016's identity gate unexamined. `index_price` is load-bearing in SQL.

What is true is narrower and still the opening for a chart: it is **never selected by `data.ts` and
never rendered on any page**, so no reader has ever seen it. And 020's own header supplies the prior
the basis chart needs — "mark and index differ by the funding basis, a fraction of a percent" — while
also naming the coverage hole: on HTX and BitMart the mark is null, so basis is **uncomputable
there** and the chart must say so rather than drop those venues silently.

---

## 3. The constraint that gates half this roadmap

**There are 14 tables and not one holds price, open interest, or basis over time.** The only
rollups are funding: `market_funding_daily` (008) and `market_funding_hourly` (014, retained 8 days
by `refreshHourlyFunding(retainDays = 8)`, `store.ts:340`). `liquidations` (012) compresses at 60
days and drops at 120 (012:53,55). Everything else with a price in it lives in `funding_snapshots`,
which drops at 30 days and cannot be backfilled.

**So the unlock for four of the seven charts below is one migration:** an hourly rollup carrying
`mark`, `index` and `open_interest_usd` per market, folded incrementally in the shape of 008/014 and
retained past 30 days. It should be built **before** any of the analysis, because every hour it does
not exist is an hour permanently lost — and it is cheap, with no new requests and no new ingestion.

---

## 4. The charts, ranked

| # | chart | data | new ingestion | serves |
| --- | --- | --- | --- | --- |
| 1 | **Basis (mark − index)** | `funding_snapshots.mark_price`, `.index_price` | none | both |
| 2 | **Capacity curve** | `market_pair_candidates` (018) | none | fund |
| 3 | **Predicted vs settled** | `.kind` + `funding_events` | none | trust |
| 4 | **Settlement clock** | `next_funding_at`, `interval_hours` | none | fund |
| 5 | **Liquidation event-time** | `liquidations` (012) | none | acquisition |
| 6 | **Churn / persistence** | nightly runs, 018 | none | internal |
| 7 | **OI-weighted funding index** | needs §3 rollup | rollup only | acquisition |

**1. Basis is the find, and it is the mechanism the whole site is about.** Funding exists to pull
mark back to index; the site renders the effect on every page and the cause nowhere. A basis panel
beside the existing step-line renderer (`apps/worker/src/web/funding-chart.ts`) costs one selected
column and no new requests. Two disciplines it inherits: signed-log scale from `rail.ts`, since basis
and funding share the property that a distressed value must stay readable beside an ordinary one; and
an explicit coverage statement for the mark-less venues named in §2.

**2. The capacity curve is the differentiated one, and its data source is already built.**
`ranking-system-design.md` §2 checked the market leader directly — its columns are Symbol, Portfolio,
Funding Rate, PNL, 3-Day Cumulative Funding, 3-Day Revenue, APR, Annual Revenue — so it shows **no
open interest, no depth, and no measure of how much capital the opportunity absorbs**. §1 measured
depth-versus-payout correlation at **0.090**: yield does not fall as depth rises. Plot thinner-leg OI
(log x) against net APR, viable set highlighted, cumulative-deployable curve over it — *"$X deployable
at ≥Y% APR"*. `market_pair_candidates` (018) already stores `thinner_leg_oi_usd`, `score`,
`deployable_usd` and `expected_weekly_usd` per candidate, and `refreshRankedPairs` is wired
(`store.ts:821`, `main.ts:275`), so the chart is a read away.

**3. Predicted vs settled is the purest quality-of-truth exhibit.** Found as debt during S1 and never
rendered: gate `IBM_USDT` advertises **42.8% APR** and has settled exactly zero three times a day
since **2026-09-02**; bybit `ETHBTCUSDT` the same shape since **2026-08-31**. `funding_snapshots.kind`
separates predicted from settled and `funding_events` holds what actually paid, so the overlay is a
join, not a study. This is PMF §6's moat drawn as a picture — and it catches the class of thing the
screener would otherwise advertise.

**4. Settlement clock.** `next_funding_at` is stored and rendered only as a text countdown in two
table cells (`pages.ts:486`, `:1176`). On `/pair`, a 24-hour strip of both legs' settlement ticks,
sized by expected payment, answers something the equity curve cannot when one leg settles hourly and
the other 8-hourly — whether day one is a payment or a wait.

**5. Liquidation event-time.** Already named in the Phase 4 record as the one visualisation that
would earn its place now: Δapr at −30/−20/−10/0/+10/+20/+30, because the pre-trend is more
interesting than the null effect. **Per-venue only, never summed** — OKX rotates 40 of 479
instFamilies, caps at 100 records, runs ~69 minutes stale and resets its cursor on deploy, while Gate
is a complete sweep; adding them would manufacture the ranking, which PMF §5 already forbids.

**6. Churn / persistence — internal, not public.** The recommended venue pair changes for **71%** of
assets overnight; the viable set went 25 → 23 with only 8 shared. Drawn over time with the fee cost
beside it (`0.71 × 52 × $20 = $738` per $10k per year against a 15.6% size-weighted gross), this is
the evaluation instrument for ranking sprints 1–2, whose turnover guardrail is 71% → **≤30%**. Build
it as the shadow evaluation's dashboard.

**7. OI-weighted cross-venue funding index.** "What the market pays to be long BTC, depth-weighted
across every venue" as one line, against the per-venue spaghetti the funding chart draws today. Low
cost once §3's rollup exists. Good top of funnel; no claim about direction.

---

## 5. Build order

1. **The §3 rollup.** Hourly `mark`, `index`, `open_interest_usd`. Nothing user-visible, and the only
   item whose cost rises every day it is deferred.
2. **Basis chart.** Proves the rollup and puts a stored-but-unseen column in front of a reader.
3. **Capacity curve.** Arrives with 018 regardless; the differentiated one for the buyer.
4. **Predicted vs settled.**
5. **Settlement clock.**

Sequenced behind ranking sprints 0–1, which the development plan's own sequencing calls item 1 and
which decides whether scaling anything is justified — except the rollup, which lands now.

## 6. Deliberately not doing

- **No CVD**, and no trade-tape ingestion, until WebSockets exist for another reason. If they ever
  do, CVD is a tier-1-subset acquisition feature, priced honestly.
- **No 6-hour direction page.** It would be the first falsifiable-within-6-hours claim on a site whose
  every trust asset is a variant of "we say what we do not know", and readers keep score.
- **No summed cross-venue liquidation intensity** until OKX ingestion is complete or the page shows
  Gate alone.
- **No chart library.** Server-rendered SVG plus a small script, as the equity curve and
  `funding-chart.ts` already do, under the 10 ms CPU budget.

## 7. What would change these conclusions

- **The flow rollup accumulates 30 days and a pre-registered test finds flow predicts funding sign
  flips above the 8.06% base rate.** Then the carry-input framing in §1a is real and Layer B gets its
  exit signal.
- **WebSocket ingestion gets built for tier-1 price arb (Phase 6).** CVD's marginal cost collapses
  from a new subsystem to an extra subscription, and the §1b verdict should be re-run rather than
  inherited.
- **Basis turns out not to be "a fraction of a percent".** Migration 020 asserts it is, and leans on
  that to use index as a stand-in for mark in the identity gate. If the basis chart shows otherwise
  on real data, that is a finding about the gate before it is a finding about the chart.
