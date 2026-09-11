# Phase 0 report

Date: 2026-09-11. Scope: plan §"Phase 0 — Foundations and risk spikes". Account: **Cloudflare Workers Free** (your choice), so Containers and Pipelines are out of scope.

## Status

| Item | Status | Where |
|---|---|---|
| Bun monorepo, Biome, tsconfig, tests | ✅ Done | root, `packages/*`, `apps/worker` |
| CI (lint, typecheck, `bun test`, dry-run bundle, `uv run pytest`) | ✅ Done | `.github/workflows/ci.yml` |
| Venue catalog (61 venues, 68 probe endpoints) | ✅ Done, live-checked | `packages/venues/src/catalog.ts` |
| Geo-probe Worker (7 Durable Object runners) | ✅ Built, sized for Free-plan limits, local E2E passes | `apps/worker/src/probe/*` |
| **Geo-block decision gate** | ✅ Measured (2 deployed runs); **a choice is needed for 4 venues** | see "Decision gate", `packages/venues/src/geo.ts` |
| Size estimate for VenueHistoryDO | ✅ Done | `scripts/estimate-history-size.ts` |
| Python Worker cold-start spike | ✅ Deployed: numpy works (~1.0–1.3s cold, ~60–75ms warm); **pandas fails on Free** | `py/spike`, https://airates-py-spike.jobhesk.workers.dev |
| Container probe runners | ⛔ Skipped: Containers need Workers Paid | — |
| Pipelines → R2 Iceberg → R2 SQL spike | ⛔ Skipped: Pipelines needs Workers Paid | — |
| Referral programs + legal checklist | ✅ Research done; applications are on the team | `plans/phase0-referrals-legal.md` |

## Results

### Venue catalog
- **61 venues:**
  - 17 CEX
  - 33 DEX
  - 11 HIP-3 dexes, including `abcd`, which Hyperliquid's `perpDexs` lists but ORBIT doesn't
- **Live pass from Bangkok (`bun run probe:local`):** 66 of 68 endpoints returned 2xx JSON, in 5.3s total.
- **Two venues have no REST probe:**
  - **Bullpen:** a Hyperliquid front-end, recorded as `aliasOf: "hyperliquid"`.
  - **TxFlow:** its API page says "coming soon", and `api.txflow.com/info` returns 403 to public POSTs, so it may be WebSocket-only.
- **Largest bulk responses:** Paradex 2.0 MB, KuCoin 1.4 MB, Gate 1.2 MB, BitMart 1.0 MB, Extended 0.9 MB. This drives the CPU finding below.
- **Research corrections folded into the catalog:**
  - edgeX V2 lives on `edgex-prod-v2.edgex.exchange` and needs `contractId` lists.
  - Hotcoin and WEEX have bulk endpoints.
  - Hibachi, N1 and ApeX are per-symbol only.
  - Nado's `funding_rate` is a 24h rate, and Nado's gateway needs `Accept-Encoding`.
  - GRVT's `funding_rate_8h_curr` looks like a percent value.
  - Perpl rates are micros.
  - Phoenix has no current rate in its markets endpoint.

### Geo-probe on the Free plan
The first deploy ran every venue in a single invocation, which breaks two Free-plan limits: 50 subrequests and 10ms of CPU per invocation. It was rebuilt as follows:
- **Batched alarms:** each runner is a SQLite Durable Object that probes **8 endpoints per alarm** and re-arms until all 68 are done. That's 9 alarms per run, about 1.5k invocations/day across 7 runners at the hourly cron.
- **Cheap handling of big bodies:** bodies over 16 KB are not JSON-parsed. Only the first 4 KB is decoded, and the first and last bytes are checked for balanced brackets.
- **Runners:** the inline cron runner is replaced by `do@default` (no location hint) plus six hinted runners: `wnam`, `enam`, `weur`, `eeur`, `apac-ne`, `apac-se`.
- **Local E2E:** a triggered cron finished all 7 runners with 68 results each. A manual run returned 202 and a repeat within 10 min returned 429. `/` renders.

### History store size (VenueHistoryDO)
Measured with SQLite `WITHOUT ROWID` tables matching the plan's schema:

| Table | Bytes/row | Per market |
|---|---|---|
| `funding_events` (1y hourly) | 40 | 0.34 MiB |
| `snap_5m` (30d) | 49 | 0.41 MiB |
| `rollup_1h` (1y) | 67 | 0.56 MiB |

That totals **1.3 MiB per market**. A venue with 600 markets is 0.76 GiB, 8% of the 10 GiB Durable Object limit, so one history DO per venue is comfortable.

### Python Worker spike (`py/spike`)
**Deployed on Workers Free (2026-09-11):**

| Variant | Upload (gzip) | First request (cold) | Warm |
|---|---|---|---|
| No packages (throwaway, deleted) | 27 KB | 0.93s | 66ms |
| numpy only (throwaway, deleted) | 2.7 MB | 0.85s | 59ms |
| **`py/spike`, numpy only** | 2.8 MB | 1.0–1.3s | 60–75ms |
| `py/spike` with pandas | 7.0 MB | **HTTP 503 / error 1105 on every request**, no logs in `wrangler tail` | — |

- **pandas doesn't run on Free:** it fails before any Python code executes (most likely the 128 MB memory limit or snapshot size). numpy alone is fine. The spike was rewritten numpy-only (UTC-day bucketing via `np.unique` + `np.bincount`), and Python analytics on Free must avoid pandas. Whether pandas works on Workers Paid is unverified.
- **`compute_ms` reads 0 in production** because Workers clocks only advance on I/O; use external latency instead.

**Local findings (`pywrangler dev`):**
- **Stack:** numpy 2.4.6 and pandas 3.0.2 load on Pyodide (Python 3.14) under `pywrangler dev`. Local dev does not enforce the Free memory limit, which is why pandas worked there.
- **Local timings:** the first request took 20.5s (local package load, not representative of production snapshots). Later requests took about 14ms, and the 30-day two-leg backtest computed in about 7ms.
- **Real bug found:**
  - Python Workers are **wasm32**, so numpy's default integer is 32-bit, and `np.arange(n) * 3_600_000` overflows on epoch-ms timestamps.
  - It passes on 64-bit CPython, so CPython tests miss it.
  - Fixed with an explicit-int64 `settlement_times()` and a regression test.
  - Rule for all Python code: **use int64 for timestamps.**
- **Tooling:** `pywrangler` needs uv ≥ 0.12.3; this machine has 0.9.27. The command below ran it without touching the system uv:
  ```
  uvx --from 'uv==0.12.13' uv run pywrangler dev
  ```
- Deploy with `uvx --from 'uv==0.12.13' uv run pywrangler deploy` from `py/spike`.

## What Workers Free changes in the plan

1. **Phase 1 ingestion won't fit on Free.** A 60s alarm per venue is ~82k invocations/day (57 × 1440), close to Free's 100k requests/day before any page traffic. Parsing the 1–2 MB bulk responses also takes well over 10ms of CPU. **Recommendation: upgrade to Workers Paid ($5/mo) before Phase 1.** Staying on Free means polling every 5–10 minutes and skipping or streaming the large endpoints.
2. **Fallback rung 2 (Container egress) is gone.** If a venue is geo-blocked from every hinted location, the options are:
   - rung 3: relayed rates via Hyperliquid `predictedFundings` or Lighter `funding-rates` (rates only)
   - rung 4: a non-Cloudflare proxy (needs your approval)
   - upgrading to Paid
3. **Pipelines is gone,** which removes the raw firehose. Replacement: the ingest DOs write hourly NDJSON.gz batches straight to R2 (Free includes 10 GB). Batch analytics then read R2 from the Python side or from DuckDB offline. R2 SQL availability on Free is unverified.
4. **The Python backfill Container is gone.** Run historical backfills from GitHub Actions or a dev machine (full CPython and ccxt), then load results through an authenticated admin endpoint on the Worker.

## Decision gate
**Probe:** https://airates.jobhesk.workers.dev (matrix at `/`, JSON at `/v1/probe`). Two runs on 2026-09-11 (16:22 and 16:33 UTC) returned the same results. The hints placed the runners as follows:

| Runner | default | wnam | enam | weur | eeur | apac-ne | apac-se |
|---|---|---|---|---|---|---|---|
| Colo | SIN | LAX | ORD | MRS | PRG | NRT | SIN |

Every runner's `/cdn-cgi/trace` reports the same internal IPv6 and `loc=US`. Requests to Cloudflare's own zone don't show the IP an exchange sees, so trust the verdicts, not the `loc` field.

| Venue | Result | Outcome (`packages/venues/src/geo.ts`) |
|---|---|---|
| **Binance** | 403 CloudFront "Request blocked" from **all 7** runners | ❌ undecided |
| **BloFin** | 403 HTML page from **all 7** | ❌ undecided |
| **Pionex** | 429 on the first request from **all 7** (shared Cloudflare egress) | ❌ undecided |
| **Bitget** | 403 `{"cloudflare":"block"}` from all 6 hinted runners (only the un-hinted SIN runner passed) | ❌ undecided |
| Bybit | CloudFront country block from US runners only | ✅ direct via `apac-ne` |
| MEXC | Akamai 403 from LAX only | ✅ direct via `apac-ne` |
| WOOFi Pro (Orderly) | 403 from SIN (un-hinted) and LAX | ✅ direct via `apac-ne` |
| Extended | timeouts from MRS in both runs | ✅ direct via `apac-ne` |
| The other 51 probed venues (incl. dYdX, OKX, Hyperliquid + HIP-3) | ok from every runner (one-off 429s from OKX and Phoenix, one Velocity timeout) | ✅ direct, any hint |

**Decision needed for Binance, BloFin, Pionex and Bitget:**
- **Rung 3, relayed:** Binance rates only, via Hyperliquid `predictedFundings` / Lighter `funding-rates`. No OI, volume or book. No relay exists for BloFin, Pionex or Bitget.
- **Rung 4, non-Cloudflare proxy:** a small VPS (Tokyo or Singapore) that the collector DOs call for these venues. It breaks "100% Cloudflare" for egress only.
- **Workers Paid + Container rung:** Container egress IPs may be treated differently, but that's unverified; it would need a Paid-plan probe first.
- **Defer:** launch without these four venues (or Binance relayed only) and revisit.

Binance, together with OKX, MEXC and KuCoin, also needs written data consent before monetized display (see the legal doc). A proxy that solves the IP block doesn't solve that.

## Blockers and actions for you
1. **Choose the egress route for Binance, BloFin, Pionex and Bitget** (see "Decision gate").
2. **Workers Paid before Phase 1** (see above).
3. **Market-data consent.** The terms of Binance, OKX, MEXC and KuCoin (plus Aster, and possibly Paradex) appear to forbid profiting from their market data, "including through advertising or referral fees", without written consent. Email them during affiliate onboarding; counsel should review. Details: `plans/phase0-referrals-legal.md`.
4. **Referral applications and KYC'd entity accounts:** see the ordered action list in the legal doc.
5. **Revoke the GitHub token saved in the git remote URL** and switch to `gh auth login`.
