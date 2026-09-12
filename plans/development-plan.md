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
| Deployables | **One JS Worker `airates` at the repo root** (`wrangler.jsonc`, `main: apps/worker/src/index.ts`). It merges the planned `ingest` (DOs + watchdog cron) and `web` (API + SSR) services and deploys through Cloudflare Workers Builds (root `/`, deploy command `npx wrangler deploy`, runs on every push to `main`). Python lives in separate Workers Builds projects: `py/analytics` (Python Worker) and `py/backfill` (Container). A Worker is either JS or Python, so Python can't share the root Worker. The optional `relay` container is declared in the root `wrangler.jsonc` if needed. | Matches the existing deploy pipeline. One Worker keeps DO RPC local with no service bindings. |
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
  wrangler.jsonc (the single root Worker, deployed by Workers Builds) · package.json (bun workspaces) · biome.json · tsconfig*.json
  apps/
    worker/         src/index.ts (fetch + scheduled) · probe/ (Phase 0 geo-probe) · ingest/{collector-do,history-do,hub-do,pipeline}.ts · api/ (Hono /v1) · web/ (SSR pages)
    relay/          (only if needed) Dockerfile + Container class, declared in the root wrangler.jsonc
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
> **Status 2026-09-11:** done. Deployed probe: Binance, BloFin, Pionex and Bitget are blocked from every Cloudflare location, so their egress route is an open decision. Bybit, MEXC, Orderly and Extended work when pinned to `apac-ne`. Python Workers on Free run numpy but not pandas. Container and Pipelines spikes were skipped because the account is on Workers Free. Results and the plan changes Free forces are in [`phase0-report.md`](phase0-report.md); referral and legal research is in [`phase0-referrals-legal.md`](phase0-referrals-legal.md).

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
> **Architecture change (2026-09-12, decided after Phase 0):** Workers Free can't hold Phase 1 (Durable Objects there cap at 100k rows written/day and 5 GB; bulk responses blow the 10ms CPU limit). So **collection and storage run on the team's hklab server** (Hong Kong egress, 16 cores / 28 GB): a Bun collector container plus the existing TimescaleDB instance. The Cloudflare Worker stays as the public edge for Phase 2+. From Hong Kong every Phase 1 venue is reachable, and so are Binance/Bybit/Bitget (BloFin still 403), which removes the Cloudflare geo-block problem for the collector. The DO-based ingest design above is superseded for ingestion.

- **`packages/adapters`:** one `VenueAdapter` per venue with pure, fixture-tested parsers; `fetchSnapshots` (bulk current funding + mark/index/OI/volume) and `fetchFundingHistory` (settled payments).
  - Shared JSON client: request spacing, jittered exponential backoff honoring `Retry-After`, per-venue circuit breaker.
- **`apps/collector`** (Bun, Docker on hklab):
  - One `VenueLoop` per venue on a 60s wall-clock cadence (no overlapping cycles, per-cycle timeout).
  - One `HistoryLoop` per venue that pulls settled funding for markets due a settlement (**settled events recorded from day 1**).
  - `CollectorStatus` health endpoint on `127.0.0.1:20090`.
- **`packages/db`:** SQL migrations (TimescaleDB hypertables `funding_snapshots` with 1-day compression and 30-day retention, `funding_events` kept indefinitely, `markets`, `venues`, `collector_runs`) and a migration runner.
- **Storage:** database `vaultdeck` (role `$AIRATES_PG_ROLE`) on the existing `timescaledb_container`, to be moved onto the 466 GB NVMe mounted at `/srv/airates-data` via a tablespace. The mount and the compose volume need sudo on hklab. Integration tests use their own schema, `airates_it`, in `vaultdeck` over an SSH tunnel.
- **Adapters:** Bybit, OKX, Gate, MEXC, **KuCoin**, **Aster**, Hyperliquid (core + HIP-3 dexes via `perpDexs` / `metaAndAssetCtxs{dex}`), dYdX v4 indexer, Paradex, Lighter. KuCoin and Aster replace Binance and Bitget; Binance, BloFin, Pionex and Bitget are deferred by decision.
- **Deploy:** `deploy/hklab/deploy.sh` streams the repo allowlist, builds on the server, and runs `docker compose` on the `postgres_postgres` network. Runbook: `deploy/hklab/README.md`.

> **Status 2026-09-12:** built and verified end to end from a dev machine against `airates_test`.
> - **Coverage:** 20 venues and ~4.8k markets per cycle (Bybit 829, OKX 478, Gate 970, KuCoin 682, Aster 571, MEXC filling toward ~1.2k, Hyperliquid 178, Lighter 217, dYdX 78, Paradex 63, HIP-3 xyz 104 / para 26 / io 6 / mkts 4).
> - **History:** settled-funding sweeps running (e.g. Aster 27k and Bybit 13.6k events on the first sweep).
> - **Verified:** zero 429s after putting Hyperliquid core and HIP-3 on one shared rate-limit group; clean SIGTERM shutdown in ~4s.
> - **Tests:** 179 passing.
> - **Findings:**
>   - The HIP-3 dexes cash, flx, hyna, vntl, km and abcd currently list only delisted assets, so they return 0 markets.
>   - MEXC coin-settled contracts need USD contract sizing.
>   - dYdX BTC funding is often exactly 0 (within the clamp band).
> - **Production:** live on hklab since 2026-09-12 (`airates-collector`). The first check showed all 20 venues fresh, 0 failed runs, ~4.2k markets, 70 MB RAM. The same day the collector moved from `airates` to the owner-provided database `vaultdeck`/`$AIRATES_PG_ROLE`, with row counts verified identical.
> - **Phase 2 access (ready 2026-09-12):** Cloudflare reaches Postgres directly through Hyperdrive config `airates-vaultdeck` (ID `7c04838b33a6423d8a195fafab6d101f`).
>   - TLS was enabled on the instance (reload only).
>   - A private CA was created and uploaded to Cloudflare.
>   - Connections use `sslmode=verify-full`, checked from the internet (TLSv1.3).
>   - Not yet enforced for other clients. Details in `deploy/hklab/README.md`.
> - **Storage (done 2026-09-12):** the NVMe is mounted at `/srv/airates-data`, and `vaultdeck` was moved into tablespace `airates_nvme` (143 MB at move time; 434 GB free).
> - **Background jobs (fixed 2026-09-12):** the shared instance had 16 TimescaleDB workers for 17 databases, so `vaultdeck`'s compression and retention policies had never run. Raised to 24 workers / 48 worker processes (3-second restart); the policies now run successfully. **Phase 1 complete.**

### Phase 2 — API + screener + exchange/asset index (weeks 3–6)
> **Status 2026-09-12: live** at https://airates.jobhesk.workers.dev (noindex until launch).
> - **As built:**
>   - The collector maintains `market_latest`, `market_funding_stats` (24h/7d time-weighted settled APR) and `screener_pairs()` in `vaultdeck` (migration 002).
>   - The Worker reads them through Hyperdrive `airates-vaultdeck` with Postgres.js.
>   - Pages are server-rendered HTML strings plus a small ticking script, instead of React Router: Workers Free allows 10 ms CPU per request, and the deploy has no build step.
>   - The edge cache (Cache API) answers repeat requests in ~50 ms; uncached responses take 0.2–1.6 s.
> - **Shipped:**
>   - Pages: `/`, `/screener`, `/markets`, `/markets/exchange/:venue`, `/markets/asset/:asset`.
>   - JSON: `/v1/health`, `/v1/screener`, `/v1/exchanges[/:venue]`, `/v1/assets/:asset`, `/v1/venues`.
>   - Design: green-bar sheet with the "spread rail" (signed log scale in multi-asset tables).
>   - Footer with source, not-financial-advice and not-affiliated notices; `robots.txt` disallows all; the probe moved to `/probe`.
> - **Deferred from this phase:**
>   - `/trade` referral hub: waits on referral approvals and written data consent.
>   - SEO work (sitemap, canonicals, per-asset copy): not useful while noindex.
>   - Rate-limiting binding and Turnstile: add before launch.
>   - Per-row "source · updated" stamps: currently in the footer only.
> - **Data quality (2026-09-12, measured against live rows):**
>   - **Fixed — extreme funding.** `screener_pairs` takes `p_max_abs_apr`, defaulting to 1000% APR; `?extremes=1` lifts it and the screener form exposes it. 121 of 5397 live markets sat beyond ±200% APR and 10 beyond ±1000%, led by Gate and MEXC microcaps; open interest alone didn't filter them (STORJ_USDT held $1.5M OI at -1595%). Top spread at the default filters fell from 1356% to 521%. Migration 003.
>   - **Fixed — contract scale.** Prices were stored exactly as venues quoted them, so `1000PEPE` / `kPEPE` / `10000CAT` markets sat 1000–10000× above the unscaled venues for the same asset: PEPE marked 0.00000327 on eight venues and 0.00327 on six. 55 markets, ~12k snapshot rows. `perUnitPrice` divides by the multiplier at record time; migration 004 backfills. Funding rates are fractions and were never affected, and `open_interest_usd` was always correct because adapters derive it from the venue's own contract price.
>   - **Fixed — one asset split across two tickers.** `NG`/`NATGAS`, `WTI`/`CL`, `GOLD`/`XAU` and `SILVER`/`XAG` are the same underlying on different venues — confirmed by mark price agreeing to ~0.3% — so they never paired with each other. Now aliased in `parseVenueSymbol`.
>   - **The "ticker collision" premise was wrong.** `CL` ($96.15–96.41 across 7 venues), `BZ` (~$100.4 across 6) and `NG` (~2.94) agree on mark price everywhere, so those spreads are real, not identity errors. Real collisions are rarer and look different: `gate:CAT_USDT` at $817.80 is not the CAT memecoin, `hl-para:STX` at $830.42 is not Stacks, `JPY` is quoted both ways (0.0065 vs 153.45), and `KR200` disagrees by 1371×. `SPX` (~$0.486, the SPX6900 token) must never be merged with `US500` (~$7,650, the index).
>   - **Open — collision guard.** Prefer a mark-agreement check inside `screener_pairs` (legs of one asset must price within a tolerance) over a curated identity map: it is data-driven and catches CAT, STX, JPY and KR200 at once. Only workable now that marks share one scale.
>   - **Fixed — Aster open interest.** All 571 markets reported none, so the default OI filter dropped the whole venue. Binance-style APIs expose it only per symbol (`openInterest` rejects a missing symbol, `ticker/24hr` carries none), so each cycle now refreshes a slice of 120 symbols, re-reading each about every 5 minutes: 124 requests in 16.3s of a 60s cycle, at request weight 1 of ~2400/min. Contracts are priced with the venue's own per-contract mark, before the store rescales prices per base unit.
>   - **Fixed — MEXC coverage after a restart.** MEXC only emits a market once it knows the settlement interval, and that cache was memory-only, refilling at exactly 40 per cycle (measured across three restarts: 160 markets after 4 cycles, 400 after 10, 480 of 1191 after 12). For roughly half an hour most of MEXC was missing from the screener. Adapters can now declare `warmUp`, and the collector seeds them from `activeMarkets` before the first cycle: the first cycle after the deploy emitted all 1191 markets in 4.7s.
>   - **Fixed — stale-venue alerts.** A venue that stops collecting was silent: the site keeps serving its last rows until they age out. The collector now checks `CollectorStatus` every minute and posts transitions (venues newly stale, and full recovery) to `ALERT_WEBHOOK_URL`, Slack- or Discord-shaped. Only transitions are sent, so a partial outage produces a couple of messages rather than one a minute. Inert until the variable is set.
>   - **Fixed — geo-probe cron retired.** It answered its Phase 0 question and the collector runs from hklab now, so the hourly trigger is gone (`crons: []`, which is what deregisters it; dropping the block can leave the trigger registered). The routes and `ProbeDO` stay, so `POST /v1/probe/run` still works if egress ever needs rechecking. Deleting the class outright would need a `deleted_classes` migration and destroys its stored data, so that is left as a deliberate choice rather than a side effect.
- `/v1/screener`, `/v1/assets/:sym`, `/v1/exchanges/:venue`, `/v1/health`. Cache headers: screener `s-maxage=15, swr=60`, pages `s-maxage=60`, ETags. Rate-limiting binding on the API.
- Pages: `/screener`, `/markets`, `/markets/exchange/$venue`, `/markets/asset/$sym`, `/trade`. Dark terminal theme, venue logos, long/short chips, "Backtest" CTA.
- Every row/page shows "Source: {venue} public API · updated {ts}". Disclaimer text ("not financial advice / not affiliated").
- SEO: SSR tables, text summary per asset page, sitemap index, canonical tags (noindex query-param variants of `/pair`).

### Phase 3 — Backtester (weeks 6–7)
> **Status 2026-09-12: history deepened, engine and API live; the page is what's left.**
> - **The blocker was history depth, not the maths.** `sweepVenueHistory` only ever resumes from the newest stored settlement, so every venue held exactly the 7.1 days since collection began on 2026-09-04. A 30-day backtest was arithmetically impossible.
> - **`backfillVenueHistory` reaches the other way**, asking each venue for the span between a 90-day target and the oldest settlement already stored. Confirmed against live APIs first: aster serves back to 2026-06-14, bybit gives bounded windows 90 days back, okx pages 100 at a time, gate returns 60-day windows despite capping an unbounded call at 90 rows. Paradex publishes continuous accrual samples rather than settlements and excludes itself.
> - **Result:** history went from 7.1 to **89.9 days** within minutes of deploying; 253,610 → 271,907 events on the first round of sweeps, bybit's first sweep alone pulling 8,204 events with no errors.
> - **It runs slowly on purpose:** 20 markets per venue every 5 minutes, because deepening the past shares one rate limit with live collection. Markets that return nothing older are remembered as exhausted so later sweeps spend the budget where it still moves.
> - **The engine** (`packages/core/src/backtest.ts`) replays what both legs actually settled, summing each at its own settlement times — Hyperliquid settles BTC hourly against Bybit's 8-hourly, so nothing is resampled onto a shared grid, and a gap is reported as missed settlements rather than counted as zero funding.
> - **Two limits the data forces, both stated rather than papered over.** Notional is held constant at `sizeUsd`: the exact rule is qty × mark-at-settlement × rate, but of 371,170 stored settlements only dydx's carry a mark, so per-settlement precision would be fiction. Basis PnL needs mark history we don't collect and is left out. Costs appear only when the caller supplies fees — the venue catalog has no fee fields at all, and an invented taker fee would quietly corrupt every net figure.
> - **`/v1/pairs/:asset/backtest`** takes exchange names rather than venue symbols (`?long=dydx&short=hyperliquid&days=7`), resolving each to that venue's deepest market for the asset, capped at the 90 days the backfill reaches, cached an hour.
> - **A bug worth remembering:** the endpoint shipped green on 60 tests and failed on every production call. `settlements()` bound a `text[]`, but Hyperdrive requires `fetch_types: false`, and with type introspection off postgres.js sends an array as the bare string `"dydx,hyperliquid"`. The lesson was the coverage, not the query: `app.test.ts` fakes the DataSource, so no test ever executed the SQL. `data.int.test.ts` now drives it against the real schema with production client options.
> - **Built:** the `/pair/$sym` page — leg picker, result, and a server-rendered SVG equity curve (the site has no chart primitive and the Free plan allows 10 ms CPU). It states its own coverage: when a window has fewer days of settlements than requested, it says so rather than annualizing a hole silently.
> - **Next — `/heatmap`, assets × exchanges.** The screener answers "widest spread for one asset"; nothing answers "where does this asset's funding sit everywhere at once" without opening a page per asset. Rows are assets, columns are exchanges, cells are funding APR, after orbitperpscreener.com/screener.
>   - **Measured 2026-09-12:** 1,571 assets × 14 venues, 891 assets on 2+ venues, 4,706 populated cells — a grid only ~38% full, so empty-cell treatment is a design problem, not a detail. Orbit renders ~45,000 cells in a virtualized React client; we render HTML strings under 10 ms CPU, so the default is the **top 150 assets by open interest, paged**.
>   - **Timeframes NOW / 7d / 30d / 60d.** The first two exist; 30d and 60d do not exist in any read model and cannot be computed per request (a 60d aggregate scans ~2.4M `funding_events` rows). They become precomputed columns on `market_funding_stats`, ideally via a TimescaleDB **continuous aggregate** over daily buckets — `funding_events` is already a hypertable — rather than an hourly full rescan on an instance shared with 16 other databases.
>   - **Reuse, don't reinvent:** `railScale`/`railPosition` in log mode already compress ±1000% APR onto 0–100, which is the cell-intensity mapping. `aprTone` is sign-only and is not enough. `probe/render.ts` is already a sticky-header matrix with per-value cell classes — copy the technique, not the file.
>   - Full plan: `~/.claude/plans/whimsical-juggling-dongarra.md`. **Note:** it calls the stat-window migration `006_stat_windows.sql`, but 006 is now `max_leverage` and 007 is `leverage_tiers`, both applied in production. The heatmap migration must be **008**; migrations are applied in filename order and recorded by filename, so a reused number would be skipped as already-applied and the columns would silently never exist.
> - **Next — leverage-aware capital.** The pair page assumes 1×, so "capital $20,000" overstates what a pair ties up. Both legs must be open at once, so the binding constraint is the **lower venue at the entered size**. Capital is `size × (imr_long + imr_short)`: the legs sit on different exchanges and margin independently, so both margins must be posted. At 1× that is `2 × size`, matching what the page shows today, and under symmetric leverage L it reduces to `2 × size / L`. (An earlier revision of this entry said `max(imr_long, imr_short)`, which is one leg's margin and halves the true figure.)
>   - **Why a single number won't do:** Bybit's headline 150% leverage on BTCUSDT holds only to $300k notional and falls to 100× by $2M; OKX starts at 100× and is 40× by its fourth tier; MEXC advertises 500×. A flat max overstates usable leverage by 3–5× at realistic size.
>   - **Spike, done 2026-09-12 — the ladders are not uniform, and that is the whole risk:**
>     - *Free in calls we already make:* Bybit `maxLeverage`, Gate `leverage_max`, KuCoin `maxLeverage`, Hyperliquid `maxLeverage` — and Hyperliquid's full ladder too, since `meta` returns `marginTables` beside `universe`.
>     - *Enumerated, per-symbol call:* Bybit `/v5/market/risk-limit` (35 tiers on BTCUSDT), OKX `/public/position-tiers` (99), Gate `/risk_limit_tiers` (19), KuCoin `/contracts/risk-limit/{sym}` (12).
>     - *Parametric, not a list:* MEXC `riskBaseVol`/`riskIncrVol`/`riskIncrImr` — a formula, currently degenerate (one level, flat 500×).
>     - *Unit trap:* OKX tier bounds are in **contracts**, not USD (`ctVal 0.01 BTC`, so `maxSz 1000` = 10 BTC ≈ $780k). Gate, Bybit and KuCoin bound in quote notional. Converting needs `ctVal × mark`, the same normalisation already done for open interest.
>     - *Flat:* dYdX (`initialMarginFraction` 0.02 → 50×). *Absent:* Aster, Paradex, Lighter.
>   - **Storage:** one uniform table `market_leverage_tiers (venue_id, venue_symbol, tier, lower_notional_usd, upper_notional_usd, imr, mmr, max_leverage, fetched_at)`. Parametric ladders are expanded to rows at ingest and contract bounds converted to USD, so the read path is a single `WHERE size BETWEEN lower AND upper` on both legs. Tiers change rarely, so refresh daily, not per cycle.
>   - **Order — thin vertical slices, riskiest unknown first, each one shippable:**
>     1. **A1 — flat max, zero new requests. Shipped 2026-09-12.** Capture `maxLeverage` already present in the bulk responses (Bybit, Gate, KuCoin, Hyperliquid) into a nullable `markets.max_leverage`. Pair page shows `2 × size / min(long, short)`, `–` where unknown. *Check:* capital changes on a BTC pair and stays honest where a venue is silent.
>        - Migration `006_max_leverage.sql`; the four adapters set `maxLeverage` from calls the collector already makes every cycle, so the request budget is unchanged. `markets.max_leverage` uses `COALESCE(EXCLUDED, existing)` like `interval_hours`, so a response that transiently omits the field does not erase a known value.
>        - The read path joins `markets` from `market_latest` rather than denormalising a second copy of the column, keeping one source of truth. Capital is the lower of the two venues' maxima: a pair cannot run at 100× on one leg if the other caps at 10×. A venue that publishes nothing drops the whole pair to unleveraged rather than borrowing its partner's figure — the same rule as absent fees and absent marks.
>        - *Verified in production on the first post-restart cycle:* gate 970/970 markets, bybit 829/829, kucoin 682/682, hyperliquid 178/178 plus every HIP-3 dex. Aster, dYdX, Lighter, MEXC, OKX and Paradex stay NULL, which is exactly A1's declared scope (dYdX is flat 1/IMF and MEXC/OKX are parametric or contract-bound — both B3).
>        - *Incidental fix:* `settlements()` ordered only by `settled_at`, so markets settling on the same tick came back in planner-dependent order. The order is now total (`settled_at, venue_id, venue_symbol`); an integration test had been passing on luck.
>     2. **B1 — one venue end to end. Shipped 2026-09-12.** Migration + tier table + Bybit's enumerated ladder + IMR capital on the pair page. *Check:* an integration test in `data.int.test.ts` (production client options) and a hand-computed tier boundary — $250k vs $2M on BTCUSDT must give different capital.
>        - **The sweep is whole-venue, not a per-symbol rotation — probing the API changed the design.** `/v5/market/risk-limit` with no `symbol` returns *every* symbol, paginated; it ignores `limit` and yields ~15 symbols a page, so the entire linear book costs ~56 requests rather than one per market. It therefore runs daily as a single `PeriodicTask` and needs no budget. **This is the third collector sweep but the first with no per-cycle budget, so it does not multiply the rotation pattern.** The consolidation I wanted before B3 now only matters for venues whose tiers are per-symbol only (Gate, KuCoin, OKX) — check each venue for a bulk endpoint before assuming a sweep is needed.
>        - **Half-open bounds `[lower, upper)`.** Bybit publishes only an upper bound per tier, so each tier inherits its floor from the one below. Verified in production on BTCUSDT: tier 1 `[0, 300k)` imr 0.0066 (150×), tier 2 `[300k, 2M)` imr 0.01 (100×), tier 3 `[2M, 2.6M)` imr 0.0111 (90×). The plan's boundary check passes — $250k lands in tier 1 and $2M in tier 3, since $2M is excluded from tier 2's open upper bound.
>        - **The top tier's bound is a real cap, not infinity.** Bybit will not open a BTCUSDT position above $1.2bn at all, so a size above every tier resolves to *no* tier and the page says the venue would refuse it, rather than rounding down into the top band and quoting capital for a trade that cannot exist. A null upper bound is reserved for venues that genuinely publish no cap.
>        - **A ladder with an unreadable tier is dropped whole**, since keeping the rest would silently stretch a neighbouring band across the gap. Tiers **upsert then prune** (never delete-then-insert: the worker reads this table continuously), and an **empty sweep is treated as a failed request**, so a timeout can never erase good ladders.
>        - *Verified in production:* migration 007 applied 10:53:33Z; first sweep at 10:57:39Z stored **25,318 tiers across 873 markets** in ~6s.
>        - **No live pair reaches the tiered path yet.** Both legs need a ladder, pairs span two exchanges, and Bybit is the only venue with `fetchLeverageTiers` — so until B2 lands OKX, every pair still renders the A1 headline path. B1's value in production is the stored ladder and the tested read path, not a visible change.
>     3. **B2 — normalisation proven on the hard case.** Add OKX, converting contract bounds via `ctVal × mark`. *Check:* OKX tier 1 resolves to ≈$780k, not $1,000. This is the slice most likely to be wrong, which is why it comes before fan-out.
>     4. **B3 — fan out on the existing sweep pattern.** Gate, KuCoin, MEXC (expanding the formula), Hyperliquid (from `marginTables`, no extra call), dYdX (`1/IMF`). Budgeted rotation like `backfillVenueHistory` and the Aster OI refresh — ~4,700 backtestable markets at 20 per 5 min is roughly a 20-hour pass, which is fine for data that changes rarely.
>     5. **B4 — the three gaps.** Aster, Paradex and Lighter publish nothing usable; hand-curate a conservative single value in the venue catalog beside the taker fees, and render `–` until then.
>   - **Ordering rationale:** A1 ships value on day one with no new requests; B1 proves the schema on the simplest enumerated ladder; B2 attacks the unit conversion while the blast radius is one venue; only then does B3 multiply the request load. Each slice leaves the pair page correct, never half-migrated.
> - **Note:** the original plan's Phase 3 text below predates the hklab architecture. There is no `py-backfill` Container, no VenueHistoryDO and no R2: history lives in `funding_events` in vaultdeck, and the backfill is part of the collector.
- `py-backfill` Container pulls the maximum funding-history lookback + klines (for `mark_px`) across all markets on the 10 venues. Idempotent upserts into VenueHistoryDO + R2. Progress tracked in D1.
- `packages/core/math/backtest.ts` + `/v1/pairs/:sym/backtest` (cache key: sym, long, short, size, days, UTC hour; 1h TTL; Turnstile when the result isn't cached) + `/pair/$sym` UI with equity curve.
- `py-analytics` hourly job computes stability, 7d/30d settled averages and momentum. Its nightly run produces the homepage's "verified 7-day backtests" top 10.

### Phase 4 — Price arbitrage (week 8)
> **Added 2026-09-12: do liquidations predict funding regime switches?** Study whether liquidation activity has a regression relationship to switches in funding-rate patterns, then visualise it for the top assets.
>
> - **The honest starting point: we have none of the required data.** A repo-wide search for "liquidat" returns nothing, no adapter exposes a liquidation or kline endpoint, and the database has 8 tables — funding, markets, venues, runs. The study cannot begin until liquidation ingestion exists, so that is the first deliverable, not the analysis.
> - **Prefer liquidation *events* over a liquidation *heatmap*.** A Hyblock/Coinglass-style heatmap is a **model** — estimated liquidation levels inferred from open interest, assumed leverage tiers and price — not observed data. Forced closes are directly observable on venue websockets (Binance `forceOrder`, Bybit `liquidation`, OKX, Hyperliquid). For a regression, observed events are the sounder regressor; a modelled heatmap would mostly measure our own leverage assumptions. Build the event feed first; a heatmap can be derived later if it earns its place.
> - **Data source is an open decision.** Self-collect via websockets on hklab (no licence cost, new long-lived WS ingestion alongside the REST collector, and the only route that keeps us clear of redistribution terms), or buy a third-party feed (faster, but paid and squarely in the exchange-ToS risk already flagged in `plans/phase0-referrals-legal.md`). Recommend self-collecting the top venues.
> - **The funding side is already rich:** 387,565 sign flips across 3,464,934 settlements in 90 days, so "regime switch" has ample material. Define it precisely before fitting anything — a sustained sign flip, or a z-score break against the market's own trailing distribution — and pre-register the definition, or the study will find whatever it is asked to find.
> - **The price series is young, not broken.** `funding_snapshots` holds 2 days (4.58M rows, ~860 samples/24h for bybit BTCUSDT, about one per 100s) against a 30-day retention policy, and it is accumulating normally — `collector_runs` starts on the same date, so live collection genuinely began 2026-09-11 and nothing was dropped. The earlier `funding_events` history reaches 2026-06-13 only because it was *fetched* from venue history APIs and backfilled, which snapshots cannot be. So an event study must either wait for the series to fill toward 30 days, or collect klines. Do not read the short span as data loss.
> - **Method sketch:** per market, per interval — liquidation notional and count (long vs short) as regressors; outcome is the funding-rate change or the probability of a sign flip in the next N settlements. Panel regression with market fixed effects, clustered by venue. Report effect sizes and confidence intervals, and state plainly that this is association, not causation — funding and liquidations are both driven by price moves, so any naive fit will be confounded.
> - **Visualisation, top assets:** a per-asset panel pairing the funding series with liquidation intensity on a shared time axis, plus a scatter of liquidation notional against subsequent funding change. Same constraints as the rest of the site — server-rendered SVG, no chart library, 10 ms CPU — so it reuses the sparkline/equity-curve approach already built in `pages.ts`.
>
- Book-ticker polling every 5–15s for pairable assets on tier-1 venues, served only from MarketHubDO (not persisted at that resolution; 1-min to Pipelines). `/arbitrage` + `/price-pair/$sym` with spread history from R2 SQL rollups.
- **Public MVP launch at weeks 8–10 with ~15–20 venues.**

### Phase 5 — Scale to ~57 venues (weeks 8–18, run in parallel across devs)
- For each venue: adapter + fixtures + contract test + `venues.json` entry (logo, referral, fees, hint). Simple CEX adapters ~0.5 day; unusual DEXs 1–3 days. Taker fees aren't published consistently, so `venues.json` holds them, verified by hand.
- **Adapter families (build the base once, then configure each venue):**
  - `binance-fapi` base: Binance, Aster, WEEX, Bullet (Binance-compatible APIs).
  - `hyperliquid` base: HL core + every HIP-3 dex via `perpDexs`/`metaAndAssetCtxs{dex}`. Dex ids from `perpDexs` (2026-09-11): `xyz`, `flx` (Felix), `hyna` (HyENA), `km`/`mkts` (Kinetiq), `vntl` (Ventuals), `cash` (dreamcash), `para` (Paragon), `io` (Entropy), `abcd` (unidentified). Coins are prefixed, e.g. `xyz:XYZ100`. Bullpen is a Hyperliquid front-end, an alias with no markets of its own.
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

> **Workers Free (current account):** Containers and Pipelines are unavailable. Free's limits (10ms CPU and 50 subrequests per invocation, 100k requests/day) don't fit Phase 1's 60s polling of ~57 venues with 1–2 MB bulk responses. Phase 0 recommends upgrading to Paid before Phase 1; see [`phase0-report.md`](phase0-report.md) for the Free-plan substitutes (R2 NDJSON archive, backfills from CI, fallback rungs 3/4 only).

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
