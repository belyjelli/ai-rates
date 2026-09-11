# Plan: Perp Funding & Price-Spread Index Platform (ORBIT-style)

## Context
We're building our own version of orbitperpscreener.com. It's a free public site, paid for through exchange referral links, that combines perpetual-futures data from about 57 venues (CEX, DEX and Hyperliquid HIP-3 dexes) into four tools:

1. **Funding spread screener** (`/screener`)
   - For each asset, the widest funding APR gap: long on the lowest-rate venue, short on the highest.
   - Filters: min OI, min volume, asset class (crypto/RWA), venues, interval.
   - Sorting: predicted APR, 24h/7d settled average, stability, OI.
2. **Backtester** (`/pair/{SYM}?long=&short=&size=10000&days=30`)
   - Replays the real settled funding for both legs and subtracts fees and slippage.
   - Outputs: net PnL, $/day, payback, win rate, equity curve.
3. **Price-arbitrage screener** (`/arbitrage`, `/price-pair/{SYM}`)
   - Executable bid/ask gaps for the same asset across venues, after fees and with a size limit based on book depth.
4. **Exchange/asset index** (`/markets`, `/markets/exchange/{venue}`, `/markets/asset/{SYM}`)
   - Per venue: OI, volume, market count, fees, points/TGE status, daily momentum.
   - Per asset: a funding table across all venues plus the best pair.
   - Plus `/trade`, a referral hub.

Later: blog/glossary, airdrop calendar, en/ru, Telegram alerts.

**Constraints you chose:** Bun + TypeScript, Python workers, **100% Cloudflare hosting and storage** (no external DB), all ~57 venues, free + referral monetization, a 2–3 developer team. The repo `ai-rates` is empty (greenfield).

---

## Architecture

```
        watchdog cron (*/5)  ──ensureAlarm()──►  VenueCollectorDO  ×57   (one per venue; locationHint in the DO name, e.g. "binance@apac-ne")
                                                   │ alarm every 60s: pool ≤5 fetches, token bucket, 40s deadline, circuit breaker
                                                   │ all exchange calls happen HERE (queue/cron handlers ignore placement)
                        ┌──────────── RPC ─────────┼──────────────── RPC ─────────────┐
                        ▼                          ▼                                  ▼
               VenueHistoryDO ×57           MarketHubDO (singleton)            Pipelines binding (1 batch per venue/cycle)
               SQLite ≤10GB each:           latest cross-venue matrix,          → R2 Iceberg tables (Parquet):
               settled funding_events       spreads, price arb, venue health    ticker_1m, funding_snap_1m,
               (+mark_px), 5-min snapshots  → JSON served via Cache API         orderbook_samples, funding_events
               (30d), 1h rollups (1y)                │                                   │
                        ▲                            │                                   ▼
                        │ RPC (2 legs)               │                          R2 SQL (open beta) /
                ┌───────┴────────────────────────────┴──┐                       DuckDB in py container
                │  web worker: Hono /v1/* API + React    │                                  │
                │  Router v7 SSR pages, Cache API edge   │◄── D1 "meta" ◄──── py-analytics Python Worker (hourly cron):
                │  cache, rate-limit binding, Turnstile  │    (venues, assets,  stability, 7d/30d avgs, momentum,
                └────────────────────────────────────────┘     referrals, derived  nightly "verified" backtests (numpy)
                                                               stats, bt cache)
   py-backfill Container (on demand): full CPython + ccxt → historical funding/klines backfill → VenueHistoryDO + R2
   (fallback) relay Container, constraints.regions=["APAC"]: egress proxy only for venues that fail the geo-probe
```

### Key decisions
| Concern | Decision | Why |
|---|---|---|
| Deployables | **4 services**: `ingest` (TS: all DOs + watchdog cron), `web` (TS: API + SSR), `py-analytics` (Python Worker), `py-backfill` (Python Container). Optional `relay` container. | A small team can own this. No scheduler/queue hops. |
| Polling fan-out | One DO per venue using self-rescheduling alarms. Each alarm has its own 6-connection limit and 15-min wall clock. Tiers: bulk funding+tickers 60s; per-symbol-only endpoints (e.g. OI) rotate through symbols; orderbooks every 10 min for pairable markets only. | Fits Worker limits (6 outbound connections, CPU) and venue rate limits. |
| Geo-blocking (Binance 451 for US IPs, Bybit CloudFront 403 on cloud IP ranges, dYdX indexer GEOBLOCKED; one CF community report of scheduled Workers getting 403s from Binance/Bybit/Kraken) | **Fallback ladder per venue, chosen by the Phase 0 probe:** (1) direct call from a DO with a location hint in its name (`binance@apac-ne`); (2) the same call through a Container pinned to `regions:["APAC"]` or `["WEUR"]`; (3) **CF-only relayed rates**: Hyperliquid `predictedFundings` and Lighter `/api/v1/funding-rates` both republish Binance/Bybit funding (rates only, no OI/book, marked "relayed" in the UI); (4) a tiny non-CF egress proxy (Tokyo/Frankfurt VPS), the only exception to CF-only, used only if you approve it after the probe. | Hints and placement pick a data center, not IP reputation. Blocks are IP-based. |
| Hot data | MarketHubDO holds the latest matrix. The screener JSON uses Cache API `s-maxage=15, stale-while-revalidate=60`. Clients poll every 15s (no WebSockets in MVP). | KV's 60s minimum TTL is too slow. Funding moves slowly. |
| Settled history (exact, used by backtests) | **VenueHistoryDO SQLite**, one per venue: `funding_events(asset, settled_at, rate, interval_h, mark_px)`, `snap_5m` (30-day retention via alarm), `rollup_1h` (1y). About 350 markets × 24/day ≈ 3M rows/year per venue, well under 10 GB. | Shards naturally by venue. A backtest is just two RPC reads. Exact data, no sampling. |
| Relational metadata | **D1 `meta`**: venues (referral URL, perks, fees, points/TGE), assets + symbol map, markets, derived stats, backtest cache. | Small and relational. Fits D1 well. |
| Raw firehose and research | **Pipelines → R2 Iceberg/Parquet** (≈20k markets × ~200 B/min ≈ 70 KB/s, far below the 5 MB/s limit). Queried with R2 SQL (GROUP BY, window functions, joins supported) or DuckDB in the Python container. | Cheap, complete archive for replay/reprocessing and momentum/stability analytics. |
| Backtester (interactive) | **TypeScript in `packages/core`**, running in the `web` worker. Two legs × 30 days ≈ 1.5k points. | No Pyodide cold start. The same math is unit-tested and shared. |
| Python's role | `py-analytics` Python Worker (Pyodide, numpy/pandas, hourly cron with a 15-min CPU budget) computes stability scores, settled averages, momentum and nightly verified top-10 backtests, then writes to D1. `py-backfill` Container (ccxt, pyarrow/duckdb) runs historical backfills. | Matches the Bun/TS + Python requirement and puts Python where it's strongest. |
| Frontend | React Router v7 (framework mode) on Workers + Tailwind + TanStack Table (virtualized) + lightweight-charts. SSR renders the first table rows. The Hono `/v1` API lives in the same worker. | Official CF template, simple SSR/SEO with no ISR cache plumbing. |
| Ops metrics | Workers Analytics Engine: per-venue latency, status codes, rows, freshness. `/v1/health`. Cron alert to a Telegram/Discord webhook when a venue has been stale for more than 10 min. | Uses CF services only. |

---

## Repo layout
```
ai-rates/
  package.json (bun workspaces) · bunfig.toml · biome.json · tsconfig.base.json · .github/workflows/ci.yml
  apps/
    ingest/         wrangler.jsonc · src/{index.ts (watchdog cron), collector-do.ts, history-do.ts, hub-do.ts, pipeline.ts}
    web/            wrangler.jsonc · app/ (RR7 routes: screener, arbitrage, markets/*, pair/$sym, price-pair/$sym, trade) · server/api.ts (Hono /v1)
    relay/          (only if needed) Dockerfile + Container class
  py/
    analytics/      pyproject.toml · src/entry.py (WorkerEntrypoint.scheduled) · stability.py · momentum.py · verified_backtests.py
    backfill/       Dockerfile · jobs/{funding_history.py, klines.py} (ccxt, duckdb, pyarrow)
  packages/
    core/           zod schemas (Venue, Market, FundingSnapshot, FundingEvent, Ticker, BookSample) · math/{annualize,spread,slippage,backtest}.ts
    adapters/       src/{http.ts (retry, Retry-After, UA), ratelimit.ts, symbols.ts, venues/<venue>.ts} · __fixtures__/<venue>/*.json
    meta-db/        D1 migrations · typed queries
    ui/             table, venue chip, sparkline, equity chart
  data/             venues.json (logo, referral, fees, points, locationHint) · assets.json (canonical ids, multipliers, class, RWA index)
  plans/
```

## Domain rules (packages/core) — the correctness-critical part
- **Adapter contract:** `VenueAdapter { id, capabilities, listMarkets(), fetchFundingSnapshot(), fetchTickers(), fetchFundingHistory(sym, from, to), fetchOrderbook(sym, depthUsd), fees }`. Every adapter declares `rateUnit` (fraction, percent or bps), `rateBasisHours` (a rate can be quoted per 8h but settle hourly) and `kind` (`predicted`, `settled`, or `index` for DEXs exposing a cumulative funding index, where rate = Δindex).
- **Normalize:** store the raw rate and interval exactly as reported, and derive `rate_per_hour`; `apr = rate_per_hour × 8760 × 100`.
  - Sign convention: positive means longs pay. Record caps, floors and HIP-3 per-asset funding multipliers.
  - Quoting varies by venue:

    | Basis | Venues |
    |---|---|
    | Per interval | most CEXs |
    | Per hour | Hyperliquid, dYdX, Extended, Reya |
    | Normalized to 8h | GRVT `funding_rate_8h_curr`, Paradex `funding_rate_8h` |
    | Quoted period ≠ paid period | Phoenix (quoted per 24h, paid hourly), Paradex `funding_period_hours` |

  - Fixed-point values: Nado `x18`, Bluefin `e9`, Velocity quote/base ÷ oracle TWAP.
  - Interval fields use different units: Bybit minutes, KuCoin ms, Gate seconds, Variational seconds, edgeX minutes, Bitget hours.
  - Timestamps: Aevo uses nanoseconds.
  - OI is reported in base, contracts or USD, so convert everything to USD.
  - **Intervals change** (Binance/Bybit/OKX/Pionex shorten 8h→4h→1h at the cap). In backtests, work out the interval from the gaps between settlements, not from current metadata. Binance `fundingInfo` omits symbols still on the default 8h.
  - Reya reports long and short funding separately.
  - Collateral basis differs (USDT vs USDC vs USDe on HyENA), so show the quote asset.
  - Orderly brokers (WOOFi Pro etc.) share one book, so dedupe.
  - Lighter's funding-rates response includes other venues' rows, so filter by exchange.
- **Predicted vs settled:** Binance `lastFundingRate`, Bybit ticker `fundingRate`, Gate `funding_rate_indicative`, KuCoin predicted, Orderly `est` (8h rolling average) and edgeX forecast are all *predicted*. OKX `nextFundingRate` can be null depending on `method`. Paradex `funding/data` is continuous samples, not settlements. The screener shows predicted APR and also ranks by 24h/7d settled averages. Stability uses settled events only.
- **Symbols:** canonical asset id + contract multiplier (`1000PEPE`, `kBONK`, `XBT`→BTC). The multiplier affects price, not the funding rate. HIP-3 markets are `dex:SYM`, and each HIP-3 dex counts as its own venue. RWA/TradFi pairs must share the same underlying index, not just the ticker.
- **Spread:** apply the filters (OI, volume, staleness, venue) to each leg before taking max/min. No same-venue pairs. Outlier guards: APR cap flag, cross-venue z-score, stale leg (older than 3× interval) excluded.
- **Backtest math:**
  - `qty = size / entry_mark`, the same on both legs.
  - Each settlement cashflow = `qty × mark_at_settlement × rate` (negative for the long leg, positive for the short).
  - Sum each leg's cashflows at its own settlement times, with no resampling or forward-fill. Bucket by UTC day. A gap is flagged, never counted as zero.
  - Costs: 4 taker fills (entry and exit, both legs) plus 4 book-walk slippage estimates. The UI labels the "current book" assumption.
  - Basis PnL `qty × (Δmark_long − Δmark_short)` is shown separately. The headline is "funding net of costs".
  - Definitions shown in the UI: size is per leg; capital = 2 × size / leverage; win rate = % of days with positive net funding; payback = one-time costs / average daily net (shows "never" if ≤ 0).
- **Price arb:** use best bid/ask from book tickers (not mark price). Reject pairs whose timestamps differ by more than about 2s. Net of taker fees on both legs. Executable size comes from depth samples.

---

## Phased delivery (2–3 devs)

### Phase 0 — Foundations and risk spikes (week 1)
1. Scaffold the Bun monorepo: biome, tsconfig, CI (lint, typecheck, `bun test`, `uv run pytest`, `wrangler deploy --dry-run` per app).
2. **57-venue catalog + geo-probe:** a throwaway worker hits every venue's public funding/ticker endpoints four ways: from a cron, from DOs hinted `apac-ne`/`weur`/`enam`, and from Containers pinned to APAC/WEUR. For each, record status, `cf-ray` colo, WAF/CloudFront challenges, bulk-endpoint availability, history lookback and rate-limit weights.
   - Output: `data/venues.json` with a fallback-ladder rung per venue.
   - **Decision gate:** if Binance/Bybit/dYdX only work via rung 3 (relayed) or 4 (non-CF proxy), bring that choice to you before Phase 1.
   - Also confirm: thin fetch adapters load within the Worker's 1s startup limit (don't use ccxt-JS; it pulls the whole library).
3. Spikes:
   - Python Worker cold start with numpy/pandas.
   - Pipelines → R2 Iceberg → R2 SQL query round trip.
   - Size estimate for VenueHistoryDO.
4. **Start referral/affiliate applications** for all venues (approval takes weeks). Legal checklist: exchange ToS on redistributing market data (top 15), affiliate disclosure, geo-gating referral CTAs by `request.cf.country`.

### Phase 1 — Ingestion core + first 10 adapters (weeks 2–4)
- Shared HTTP client: retry with jitter, honors `Retry-After`, identifying User-Agent, per-venue circuit breaker, token bucket in DO storage.
- VenueCollectorDO alarm loop → VenueHistoryDO (settled events **recorded from day 1**) → MarketHubDO → Pipelines. Watchdog cron. Analytics Engine health metrics + stale-venue alert.
- Adapters: Binance, Bybit, OKX, Bitget, Gate, MEXC, Hyperliquid (core + HIP-3 via `allPerpMetas` / `metaAndAssetCtxs{dex}`), dYdX v4 indexer, Paradex, Lighter. Each ships with recorded fixtures + a zod contract test.

### Phase 2 — API + screener + exchange/asset index (weeks 3–6)
- `/v1/screener`, `/v1/assets/:sym`, `/v1/exchanges/:venue`, `/v1/health`. Cache headers: screener `s-maxage=15, swr=60`, pages `s-maxage=60`, ETags. Rate-limiting binding on the API.
- Pages: `/screener`, `/markets`, `/markets/exchange/$venue`, `/markets/asset/$sym`, `/trade`. Dark terminal theme, venue logos, long/short chips, "Backtest" CTA.
- Every row/page shows "Source: {venue} public API · updated {ts}". Disclaimer text ("not financial advice / not affiliated").
- SEO: SSR tables, text summary per asset page, sitemap index, canonical tags (noindex query-param variants of `/pair`).

### Phase 3 — Backtester (weeks 6–7)
- `py-backfill` Container pulls the maximum funding-history lookback + klines (for `mark_px`) across all markets on the 10 venues. Idempotent upserts into VenueHistoryDO + R2. Progress tracked in D1.
- `packages/core/math/backtest.ts` + `/v1/pairs/:sym/backtest` (cache key: sym, long, short, size, days, UTC hour; 1h TTL; Turnstile when the result isn't cached) + `/pair/$sym` UI with equity curve.
- `py-analytics` hourly job computes stability, 7d/30d settled averages and momentum. Its nightly run produces the homepage's "verified 7-day backtests" top 10.

### Phase 4 — Price arbitrage (week 8)
- Book-ticker polling every 5–15s for pairable assets on tier-1 venues, served only from MarketHubDO (not persisted at that resolution; 1-min to Pipelines). `/arbitrage` + `/price-pair/$sym` with spread history from R2 SQL rollups.
- **Public MVP launch at weeks 8–10 with ~15–20 venues.**

### Phase 5 — Scale to ~57 venues (weeks 8–18, run in parallel across devs)
- For each venue: adapter + fixtures + contract test + `venues.json` entry (logo, referral, fees, hint). Simple CEX adapters ~0.5 day; unusual DEXs 1–3 days. Taker fees aren't published consistently, so `venues.json` holds them, verified by hand.
- **Adapter families (build the base once, then configure each venue):**
  - `binance-fapi` base: Binance, Aster, WEEX, Bullet (Binance-compatible APIs).
  - `hyperliquid` base: HL core + every HIP-3 dex via `perpDexs`/`metaAndAssetCtxs{dex}`. Dex ids: `xyz`, `flx` (Felix), `hyna` (HyENA), `km`/`mkts` (Kinetiq), `vntl`, `cash`, `io` (Entropy). Coins are prefixed, e.g. `xyz:XYZ100`.
  - `orderly` base: WOOFi Pro + other Orderly brokers, deduped.
- **Bulk "all markets" endpoints (cheap):**
  - CEX: Binance `premiumIndex`, Bybit `tickers`, Bitget `current-fund-rate`, Gate `contracts`, KuCoin `contracts/active`, HTX `swap_batch_funding_rate`, BingX `premiumIndex`, BitMart `details`, Pionex `indexes`.
  - DEX: Paradex `markets/summary?market=ALL`, dYdX `perpetualMarkets`, Extended `info/markets`, Variational `metadata/stats`, Reya `perpMarkets/summary`, edgeX `getLatestFundingRate`.
- **One call per symbol (spread across alarm cycles):** OKX (verify whether `instId=ANY` works), MEXC, BloFin, Hotcoin, CoinW, Aevo, Ethereal (≤50 ids per call).
- **Tight rate limits, so use WebSocket from the DO:** Lighter (60 req/min without auth), Phoenix (WS-first), Perpl (10 req/min, 16 subscriptions).
- **No funding-history API, so the history DOs are the only source (they record from day 1):** Variational, Reya, LBank. Short lookback: Ethereal ~1 month, Velocity ~30 days.
- **Remaining CEX:** KuCoin, HTX, BingX, BloFin, BitMart, Toobit (symbols like `BTC-SWAP-USDT`), Hotcoin, WEEX, CoinW, LBank, Pionex.
- **Remaining DEX:** WOOFi Pro/Orderly, ApeX Omni, edgeX, Variational (RFQ quotes at $1k/$100k/$1m instead of a book), GRVT, Ethereal, Extended (needs a User-Agent), Aster, **Velocity (formerly Drift, relaunching)**, **Nado (formerly Vertex, now on Ink)**, Reya, Backpack, Aevo, Bluefin, Phoenix, Bullet, Perpl, 01/N1.
- Budget about 20% of ongoing time for adapter breakages (expect 1–3 per week at 57 venues). A nightly live smoke test flags schema drift.

### Phase 6 — Post-MVP
- WebSocket streams for tier-1 price arb (DO outbound WS, reconnect every 15 min on alarm) plus a hibernating LiveFeed DO.
- Airdrop calendar, points calculator, blog/glossary (MDX), en/ru with hreflang, Telegram spread alerts, public read API.

**Rough monthly cost:** ~$30–120. Workers Paid $5; DO alarms ~$5–15; Pipelines/R2/R2 SQL <$20; D1 ~$5; Python Container on demand <$10; relay (if needed) ~$10–40.

---

## Verification
- **Unit (`bun test`):**
  - Annualization per unit/basis/interval.
  - Sign and predicted-vs-settled handling.
  - Spread selection with filters and outlier guards.
  - Slippage book-walk, symbol/multiplier mapping.
  - Backtest math on hand-computed fixtures: 1h leg vs 8h leg, an interval change mid-window, a missing settlement, 4 fills.
- **Python (`uv run pytest` in py/analytics):** stability and momentum against synthetic series. Parity test: the nightly Python backtest matches the TS engine within 1e-6 on shared fixtures.
- **Adapter contract tests:** `packages/adapters/__fixtures__/<venue>/*.json` → valid zod objects. The nightly live smoke test hits real endpoints.
- **Cross-check:** BTC/ETH/SOL APR per venue vs each venue's own UI and vs Hyperliquid `predictedFundings` (Binance/Bybit/HL), tolerance < 0.5 APR pts. Settled sums vs the venue's own funding-history UI.
- **Local E2E:**
  1. `wrangler dev` for `ingest` + `web` (Miniflare DOs/D1).
  2. Trigger the watchdog via `curl "localhost:8787/cdn-cgi/handler/scheduled"`.
  3. Open `/screener` and `/pair/BTC?long=hyperliquid&short=binance&size=10000&days=30` in Chrome (claude-in-chrome); confirm rows, freshness stamps and the equity curve.
- **Staging soak (24h):** all venues fresh in `/v1/health`, alarm overruns = 0, DO CPU p99 within limits, Pipelines lag < 2 min, R2 SQL query over the first day returns the expected row counts.
