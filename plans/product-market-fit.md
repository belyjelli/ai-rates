# Product–market fit — measured, 2026-09-13

Written after the identity gate shipped (`1a243c0`), before committing to 39 more adapters. Every
figure here came from the live database on the date above and is quoted so a later reader can
re-run it rather than trust it. Where something is an opinion, it says so.

The question this note answers is not "is the site good". It is: **does the product surface
opportunities that a real person can execute, at size, repeatedly?** Those three words — execute,
at size, repeatedly — are each a filter, and each one removes most of the table.

---

## 1. The funnel

Every constraint applied in turn, against the newest nightly replay (575 pairs, $10k notional,
7 days of settled funding):

| filter | pairs | share |
| --- | --- | --- |
| verified 7-day replay | 575 | — |
| net funding positive | 345 | 60% |
| **clears ~$20 of fees** (4 fills at 5 bps: open and close, both legs) | **110** | 19% |
| + thinner leg holds ≥ $1M open interest | 35 | 6% |
| + pair stability ≥ 0.7 | 24 | 4% |
| + neither leg distressed (< 200% abs APR) | **23** | **4%** |

The median row pays **$3.12 per $10k per week** — about 1.6% APR, which is *negative* after fees.
**At retail fees** the honest output of this product is roughly **23 tradeable pairs**, not 916.
That qualifier turns out to carry most of the weight — see §1a.

The live spread table tells the same story from the other end. At no open-interest floor there are
916 pairs at a median 12.57% APR; requiring $5M on *both* legs leaves 152 pairs, 66 of them above
10% APR and 15 above 50%. So depth does not annihilate the funding-carry opportunity the way it
annihilates the price-gap one — but it thins it by 6×.

**Price arbitrage is not a standalone product.** Measured when `/arbitrage` shipped: 721 comparable
assets, 395 with any positive gap, **median 1.58 bps**, and the widest gaps sit on the thinnest
books — STORJ 317.2 bps good for **$568**, ONE 296.6 bps for **$18**, LSK 149.1 for **$10**, YOFC
105.7 for **$3**. It is a useful cross-check and a good honesty exhibit. It is not a business.

### 1a. The funnel is fee-tier dependent, and that changes who this is for

The §1 funnel charges retail taker fees (5 bps, four fills). Re-run against better tiers, the same
575-pair replay gives a different product:

| thinner leg | 5 bps retail | 1.5 bps VIP | zero fee | maker rebate |
| --- | --- | --- | --- | --- |
| any depth | 136 | 285 | 380 | 526 |
| ≥ $1M open interest | 56 | **122** | 154 | 199 |
| ≥ $5M open interest | 11 | 23 | 28 | 35 |

At a VIP tier the viable set is **2.2× retail's**; with maker rebates, **3.6×**. The fee wall that
makes this product marginal for a retail trader is largely absent for anyone with a real fee
schedule — so *who* is looking decides whether the product is thin or rich, more than any
engineering choice does.

**Capacity, which is the first question a fund asks.** The 74 pairs clearing VIP fees with ≥$1M on
the thinner leg and stability ≥0.7 return **$2,334 per week at $10k each** — about **16.4% APR
gross** on ~$740k deployed — against **$349M** of summed thinner-leg open interest. At 1–5% of that
depth the strategy absorbs roughly **$3.5–17M**.

*Measurement note: the nightly replay re-ran between two readings taken an hour apart, moving pairs
clearing $20 from 110 to 136 within the same `run_day`. Treat these as a snapshot with drift, not as
constants.*

## 2. The finding that matters most: the ranking does not persist

Two nightly runs exist (2026-09-12 and 2026-09-13). Their 7-day windows **share six of seven
days**, so the results should be nearly identical. They are not:

- The viable set (the 23 above) went 25 → 23 with **only 8 present in both**.
- The top-20 by net funding kept **10 of 20**.
- Of 524 assets present on both days, the recommended **venue pair changed for 371 — 71%**.
- Cross-window correlation of net funding: **0.403**, on data that is 86% shared.

**Caveat, stated plainly:** six of seven shared days means this is a *churn floor*, not a
measurement of true persistence. Two overlapping windows cannot establish it either way. Re-measure
once two non-overlapping windows exist (about 2026-09-26). What the number does establish is that
churn is already high under conditions that should suppress it.

**A likely cause is in our own SQL, not in the market.** `screener_pairs` selects the representative
pair per asset with `DISTINCT ON (base) ... ORDER BY spread DESC` — the *widest* spread, which
selects for outliers by construction. `refreshPairBacktests` then replays whatever that picked. Each
re-selection is a re-entry, and each re-entry pays the ~$20 that already erases the median row.

**The design that answers this is [`ranking-system-design.md`](ranking-system-design.md).** It
carries the cost of this churn — `0.71 × 52 × $20 = $738` per $10k per year, **7.4% of capital
against a 15.6% size-weighted gross** — together with the capacity sizing for a $1M–$10M book, the
no-trade-band method, and a four-sprint shadow evaluation. Its pre-registered criteria are the only
ones that count: the sketch that once sat in `development-plan.md` was superseded so that there is
one set to be held to rather than three.

## 3. The tension at the centre of the product

**Every piece of rigour we added made the headline number smaller.**

- The mark-agreement guard killed a 13,660,780 bps "opportunity" (KR200, a 1375× instrument
  mismatch).
- The depth column killed STORJ's 317 bps, which was good for $568.
- The fee model, once displayed, kills the median row outright.
- The identity gate (016) discards a whole venue cluster per collided ticker.

We have built a machine that is very good at saying *the opportunity is not there*. That is worth a
lot to someone deploying real capital and almost nothing to someone browsing for excitement. Retail
wants the big number; we systematically refuse to flatter it, and Coinglass and ORBIT give the
flattering version away for free.

**Opinion, clearly labelled:** the retail funding screener is therefore the wrong target market for
this particular build. Our differentiation is quality-of-truth, and quality-of-truth does not win a
free-tool comparison — it wins with people whose money is at stake.

## 4. A structural conflict to decide deliberately

**Affiliate revenue is paid on trading volume. This product's integrity comes from telling people
not to trade.** Those incentives are opposed, and the opposition is not theoretical: the honest
version of every page shows fewer and smaller opportunities than the dishonest version would.

Subscription aligns the incentives. Affiliate does not. `plans/phase0-referrals-legal.md` is
entirely about affiliate programs, so the default path is currently the misaligned one. That should
be a decision, not a drift.

**The conflict dissolves for the fund segment, and that is an argument for targeting it.** A fund
brings its own capital and generates volume it would have traded regardless, so venue-partner
revenue from it is not churn induced by bad advice — and telling it honestly which pairs work
*increases* its trading rather than suppressing it. The aligned model is therefore subscription plus
venue-partner revenue from funds, with no affiliate dependence on retail, where the conflict is
real and unfixable.

## 5. Who the customer actually is

Three segments get conflated, and only one of them buys this.

**Market makers — no.** Not primarily because of fees, but because of latency and business model.
The collector polls on a **60-second** cycle; an MM operates in milliseconds, so this data cannot
touch their core loop. They earn on spread and rebates with fast capital turnover, not on carry that
locks capital for days, and any desk holding a market-making agreement already runs a funding and
basis monitor as table stakes. Build-versus-buy is settled before the conversation starts.

**Funding-carry and basis funds — yes.** Delta-neutral, holding for days to weeks, and therefore
*not* latency-sensitive: a 60-second cadence is ample. They live on exactly what this system
computes — funding APR, fee tier, leg depth, venue risk, and whether two legs are genuinely the same
asset. §1a is their table: at a real VIP tier the opportunity set is 2.2× what retail sees, and the
capacity figure is the first number they will ask for.

**Retail — audience, not revenue.** Per §3, refusing to flatter the headline number is a liability
in a free-tool comparison against Coinglass and ORBIT.

### Whale tracking: half-buildable, and the customer is inverted

Measured 2026-09-13: of the open interest this system tracks, **$69.4B sits on 7 CEXs where
per-address positions are opaque**, and only **$14.7B on 8 DEXs where addresses are public** —
17.5%. "Show what the big players hold across exchanges" is therefore **not buildable for 82.5% of
the market**, and no engineering fixes it, because CEX position data does not exist publicly. A
Hyperliquid-centric version is very buildable — HL, its ten sub-dexes, dYdX, Paradex and Lighter are
already collected — but it is a **new ingestion path**: this system stores market-level rows today,
not addresses.

**And the whales are the subject, not the customer.** Traders do not want their positions
publicised, so tracking someone and then marketing to them annoys more often than it attracts. The
audience for whale dashboards is retail watching whales. Per-address data therefore belongs to the
*acquisition* funnel rather than to enterprise sales — still a reason to build it, just not the
reason first proposed.

### Liquidation heat map: the same shape, and the data cannot carry it yet

Asked for on 2026-09-13 as the first panel of a market-conditions overview. It is the same shape as
whale tracking above and belongs in the same slot — retail-facing and attention-generating, so
**acquisition rather than enterprise sales**. An earlier argument of mine that it "serves the wrong
customer" was wrong and contradicted the paragraph directly above it: §5 does not treat serving
retail as a strike, it treats it as a different funnel.

**It fails §3 instead, on data readiness — and the evidence is worse than thin history.** Two venues
ingest forced closes, not the one migration 012 records: okx 13,451 events across 298 symbols and
gate 11,637 across 593, with **88 of the top 100 assets by open interest** carrying events. Coverage
is genuinely there. History is ~2 days and still ramping — 277 events, then 4,164, then 20,647 —
which is ingestion coming online rather than a market event.

The ramp is not the disqualifier. The disqualifier is that **the two feeds are not measuring the
same thing**:

- **Gate** is one call for the whole venue, no page ceiling.
- **OKX** rotates 40 of 479 instFamilies per run, revisiting each about every 35–40 minutes, capped
  at 100 records per visit, running about 69 minutes behind real time, with the cursor resetting to
  family 0 on every collector deploy.

Measured: the ceiling does bite, though rarely — **11 visits at or over 100 records** (max 197) and
9 more at 80–99, against 2,461 under 40. Far larger is the disagreement between the feeds on assets
*both* cover, where the okx-to-gate notional ratio spans **0.10× to 16.4×** inside the same 24
hours: ETH 0.76, BTC 1.15, then SNDK 9.7, FLOCK 14.2, DOGE 16.4, MORPHO 0.10.

Some of that spread is real — venues genuinely differ — and some is rotation and deploy-reset bias.
**Nothing in the data separates the two.** A heat map exists to rank assets by liquidation
intensity, so an ordering driven partly by sampling cadence is an ordering we cannot defend.
Publishing it would be the same species as the 13,660,780 bps KR200 "opportunity" that §3 opens by
killing, and it would spend the trust asset §6 rests on — the page that says what it does not know.

**The trigger is structural, not temporal.** An earlier draft of this proposed "two weeks of data
and more than two venues", which is wrong: time cures a warm-up ramp and does nothing about a
rotation ceiling, a 69-minute lag, or a resetting cursor. Build it when either

1. OKX ingestion is complete — full sweep, pagination past 100, or a websocket feed — **or** the page
   presents **Gate alone**, which is narrow but internally consistent; and
2. per-venue figures are **never summed** into a single intensity until (1) holds, because adding a
   complete feed to a rotating sample manufactures the ranking.

Then it is genuinely differentiated — *observed* forced closes against Coinglass's *modelled*
liquidation levels — which is the same quality-of-truth claim §6 rests on, pointed at the acquisition
funnel §5 describes.

### Pricing

**$1,500/month is defensible for execution** — a self-hosted tenant running `profitlock-worker`.
$18k/yr against roughly $800k gross on $5M deployed at 16% is 2.25% of gross, which is an easy
conversation. It is hard to defend for **data alone** at that price.

Two cautions. At $1,500/mo the business needs very few customers — **12 clients is $216k/yr** —
which is a strong lifestyle business rather than a venture outcome, and worth choosing deliberately
instead of discovering later. And an explicit AUM or volume gate is probably the wrong mechanism:
the price screens out low-value clients by itself, while a gate adds friction, a KYC-shaped burden,
and cuts against the free top-of-funnel the whole plan depends on.

## 6. What is genuinely defensible

- **Identity verification.** No competitor can say "both legs are provably the same asset", and we
  have the receipts: `CAT` 387,756,652×, `BB` (BlackBerry vs BounceBit), `PURR` 104×, and `QNT`
  splitting at just 1.32×. This moat *widens* as asset classes are added, because tickers collide
  far more across asset classes than within crypto.
- **Verified settled backtests** — replaying each venue's own settlement schedule rather than
  resampling onto a shared grid, and reporting gaps as missed settlements rather than as zero.
- **Depth printed beside every spread**, and a `/status` page that says what it does not know.

These are trust assets. Trust monetises through subscription and B2B/API access, not through clicks.

## 7. The multi-asset bet: real, but early

Roughly **489 of 5,973 live markets (8%)** are not crypto — 349 MEXC tokenised equities, 104
`hl-xyz`, 26 `hl-para`, 6 `hl-io`, 4 `hl-mkts`. Thirty known index, metal, FX and equity bases span
200 markets.

Genuinely differentiated against crypto-only incumbents, and the right long-term bet. But the books
are thin (`hl-mkts` lists four markets) and equity perps idle outside market hours — which is
exactly why `MU`↔`MUSTOCK` correlated only 0.7385 over 358 minutes. Breadth is a positioning asset
today, not yet a liquidity one.

## 8. What would change these conclusions

Stated in advance so the next measurement is a test rather than a search for confirmation:

- **Persistence recovers** once ranking rewards stability instead of width, and two non-overlapping
  windows show the viable set holding ≥15 of 23. Then the carry product is real and scaling venues
  is justified.
- **The viable set grows materially with venue count.** If going from 15 to 25 venues takes the
  viable 23 to 60+, coverage *is* the constraint and Phase 5 should be accelerated. If it takes it
  to 28, it is not.
- **TradFi liquidity arrives.** If WEEX's 438 and Bullet's 11 TradFi perps land with real depth, the
  differentiation becomes a moat rather than a talking point.
