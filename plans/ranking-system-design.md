# Ranking system design — capacity-first, turnover-aware, shadow-evaluated

For the $1M–$10M book. Written 2026-09-13 against measured figures, after the PMF work showed that
the ranking's own instability is the largest single tax on the strategy it recommends.

**The problem in one line.** `screener_pairs` selects each asset's representative pair with
`DISTINCT ON (base) ORDER BY spread DESC` — the *widest* spread, which selects outliers by
construction. The recommended venue pair then changes for **71% of assets overnight**. At ~$20 per
$10k round trip (four fills: open and close, both legs), following that costs
`0.71 × 52 × $20 = $738` per $10k per year — **7.4% of capital annually against a size-weighted
gross of 15.6%.** The ranking would destroy roughly half the return it advertises.

---

## 0. The constraint that shapes everything

**The spread page does not change.** Not its layout, not its numbers, not its selection.

This is not only a product preference; it is a technical boundary. `/` reads **two** sources — the
live `screener_pairs` function for its hero and spreads table, and `market_pair_backtests` for the
"What actually paid, last 7 days" block. So:

- `screener_pairs` is **not modified**. No new selection mode, no changed default.
- `market_pair_backtests` is **not modified**. Same rows, same primary key, same writer.
- Everything below lands in a **new read model** written by a **new collector job**, served on a
  **new surface**.

That constraint happens to be exactly what a staged evaluation wants anyway: the new ranking runs in
shadow beside the old one, and nothing a reader sees changes until the evidence says it should.

---

## 1. Who this is for, and what they can actually enter

Measured 2026-09-13 across the viable set (clears VIP fees, stability ≥ 0.7, neither leg distressed),
sizing each position at **2% of the thinner leg's open interest**:

| thinner leg | pairs | avg APR | deployable |
| --- | --- | --- | --- |
| ≥ $50M | **0** | — | — |
| $25–50M | 3 | 22.2% | $1.91M |
| $10–25M | 5 | 14.6% | $1.80M |
| $5–10M | 5 | 32.1% | $0.75M |
| < $5M | 167 | 11.7% | $3.49M |

- **13 pairs support a $100k position.** Seven support $250k. **Three support $500k.**
- The entire viable set absorbs **$7.96M**, at a size-weighted **15.6% APR**.
- So $1M deploys comfortably across ~15 pairs. **$5M is the edge. $10M does not fit** at 2%
  participation without pushing into 4–5% of the book being traded, which moves it.

**The finding that makes the design cheap: correlation between depth and payout is 0.090** — for
practical purposes, zero. Yield does *not* fall as depth rises, so **selecting for capacity costs
almost nothing in expected rate.** Capacity-weighting is close to a free lunch, which is rare enough
to be worth saying plainly.

**Commercial consequence, stated because it bounds everything:** $7.96M at 15.6% is a total profit
pool of roughly **$1.24M per year across every client combined**, at current venue coverage. That is
the ceiling on what this product can be paid out of today. It is the strongest commercial argument
for venue and asset-class expansion — not more aggressive ranking of the same 180 pairs.

---

## 2. Evaluation: what the field already does, and buy-versus-build

**Net-of-fees ranking is table stakes, not a differentiator.** CoinGlass's arbitrage list already
ranks by net APR using a ~5 bps-per-leg assumption, and at least one third-party screener explicitly
prefers the multi-day average gap over the live one "as it has actually tended to persist." So
*"rank on settled rather than instantaneous"* — which was the obvious first proposal — buys us
nothing anyone else lacks.

**What the market leader does not show** (fetched and checked 2026-09-13 — its columns are Symbol,
Portfolio, Funding Rate, PNL, 3-Day Cumulative Funding, 3-Day Revenue, APR, Annual Revenue):

- no open interest, no book depth, **no measure of how much capital the opportunity absorbs**
- no persistence or stability metric
- no realised historical return
- and it annualises a **three-day** window — precisely the extrapolation our own churn measurement
  says is unreliable

*Limit of this check: the leader was verified directly; the long tail of small screeners was not
surveyed exhaustively (one source 404'd). Treat "nobody ranks by capacity" as strongly indicated
rather than exhaustively proven.*

**Buy versus build.** Kaiko has absorbed Amberdata into a single regulated institutional data and
analytics provider, priced and sold for institutions. A $1M–$10M book is **too small for that tier
and too large for a free retail list** — that gap is the wedge, and it argues for building.

**Therefore the differentiation is capacity, turnover-awareness and identity — not net-of-fees.**
Those three are things no observed competitor does, and identity verification is already built.

---

## 3. Method: this is a solved problem, so do not invent one

Churn under a noisy score is **no-trade band / corridor rebalancing**, and the literature is settled
enough to borrow rather than improvise:

- The optimal policy defines a band around the target. While inside it, **do not trade**. Outside it,
  move to the **nearest edge** — not all the way to target.
- The no-trade interval's width varies as the **cube root of transaction costs**. That gives a
  principled way to size the band instead of picking a number.
- Turnover penalisation acts like a Lasso: it enforces buy-and-hold until markets reveal a shift
  large enough to justify paying the cost.
- Reported effects: turnover down by ~50% versus periodic rebalancing; rebalancing on ~15% of days.

Applied here, the "band" is on the **score gap between the incumbent venue pair and its challenger**,
and the "transaction cost" is the four-fill round trip at the client's own fee tier.

---

## 4. The design — three layers, each testable alone

Each layer is separately shippable and separately falsifiable, so the evaluation can attribute the
gain rather than shipping a bundle and guessing.

### Layer A — Score: what a pair is worth

    score = expected net funding per dollar per week, at the client's fee tier

- Computed from **settled history**, never the live snapshot.
- **Shrunk by sample size** toward the pool median, following the precedent already set by
  `stability_30d` (`k = 10`): a pair with four charging days must not outrank one with a month.
- Net of fees via `packages/core/src/fees.ts`, which stays the single authority — the Go executor
  must not re-derive it.
- Explicitly **not** the instantaneous spread. That is the input that causes the problem.

### Layer B — Selection: which pair, and whether to switch

    switch only if  score(challenger) − score(incumbent)  >  band
    band = max( round-trip cost , c · (round-trip cost)^(1/3) )

- Requires knowing the **incumbent**, which nothing currently stores. This is the single largest
  code change and the reason Sprint 0 exists.
- Asymmetric by design: **easier to leave than to switch.** A separate, tighter *exit* band drops a
  pair whose score decays below a floor even when no challenger clears the entry band — otherwise
  hysteresis happily holds a dying position.
- `c` is calibrated once during evaluation, never tuned per asset.

### Layer C — Sizing: how many dollars, which is what this segment actually asks

    deployable = participation × thinner_leg_open_interest      (participation default 2%)
    expected   = deployable × score

- **Rank by `expected` — dollars per week — not by APR.** For a $1M–$10M book a 300% APR pair good
  for $10k is noise; a 14% pair good for $600k is the business. This is the segment-specific
  inversion, and §1 shows it costs almost nothing in rate.
- Report **both**: APR for comparison against other strategies, dollars for the actual decision.
- `participation` is per client. A patient book runs 1%; an aggressive one 5% and accepts impact.

---

## 5. Shape of the implementation

- **Migration 018.** (017 is already claimed by the identity refactor's asset-class step; take the
  next free number at implementation time and update whichever plan is wrong.)
- **New table `market_pair_ranked`** — one row per asset per run: chosen legs, score, the
  **incumbent legs carried from the previous run**, whether it switched and why, deployable dollars,
  expected weekly dollars, the participation rate and fee tier used.
- **Candidate rows retained, not just the winner.** `market_pair_backtests` has
  `PRIMARY KEY (run_day, asset)`, so only the winner is stored and **no counterfactual is
  recoverable** — which is exactly why hysteresis cannot be backtested on existing data. The new
  table keeps every candidate leg-pair considered.
- **`refreshRankedPairs()`** on the collector, nightly, entirely separate from
  `refreshPairBacktests()`. Neither calls the other.
- **Pure functions in `packages/core`** — scoring, shrinkage, band width, switch decision — with
  their own tests, following `classifyDivergence` and `backtestPair`. SQL gathers evidence; the
  engine decides. No second implementation of the arithmetic in SQL.
- **New surface** `/carry` plus `/v1/carry`. The spread page is untouched.

---

## 6. The agile staging — how we check this rather than believe it

The decisive evaluation **cannot be run on existing data**: only two nightly runs exist, their 7-day
windows share six of seven days, and no counterfactual is stored. That is not an argument for
guessing; it is the reason the work is staged.

**Sprint 0 — instrument. Nothing user-visible.**
Record, each night: every candidate leg-pair per asset, its score under each variant, the incumbent,
and what a switch would have cost. Until this exists no variant can be compared to another. This
sprint ships no ranking at all and is the most important one.

**Sprint 1 — shadow. Still nothing user-visible.**
Compute all variants nightly, store all, display none:

| variant | selection |
| --- | --- |
| **A — control** | today's widest instantaneous spread |
| **B** | settled 7-day spread |
| **C** | shrunk, net-of-fees score (Layer A) |
| **D** | C + hysteresis (Layer B) |
| **E** | D + capacity weighting (Layer C) |

**Sprint 2 — evaluate**, after at least **two non-overlapping** 7-day windows (earliest 2026-09-26;
four windows preferred). Criteria are pre-registered below and are not to be revised after looking.

**Sprint 3 — promote** the winner to `/carry` only. If the winner is D rather than E, **ship D** —
do not ship the whole stack because it was built.

**Sprint 4 — per-client fee tier and participation rate**, feeding from member settings, once a
variant has actually won.

### Pre-registered success criteria

- **Primary — realised net dollars per $1M deployed** over the evaluation window, **charging every
  switch at the moment it happens**. This is the only metric that decides. A variant that improves
  gross while churning more must lose.
- **Turnover guardrail** — the fraction of asset slots whose legs change per run must fall from
  **71% to ≤ 30%**.
- **Yield guardrail** — realised *gross* must not fall more than **25%** below the control. This
  stops a degenerate winner that minimises turnover by recommending nothing worth holding.
- **Tie-break** — deployable dollars at 2% participation.
- **Decision rule** — promote only if the primary improves **and** the turnover guardrail is met.
  If no variant clears both, ship nothing and say so.

---

## 7. Deliberately not doing

- **Not touching** `/`, `screener_pairs`, or `market_pair_backtests`.
- **Not auto-executing.** The Go executor stays pointed at nothing until a variant has won; an
  automated signal that churns 71% overnight is a fee-burn machine.
- **Not claiming persistence is proven.** Two overlapping windows cannot establish it either way.
- **Not tuning thresholds before the window closes.** `c`, the participation default and the
  shrinkage `k` are set once, up front, from the figures in §1 and §3.

## 8. Risks

- **The capacity ceiling is real and close.** $7.96M total, ~$1.24M/yr of profit pool. No ranking
  change raises it — only more venues and more asset classes do. A $10M client cannot be fully
  served today, and telling them so is better than discovering it at position three.
- **Hysteresis can hold a decaying pair.** Mitigated by the asymmetric exit band; must be measured,
  not assumed.
- **Shrinkage needs a prior**, and the pool median is a choice with consequences for thin pairs.
  State it in the migration before use, as migration 009 does for stability.
- **One venue dominating an asset's depth** makes capacity-weighting concentrate into that venue's
  risk. Track per-venue exposure in the ranked table so the concentration is visible.
