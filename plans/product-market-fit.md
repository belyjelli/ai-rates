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
The honest output of this product is roughly **23 tradeable pairs**, not 916.

The live spread table tells the same story from the other end. At no open-interest floor there are
916 pairs at a median 12.57% APR; requiring $5M on *both* legs leaves 152 pairs, 66 of them above
10% APR and 15 above 50%. So depth does not annihilate the funding-carry opportunity the way it
annihilates the price-gap one — but it thins it by 6×.

**Price arbitrage is not a standalone product.** Measured when `/arbitrage` shipped: 721 comparable
assets, 395 with any positive gap, **median 1.58 bps**, and the widest gaps sit on the thinnest
books — STORJ 317.2 bps good for **$568**, ONE 296.6 bps for **$18**, LSK 149.1 for **$10**, YOFC
105.7 for **$3**. It is a useful cross-check and a good honesty exhibit. It is not a business.

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
re-selection is a re-entry, and each re-entry pays the ~$20 that already erases the median row. See
the task in `development-plan.md`.

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

## 5. What is genuinely defensible

- **Identity verification.** No competitor can say "both legs are provably the same asset", and we
  have the receipts: `CAT` 387,756,652×, `BB` (BlackBerry vs BounceBit), `PURR` 104×, and `QNT`
  splitting at just 1.32×. This moat *widens* as asset classes are added, because tickers collide
  far more across asset classes than within crypto.
- **Verified settled backtests** — replaying each venue's own settlement schedule rather than
  resampling onto a shared grid, and reporting gaps as missed settlements rather than as zero.
- **Depth printed beside every spread**, and a `/status` page that says what it does not know.

These are trust assets. Trust monetises through subscription and B2B/API access, not through clicks.

## 6. The multi-asset bet: real, but early

Roughly **489 of 5,973 live markets (8%)** are not crypto — 349 MEXC tokenised equities, 104
`hl-xyz`, 26 `hl-para`, 6 `hl-io`, 4 `hl-mkts`. Thirty known index, metal, FX and equity bases span
200 markets.

Genuinely differentiated against crypto-only incumbents, and the right long-term bet. But the books
are thin (`hl-mkts` lists four markets) and equity perps idle outside market hours — which is
exactly why `MU`↔`MUSTOCK` correlated only 0.7385 over 358 minutes. Breadth is a positioning asset
today, not yet a liquidity one.

## 7. What would change these conclusions

Stated in advance so the next measurement is a test rather than a search for confirmation:

- **Persistence recovers** once ranking rewards stability instead of width, and two non-overlapping
  windows show the viable set holding ≥15 of 23. Then the carry product is real and scaling venues
  is justified.
- **The viable set grows materially with venue count.** If going from 15 to 25 venues takes the
  viable 23 to 60+, coverage *is* the constraint and Phase 5 should be accelerated. If it takes it
  to 28, it is not.
- **TradFi liquidity arrives.** If WEEX's 438 and Bullet's 11 TradFi perps land with real depth, the
  differentiation becomes a moat rather than a talking point.
