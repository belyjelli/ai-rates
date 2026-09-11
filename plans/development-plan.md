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
> **Status 2026-09-12: history deepened, engine not started.**
> - **The blocker was history depth, not the maths.** `sweepVenueHistory` only ever resumes from the newest stored settlement, so every venue held exactly the 7.1 days since collection began on 2026-09-04. A 30-day backtest was arithmetically impossible.
> - **`backfillVenueHistory` reaches the other way**, asking each venue for the span between a 90-day target and the oldest settlement already stored. Confirmed against live APIs first: aster serves back to 2026-06-14, bybit gives bounded windows 90 days back, okx pages 100 at a time, gate returns 60-day windows despite capping an unbounded call at 90 rows. Paradex publishes continuous accrual samples rather than settlements and excludes itself.
> - **Result:** history went from 7.1 to **89.9 days** within minutes of deploying; 253,610 → 271,907 events on the first round of sweeps, bybit's first sweep alone pulling 8,204 events with no errors.
> - **It runs slowly on purpose:** 20 markets per venue every 5 minutes, because deepening the past shares one rate limit with live collection. Markets that return nothing older are remembered as exhausted so later sweeps spend the budget where it still moves.
> - **Next:** the engine itself — `packages/core` backtest maths against the plan's cashflow rules (per-leg settlement times, no resampling, gaps flagged rather than zeroed), then `/v1/pairs/:sym/backtest` and the `/pair/$sym` page.
> - **Note:** the original plan's Phase 3 text below predates the hklab architecture. There is no `py-backfill` Container, no VenueHistoryDO and no R2: history lives in `funding_events` in vaultdeck, and the backfill is part of the collector.
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
