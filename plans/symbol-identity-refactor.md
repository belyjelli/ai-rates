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

**Built, and the design above was wrong.** The original rule — "near 10× / 100× / 1000× → a scale
variance → set `multiplier`" — was measured against live data on 2026-09-14 and does not work. It
is kept here rather than deleted, because the reason it fails is the whole point of this layer.

*Landing near a power of ten is a coincidence.* Three markets sit within tolerance of a clean
power of ten and are unrelated assets:

| member | ratio | return corr | what it is |
| --- | --- | --- | --- |
| `gate:PURR` | 104.65× | **0.005** | a different asset, 2% off 100× |
| `bybit:BB` | 0.00105× | **0.030** | BlackBerry vs BounceBit, 5% off 1/1000 |
| `aster:MEME` | 93.64× | **−0.002** | a different asset |
| `okx:ANTHROPIC` | 0.10164× | **0.855** | a genuine 10× contract |
| `hl-mkts:US500` | 0.09988× | **0.842** | a genuine 10× contract |
| `okx:OPENAI` | 0.10257× | **0.823** | a genuine 10× contract |

The ratio rule would have set a 1000× multiplier on `BB` and merged BlackBerry into BounceBit —
precisely the failure this refactor exists to prevent. **Return correlation decides; the ratio only
refines.** Three markets scored 0.823–0.855 and the highest of the other 26 was 0.183 — a clean gap
when the threshold was chosen. **It did not stay clean.** On the 19:48:11Z run that same day
`okx:QNT` scored **0.603** against a binance anchor: the first observation inside the gap, and the
first live `tracks` verdict. `TRACKING_CORR` is deliberately left at 0.5 rather than fitted to one
case, and QNT is an open investigation — see step 3.

Two further corrections the measurements forced:

- **The anchor is the pool's deepest market by open interest, not its median.** A median names the
  biggest *cluster* as correct, and the biggest cluster is not the truest. `PURR` splits three thin
  venues at ~11.4 ($0.91M combined) against hyperliquid and mexc at ~0.109 ($11.15M) — a median
  hands the verdict to the three and reports Hyperliquid's own token as the outlier.
- **The evidence floor counts moves, not volatility.** `hl-mkts:US500` had the second-quietest
  series in the sample and still scored 0.842, because both sides moved on 226 and 263 of 358 bars.
  What genuinely cannot be judged is `lighter:BYD`, whose mark did not move once in six hours.

So the verdict is one of four, never three: `scale` (tracks at a clean power of ten), `tracks`
(same underlying, factor is not a contract scale), `mismatch` (does not track, and there was enough
movement to say so), `unverified` (too little shared movement to judge). And **a collision does not
have to be large** — `QNT` splits at just 1.32×, far too small to notice by eye.

It reports and never merges: setting a multiplier from a measured ratio *is* automatic price-based
merging, which §4 forbids. Surfaced on `/status` beside the collector states, because a silent
filter is how 1a survived this long.

**The verdict now gates the listing (migration 016).** A wrong number is worth less than no number,
so a market that does not agree with its anchor is not listed on the scan at all — one call, taken
in one place. The four verdicts are the *reason* behind that call, never a second opinion on it.
This also retires the 5% median guard from migration 005, which was measurably picking the wrong
side: both filters drop 29 of 4,730 legs, but they disagree on 10 each way, and the median was
dropping Hyperliquid's own $11.15M PURR market in favour of three venues holding $0.91M between
them. Cost, measured before the change: 899 assets quote on two or more venues and 887 still do.
Of the 12 that fall out, only four carry any open interest — `JPY` ($12.01M, a reciprocal quote
that must never pair), `AI`, `HK50`, `RTX` — and five of the rest are pre-consolidation artefacts
that step 1 re-bases as soon as it deploys. `scale` is excluded along with the others: until
someone sets the multiplier, the number that market publishes is not the asset's price. Fixing the
multiplier puts it back automatically.

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

### 1. Declared base — `marketRef` and MEXC — **shipped `893c8d1`, one item outstanding**
- [x] `resolveDeclaredBase(baseCoin, baseCoinName)` in `parse.ts`, pure, own tests. Branches, all
      captured live: `MU` (clean), `GOLD(XAU)`→`XAU`, `OIL(WTI)`→`WTI`, `龙虾` (non-ASCII → fall
      back), `CATSTOCK` (withheld → fall back), `SP500` (pinned → rejected).
- [x] `MexcContractDetail` gains `baseCoinName`; pass the resolved base through `marketRef`.
- [x] Extend `__fixtures__/mexc/detail.json` with one row per branch. Note `XAU_USDT` is **stale** —
      live MEXC now returns `GOLD(XAU)` where the fixture has `null`.
- [x] ~~Guard: reject a rename whose new name exists elsewhere at >1.5×.~~ **Closed, not built:
      production showed its premise was wrong.**
      - **`AIGENSYN→AI` is a correct rename.** On 2026-09-13 ~21:50Z mexc `AIGENSYN_USDT` marked
        0.01972, exactly okx `AI-USDT-SWAP` at 0.01972 (OKX lists Gensyn as `AI`). The 0.2754 markets
        are a different token on lighter and aster.
      - So the collision is two crypto tokens sharing a ticker, not a bad rename. The guard would have
        rejected the correct mexc market while leaving the actual collision in place.
      - The gate already handles it: `screener_pairs` pairs `crypto:AI` on mexc/okx only, and step 4
        reports aster and lighter as `mismatch` (correlation 0.009 and 0.036).
      - `KIMISTOCK→MOONSHOT` (mexc 7.42 against okx 65.28, correlation −0.055) is caught the same way.
        Both are pre-IPO contracts, and whether they even quote the same unit is unclear; a price
        guard at ingest could not settle that either.
      - Ingest has no cross-venue prices anyway: an adapter sees one venue. The check that can see
        both sides already exists, in steps 4 and 016.
- [x] Pin `SPX500` until step 3 — resolved in the same commit, see step 3.
- **Recovers 354 of 356 renames**, each landing on a pool 6–9 venues deep at ratio 1.0.
- [ ] **Parser artefacts that land in a real pool.**
      - aster `B-MONEYUSDT` splits on the hyphen into `B`. That puts it in the real B pool: aster at
        ~0.00435 against five venues at ~0.2195.
      - aster `CLUSD1`, `XAUUSD1`, `BTCU` and `ETHU` keep those strings as their base, so they never
        pool with `CL`, `XAU`, `BTC` or `ETH`.
      - Both are fixable from aster's declared `baseAsset`, the same way MEXC's declared base fixed
        its renames. Asset class fixes neither.

### 2. Asset class through the pipeline — **shipped `e51fde9`, verified in production**
- [x] `AssetClass` (`crypto|equity|commodity|fx|index`) on `MarketRef`; **migration 017** adds
      `asset_class` to `markets`, `market_latest` (indexed with `base`), `market_identity_checks`
      (a column only; its key stays `(venue_id, venue_symbol)`) and `market_pair_backtests` (key
      becomes `(run_day, asset_class, asset)`), and rebuilds `screener_pairs` from 016's body keyed on
      `(asset_class, base)`.
- [x] One core rule, `refineAssetClass` in `packages/core/src/asset-class.ts`, applied inside
      `marketRef`. The venue's declaration decides crypto versus not. A table only settles equity
      versus index, which venues use interchangeably (OKX files US500 as a stock, gate as an
      index), and keeps tokenised gold (PAXG, XAUT) crypto. A crypto declaration is never
      overridden.
- [x] Per-venue classifiers, each tested against live rows captured 2026-09-14:
      - Bybit `symbolType`, OKX `instCategory`, gate `contract_type`, KuCoin `assetClass`.
      - Binance `underlyingType`, Aster `underlyingSubType`, MEXC plates.
      - Hyperliquid HIP-3 `perpConciseAnnotations`.
      - Paradex's `RWA` tag.
      - Lighter's documented market-specifications table.
      - dYdX's announced non-crypto list.
      - **Binance tradability also widened to `TRADIFI_PERPETUAL`**. It was dropping 191 TRADING
        markets, Caterpillar's CATUSDT among them.
- [x] Worker: every read keys on `(asset_class, base)`.
      - Non-crypto assets are addressed with the class in the path (`/markets/asset/equity/BB`,
        `/pair/equity/BB`, `/price-pair/equity/BB`, and the `/v1` equivalents).
      - A class-less URL resolves to crypto when the base has a crypto market, and otherwise to its
        deepest class.
      - Non-crypto tickers carry a class tag. Row keys include the class.
- [x] Deployed the collector first, then verified in production on the first full cycle. Existing rows
      backfilled themselves.
      - Live markets by class: 4,159 crypto, 1,844 equity, 93 commodity, 43 index, 25 fx.
      - Each collided ticker now has one pool per class:

        | ticker | crypto | equity |
        |---|---|---|
        | `BB` | 6 venues at 0.008 | 3 venues at 7.75 |
        | `STX` | 8 venues at 0.27 | hl-para at 818 |
        | `CAT` | 5 venues, the memecoin | binance and gate at 817 |
        | `ON` | 5 venues at 0.137 | 2 venues at 74.5 |
        | `PURR` | 2 venues at 0.11 | 3 venues at 11.5 |
        | `QNT` | 5 venues at 63.7 (Quant) | 3 venues at 48.8 (Quantinuum) |
        | `RTX`, `ADI` | the tokens | the stocks |

      - `screener_pairs` returns a separate row for each side of `BB`, `CAT`, `ON`, `PURR` and `QNT`.
      - `US500` became one `index` pool across 7 venues; OKX's "stock" filing is refined to index.
      - **This also closes `QNT` from step 3.** Its two clusters were Quant and Quantinuum, which
        OKX, hl-xyz and Lighter declare as a stock. No alias was needed.
      - Still >1.5× inside one class: `fx:JPY`, `index:KR200`, `index:US500` (hl-mkts, 10×),
        `index:HK50`, `equity:OPENAI`, `equity:ANTHROPIC`, `equity:MOONSHOT`, `equity:BYD`,
        `crypto:MEME`, `crypto:B`, `crypto:AI`, `crypto:EDGE`. Every one was predicted above.
- **Does not fix** collisions inside one class:
  - `JPY` (reciprocal quote, both fx).
  - Scale variants (`hl-mkts:US500`, OKX `ANTHROPIC`/`OPENAI`).
  - Same-ticker crypto tokens (`MEME`, `AI`, `EDGE`).
  - Parser artefacts (below).
  - These stay excluded by the 016 gate and reported by step 4.

### 3. Cross-venue aliases, with evidence
- [x] Resolve the S&P 500 four-way split onto one base, excluding the 760.96 scale variant —
      `893c8d1`. `SPX500` and `SP500` alias to `US500` in `symbols.ts`; the 760.96 variant is
      excluded by migration 016 and reported `scale`, exponent −1, rather than merged.
- [ ] Record price + correlation evidence inline for each new entry, as the existing block does.
- [x] **Confirmed `MUFGSTOCK`→`MUFG`.** On 2026-09-13 ~21:50Z mexc `MUFGSTOCK_USDT` marked 23.700 and
      gate `MUFG_USDT` 23.625, 0.3% apart. Both are declared equity. `screener_pairs` pairs them, and
      step 4 raised no divergence for either. No alias entry was needed: the venue's declared base
      already does the join.
- [ ] **Investigate `QNT` by hand — its verdict is unstable across anchor choice.** Two clusters sit
      1.32× apart (four venues near 64.7, three near 48.7). Against a mexc anchor on 2026-09-13 the
      three legs scored 0.15–0.18 and read as a clear mismatch; against a binance anchor an hour
      later the same legs scored 0.110, 0.309 and **0.603**, so one crossed `TRACKING_CORR` into
      `tracks`. Same prices, same cluster, different verdict. A 1.32× collision genuinely sits on the
      decision boundary, so this wants correlation over a longer window and a look at what okx and
      binance actually list — the deliberate, evidence-recorded decision this section reserves for
      aliases, not an automated verdict. The gate excludes it either way, so nothing is at risk
      while it stays open.

### 4. Price verification job — **done**
- [x] `classifyDivergence` in `packages/core/src/identity.ts`, pure, own tests, thresholds
      pre-registered in migration 015 with the live measurements behind each one.
- [x] Migration 015 `market_identity_checks`; `refreshIdentityChecks` on the collector, hourly.
- [x] Surfaced on `/status` and `/v1/status`, worst verdict first.
- [x] Integration tests both sides: the collector's SQL against real minute bars, and the worker's
      read under `fetch_types: false`.
- **The near-10ⁿ detector was NOT built, deliberately** — see Layer 3. It would have merged
  BlackBerry into BounceBit. `hl-mkts:US500` is now reported `scale`, exponent −1, on a correlation
  of 0.842, and a human decides whether to act on it.
- **Confirmed in production 2026-09-13 18:48:11Z:** 31 rows — 17 `mismatch`, 11 `unverified`,
  3 `scale`. The three `scale` verdicts are exactly the three predicted, all exponent −1:
  `okx:ANTHROPIC` (0.857), `okx:OPENAI` (0.834), `hl-mkts:US500` (0.813). `PURR` at 104× (0.003 to
  0.068) and all five `BB` legs at 0.00105 (−0.009 to 0.040) came back `mismatch` despite sitting
  within tolerance of a clean power of ten — the failure the original rule would have shipped,
  caught on live data.
- **A new large venue becomes the anchor immediately and blinds the REPORT for an hour.** Binance
  began collecting at this boot and had 7 minutes of `funding_snapshots` against 1,439 for every
  other venue; being the deepest venue it anchored many pools, and **9 of the 11 `unverified` rows
  were anchored on it at exactly 6 shared minutes**. That is `MIN_SHARED_MINUTES` working —
  `BB|binance` scored −0.418 on six bars and would otherwise have published as a confident
  mismatch. **Predicted, then confirmed.** The prediction was that it would clear on the 19:48:11Z
  run once Binance passed `MIN_SHARED_MINUTES`; it did. Binance reached 66–67 shared minutes and all
  nine binance-anchored rows resolved — eight to `mismatch`, one to `tracks` — taking `unverified`
  from 11 to 1. The survivor is `lighter:BYD`: 358 shared minutes, correlation null, a mark that did
  not move once, which is precisely the case the verdict exists for and is now its only occupant. **The gate is never
  affected**: it compares marks
  live and never reads this table, so `gate:CAT` at 387,756,652× stays excluded from the scan while
  its verdict reads `unverified`. Expect this once per large venue during Phase 5.

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
