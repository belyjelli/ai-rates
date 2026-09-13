# Symbol identity refactor — one asset, one key, verified by price

**Goal.** Every market that represents the same underlying pairs with every other one, across all
venues and asset classes; and no two different underlyings ever pair. Today both halves fail.

Everything below was measured on live data 2026-09-13, not assumed. Figures are quoted so a future
reader can re-check them rather than trust them.

---

## 1. Why `base` cannot keep doing this job

`base` is currently both "the venue's ticker" and "the cross-venue asset identity". Those are
different things, and using one string for both produces three distinct failures.

### 1a. Collision — one base, two unrelated assets

Measured as the ratio between the highest and lowest mark under a single `base`:

| base | ratio | what it really is |
| --- | --- | --- |
| `CAT` | **387,440,758×** | a memecoin **and** Caterpillar |
| `STX` | 2,963× | Stacks **and** Seagate (`para:STX` 813.36 vs median 0.2744) |
| `KR200` | 1,355× | already documented in migration 005 |
| `BB` | 955× | BounceBit **and** BlackBerry, on 3 venues |
| `ON` | 544× | two different assets |
| `RTX` | 139× | a token **and** Raytheon |
| `PURR` | 106× | two different assets |
| `AI` | 13.8× | two different assets |

No naming rule fixes these. They are correctly named on both sides; the ticker is simply not unique.
The 5% mark-agreement guard in `screener_pairs` hides them at query time, which means **the data
model is wrong and a filter is compensating**.

### 1b. Fragmentation — one asset, several bases

The S&P 500, right now, across nine markets on six venues:

| base | venues | mark |
| --- | --- | --- |
| `SPX500` | gate, mexc | 7,619–7,630 |
| `US500` | lighter, okx, paradex | 7,620–7,630 |
| `SP500` | hl-xyz | 7,622 |
| `US500` | hl-mkts | **760.96** (see 1c) |

And separately `SPX` is the **$0.49 SPX6900 token on 8 venues** — which is why `symbols.ts` already
refuses to alias it. Four names, one index, plus a same-named token that must never join them.

MEXC adds 356 more: `MUSTOCK`, `GOOGLSTOCK`, `AAPLSTOCK`… all orphaned from the 6–9 venue pools that
already quote `MU`, `GOOGL`, `AAPL` at ratio **1.0**.

### 1c. Scale variance — one asset, different contract size

`hl-mkts:US500` marks **760.96** against eight venues at ~7,620 — almost exactly 10× — with
`multiplier: 1` stored. `MarketRef.multiplier` exists for precisely this and is silently wrong here.
Merging it naively would corrupt every spread it touched; excluding it loses a real market.

---

## 2. The design

Three layers. Each does one job, and a later layer never patches an earlier one.

### Layer 1 — Declared facts. Never guess what the venue states.

Every venue in scope already declares what we have been inferring from strings:

| venue | base | asset class |
| --- | --- | --- |
| MEXC | `baseCoinName` (`MUSTOCK`→`MU`) | `conceptPlate` / `type` |
| Binance, Aster | `exchangeInfo.baseAsset` | `contractType: PERPETUAL` |
| WEEX | `exchangeInfo.baseAsset` | `PERPETUAL` vs `TRADIFI_PERPETUAL` |
| Bullet | `exchangeInfo.baseAsset` | `CryptoPerp` / `RwaPerpUsEquity` / … |

`marketRef` already accepts a `quote` override and ignores the declared base two lines away. It gains
`base` and `assetClass` through the same `...overrides` path. **This deletes whole classes of bug**:
the `USD1`/`U` quote suffixes (48 symbols), the `STOCK` infix (362), and any future venue quirk —
without touching `parseVenueSymbol`, so the blast radius stays inside one adapter per venue.

**Declared names need normalising, not trusting.** Of 383 MEXC renames, 356 are clean tickers and 27
are display strings: `GOLD(XAU)`, `OIL(WTI)`, `SILVER(XAG)`, `COPPER(XCU)`, plus 5 CJK names
(`龙虾`, `牛来`). The parenthetical *contains the canonical ticker we already use*, so the rule is:
take the parenthesised ticker, else a clean `^[A-Z0-9]{1,15}$`, else fall back to `baseCoin`.

**A venue withholding a rename is information, not a gap.** MEXC leaves `baseCoinName == baseCoin`
on exactly 13 contracts — `CATSTOCK`, `STXSTOCK`, `RTXSTOCK`, `BBSTOCK`, `PURRSTOCK`, `ONSTOCK`,
`CSTOCK` — which are **precisely the tickers that collide with crypto**. The venue is protecting us.
A suffix-stripping regex would have overridden it and merged Caterpillar into a memecoin. **Never
strip; only accept what is declared.**

### Layer 2 — Canonical identity

    assetKey = (assetClass, canonicalBase)
    canonicalBase = ALIASES[declaredBase] ?? declaredBase

`(assetClass, base)` is what makes 1a structurally impossible: `equity:STX` and `crypto:STX` are
different keys and can never pair, without any price filter involved.

`ALIASES` keeps its existing job — genuine cross-venue naming differences — and its existing
discipline: every entry carries recorded price evidence, and `SPX` stays deliberately absent.

**Classification is not one field.** `type == 2` and the `Stock` plate agree on 1,179 of 1,192, but
`XAU` is `type=1` + `metals`, `EUR` is `type=1` + `web3`, and `OPENAI`/`ANTHROPIC` are plate-tagged
`Stock` at `type=1`. So MEXC needs a small ordered ruleset (plate first, then `type`), and the
classifier must be **testable per venue** rather than a single expression.

### Layer 3 — Price verification, continuous and visible

This is the "follow the prices that are really the correct ones" requirement, and it is a *check on
identity*, not a filter that hides bad identity.

For each `assetKey`: take the median mark, and flag any member beyond tolerance. A divergence is
always one of three things, and the report says which:

1. **near 10× / 100× / 1000×** → a scale variance (1c) → set `multiplier`, do not exclude.
2. **wildly off, no clean ratio** → a bad alias or an undetected collision → **alarm**.
3. **within tolerance** → identity confirmed.

Surface it on `/status` beside the collector states. A silent filter is how 1a survived this long.

**Correlation confirms; it never decides.** Return correlation over 358 minutes cleanly separated
real aliases from coincidences — `PUMPFUN`↔`PUMP` **0.906**, `FILECOIN`↔`FIL` **0.727**,
`TRUMPOFFICIAL`↔`TRUMP` **0.711**, against a 0.02–0.46 noise floor — but `MU`↔`MUSTOCK` reached only
**0.7385** because equity perps idle out of market hours. Any threshold low enough to catch that
would admit two genuinely correlated but *different* semiconductor stocks. So correlation is a tool
for **verifying a proposed alias**, run deliberately, exactly as the existing `ALIASES` comment was
built by hand. It is never an automatic merge.

---

## 3. Todo list

Ordered so each step is independently shippable and green. **Steps 1–3 change which markets pair**,
so they land before any new venue.

### 1. Declared base — `marketRef` and MEXC  *(smallest, recovers the most)*
- [ ] `resolveDeclaredBase(baseCoin, baseCoinName)` in `parse.ts`, pure, own tests. Branches, all
      captured live: `MU` (clean), `GOLD(XAU)`→`XAU`, `OIL(WTI)`→`WTI`, `龙虾` (non-ASCII → fall
      back), `CATSTOCK` (withheld → fall back), `SP500` (pinned → rejected).
- [ ] `MexcContractDetail` gains `baseCoinName`; pass the resolved base through `marketRef`.
- [ ] Extend `__fixtures__/mexc/detail.json` with one row per branch. Note `XAU_USDT` is **stale** —
      live MEXC now returns `GOLD(XAU)` where the fixture has `null`.
- [ ] Guard: reject a rename whose new name exists elsewhere at >1.5× — catches `AIGENSYN→AI`
      (0.0198 vs 0.2738) and `KIMISTOCK→MOONSHOT` (7.42 vs 64.81).
- [ ] Pin `SPX500` until step 3.
- **Recovers 354 of 356 renames**, each landing on a pool 6–9 venues deep at ratio 1.0.

### 2. Asset class through the pipeline
- [ ] `assetClass` on `MarketRef` / `FundingSnapshot`; migration 015 (**014 is taken** by the other
      session's `014_funding_hourly.sql`) adding `markets.asset_class`.
- [ ] Per-venue classifiers, each with tests: MEXC (plate, then `type`), WEEX (`TRADIFI_PERPETUAL`),
      Bullet (`RwaPerp*`), Binance/Aster (`PERPETUAL`). Default `crypto` where a venue says nothing.
- [ ] `screener_pairs`, heatmap and arbitrage group by `(asset_class, base)`.
- [ ] Backfill existing rows; verify `STX`, `BB`, `RTX`, `PURR`, `CAT` split into two keys each.

### 3. Cross-venue aliases, with evidence
- [ ] Resolve the S&P 500 four-way split onto one base, excluding the 760.96 scale variant.
- [ ] Record price + correlation evidence inline for each new entry, as the existing block does.
- [ ] Confirm or reject `MUFGSTOCK`→`MUFG` (correlation was inconclusive — under 30 shared minutes).

### 4. Price verification job
- [ ] Per-`assetKey` divergence report: scale variance vs alarm vs confirmed.
- [ ] Surface on `/status`; add the near-10ⁿ detector so `hl-mkts:US500` becomes a `multiplier`.

### 5. Then the venues
- [ ] WEEX — needs `collectCycle` (minutes: `{240: 493, 480: 517, 60: 6}`) as its interval source,
      since `fundingInfo` 404s; and its `exchangeInfo` has `status: null` on all 1,016 symbols, so
      `tradablePerpetuals`' `status === "TRADING"` test would return **zero**.
- [ ] Bullet — bulk `openInterest` (ignores `?symbol=`, returns all 19), **microsecond**
      `fundingTime` (`1789308000008909`), and `contractType` values that are never `"PERPETUAL"`.
- [ ] Both need the base extension's pluggable tradability, interval source and timestamp scale.

### 6. Deferred, deliberately
- [ ] Cross-stablecoin filter + marker (**23.3% of live pairs**, 151 of 647). Needs `quote` on both
      legs, which `screener_pairs` does not return. Build **after** 1–3, or it filters a pairing
      that is about to change.
- [ ] `USD1`/`U` in `QUOTES` — **not needed** once step 1 lands; declared base makes it moot.

---

## 4. Explicitly not doing

- **No suffix stripping.** Step 1 exists because the venue declares the answer; a regex would
  override the 13 cases where MEXC deliberately withholds it.
- **No automatic price-based merging.** Correlation verifies a human decision; it does not make one.
- **No `parseVenueSymbol` rewrite.** It is better than it looked — it already maps `GOLD-USD`→`XAU`
  and `SILVER-USD`→`XAG`, and handles every TradFi ticker tested. Declared base supersedes it where
  a venue speaks; the parser remains the fallback for venues that do not.
