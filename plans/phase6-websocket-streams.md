# Phase 6 — WebSocket quote streams, on hklab

Written 2026-09-14, when Phase 6 opened. The plan's own Phase 6 line prices this as "WebSocket
streams for tier-1 price arb (DO outbound WS, reconnect every 15 min on alarm) plus a hibernating
LiveFeed DO". **That substrate does not exist and is not where ingestion lives.** This is the fifth
instance of the same correction already recorded for `py-backfill`, `VenueHistoryDO`, `py-analytics`
and `MarketHubDO`: `wrangler.jsonc` declares `durable_objects` with only `ProbeDO`, no Pipelines, no
R2, no queues — and collection has run from hklab since Phase 1. A socket feed belongs beside the
collector, not in a Durable Object.

Venue facts below were researched from official documentation on 2026-09-14 and are cited. Where a
figure is absent from the docs it says **UNVERIFIED** rather than carrying a number someone guessed.

---

## 1. What the venues actually publish

Only three venues publish top of book at all, and they are the same three already parsed for it over
REST (migration 013): gate, okx, bybit.

| | gate | okx | bybit |
| --- | --- | --- | --- |
| endpoint | `wss://fx-ws.gateio.ws/v4/ws/usdt` | `wss://ws.okx.com:8443/ws/v5/public` | `wss://stream.bybit.com/v5/public/linear` |
| BBO channel | `futures.book_ticker` (10 ms) | `bbo-tbt` (10 ms) | `orderbook.1.{sym}` (10 ms) |
| BBO shape | snapshot | snapshot | snapshot |
| trades channel | `futures.trades` | `trades` / `trades-all` | `publicTrade.{sym}` |
| taker side | signed `size` | `side` | `S` |
| all-symbols form | **no** | **no** | **no** |
| per-conn topic cap | UNVERIFIED | UNVERIFIED (64 KB/request) | **21,000 chars of `args`** |
| conns per IP | UNVERIFIED | — | 1,000 (market data) |
| idle disconnect | — | **30 s** | 10 min |

**No venue offers an all-symbols subscription.** Gate's `!all` exists but only for
`futures.public_liquidates` and `futures.adl_warning`. So topics scale with market count: bybit 829
linear, gate 970, okx 479.

**Bybit is the only venue with a hard arithmetic limit**, and it is the one that binds. At ~21
characters per topic including JSON quoting, 21,000 chars is roughly 850–1,000 topics per
connection: bybit's 829 markets fit BBO on **one** connection at ~83% of budget, and BBO+trades
needs **two**. OKX and gate document no per-connection cap at all, so each could in principle run its
whole book on one connection — an undocumented assumption, so probe it and shard to 2–4 anyway for
failure isolation and reconnect-storm control.

**Total: roughly 6–12 connections.** That is the number that changes the design.

### Two corrections to assumptions made before the research

- **"Sockets mean hundreds of connections" was wrong.** It is under a dozen. Every argument resting
  on per-connection memory — including the case for writing this in Go — loses most of its force.
- **"Top of book needs no delta handling" is right for BBO and wrong for bybit's `tickers`.**
  `orderbook.1`, `bbo-tbt` and `futures.book_ticker` are all snapshot-style, so the U/u resync
  machinery is unnecessary. But bybit's `tickers.{sym}`, which is tempting because it carries
  `bid1Price`/`ask1Price` **and** `fundingRate`/`nextFundingTime` in one topic, is **delta** for
  linear. Taking it to halve topic pressure means taking on delta merging. Start with
  `orderbook.1` and treat `tickers` as a later optimisation with its own slice.

## 2. The constraint is CPU, not connections or memory

The collector container is `mem_limit: 1g`, **`cpus: 1.0`**, already running 56 venue loops plus
history, backfill, tier and liquidation tasks — and it was OOM-restarting every ~50 minutes at
56 venues until the limit was raised from 512 MB on 2026-09-14 (peak 537 MB, cap hit 1,508 times in
one boot, which silently starved the nightly backtest and ranking jobs).

2,278 markets pushing at up to 10 ms granularity is, at one update per market per second, ~2,300
messages/second, and an order of magnitude more in fast markets. `JSON.parse` at that rate inside
the same single-CPU process as the poll loops will starve them, and a starved poll loop is a stale
venue, which is the failure `/status` and the stale-venue alerter exist to catch.

**So the first design decision is not to subscribe to everything.** `/arbitrage` only compares assets
listed on two or more venues and passing the depth and mark-agreement guards; a market nothing can
pair with contributes no row. The feed therefore subscribes to a **selected set** — pairable assets
above the open-interest floor — refreshed periodically from `market_latest`, not to all 2,278.

*This set has not been measured yet and must be before the subscription list is built.* The
arbitrage page reported 721 comparable assets across all venues, so the three-venue intersection is
materially smaller than 2,278 markets; how much smaller is the number that decides whether this runs
in-process.

## 3. Writer: an in-memory map flushed on a timer

`recordBatch` is one transaction per venue cycle writing `markets`, `funding_snapshots`,
`market_latest` and `funding_events` together. **A socket feed must never call it per message.**
`funding_snapshots` already takes ~324k rows/hour at 60-second polling; per-tick inserts on a
Postgres shared with 16 other tenants is the obvious mistake.

- Latest quote per `(venue_id, venue_symbol)` is held **in memory** and overwritten on each message.
- A timer flushes the dirty entries to `market_latest` only — **never to `funding_snapshots`**,
  because a quote is not a funding observation.
- The flush is a **partial, quote-scoped upsert**: only `best_bid`, `best_bid_size_usd`, `best_ask`,
  `best_ask_size_usd` and the new `quotes_at`.

### The migration is forced, and the reason is in the read path

`market_latest` has **one** `observed_at`, written by the funding path under
`WHERE EXCLUDED.observed_at >= market_latest.observed_at` (migration 013 added the four quote columns
and no timestamp). `arbitrage()` gates both its candidates and its anchors on
`observed_at > now() - FRESH_INTERVAL` (5 minutes). That creates a bind with no acceptable side:

- If quotes do **not** touch `observed_at`, a venue whose funding poll dies takes its still-live
  quotes off `/arbitrage` with it.
- If quotes **do** touch it, they silently resurrect a dead venue's funding row and defeat the
  stale-venue alerting added after the last silent outage.

**Migration 022 adds `quotes_at timestamptz`**, and the arbitrage query's freshness test splits: mark
and identity keep reading `observed_at`, the bid/ask columns read `quotes_at`. A row may then be
fresh in one sense and stale in the other, which is the truth and must render as such.

## 4. Health: let the flush be the run

`VenueHealth` is `{venueId, lastRunAt, lastSuccessAt, markets, error, stale}` and `stale` derives
from `intervalMs × staleAfterIntervals` — a polling concept. A connected-but-silent socket has no run
to record, and `CollectorStatus.record()` takes a `CollectorRun` with `durationMs`/`requests`.

Rather than extend the health model, **the flush window synthesizes a `CollectorRun`**: `markets` =
quotes flushed, `requests` = 0, `durationMs` = flush duration, `error` = the connection's last fault.
`/health`, `/status`, the `planned`/`silent`/`stale` states and the stale-venue alerter then all work
untouched. A feed that is connected but receiving nothing flushes zero quotes and goes stale on its
own, which is the correct reading.

## 5. Lifecycle and conventions, mirrored rather than reinvented

- Implements `{ stop(): Promise<void> }` so it joins `loops[]` and the SIGTERM path inside
  `SHUTDOWN_GRACE_MS`; `stop()` closes sockets and resolves.
- **Never overlaps and never throws**, the contract `VenueLoop` and `PeriodicTask` both state.
- Reconnect mirrors `http.ts`: jittered exponential backoff from 500 ms capped at 15 s, and a
  circuit breaker at 5 consecutive failures with a 5-minute cooldown and a half-open probe.
- The socket factory is **injected**, as `FetchLike` is, so tests never patch a global.
- Keepalive per venue: okx disconnects after **30 s** idle and pings every 20 s expecting a pong
  within 60 s; bybit wants a ping every 20 s and cuts off after 10 minutes; gate replies to
  protocol pings and offers `futures.ping`. These differ enough to be per-venue config, not one
  constant.
- Config follows `COLLECT_VENUES`: `STREAM_VENUES` (**default empty — the feed is off** until
  explicitly enabled) and `STREAM_FLUSH_MS`.

## 6. Bun in-process, or a separate Go service?

The Go case was argued on per-connection memory. At **6–12 connections that case is weak**, and the
real risk is CPU contention on a 1.0-CPU container. Both a Bun feed and a Go feed solve that by being
a separate process with its own limits.

**Recommendation: build it in Bun, in-process, against a selected subset, and measure.** Reasons: the
adapters, units conversions and `perUnitPrice` rescaling already live in TypeScript and a Go feed
would have to re-derive every one of them — the 10,000× top-of-book size trap across these exact
three venues is recorded in migration 013's own header; `profitlock-worker` has **no database layer**
(no pgx, no `database/sql`), so a Go ingester starts by writing one; and splitting the collector
across two languages means the quote semantics need shared test vectors, the precedent set for
`fees.ts`.

**What would change it:** if measured CPU shows the feed starving the poll loops even on the reduced
subject set, move it out — and at that point Go is the better destination than a second Bun process,
because `profitlock-worker` already runs a mature `coder/websocket` client with capped jittered
backoff, reconnect and heartbeat in `internal/relay/client.go`, which is most of the hard part.

## 7. Slices, riskiest unknown first

- **W0 — probe, no code kept.** Open one connection per venue and measure: how many topics each
  actually accepts (okx and gate document no cap), real message rate on the pairable subset, and the
  CPU cost of parsing it. This is the slice that decides §2 and §6, and its output is numbers.
- **W1 — migration 022 + the quote-scoped writer**, with `arbitrage()` split across `observed_at`
  and `quotes_at`. No socket yet; the writer is exercised by tests. Ships the schema change that
  everything else needs, and is independently reviewable.
- **W2 — one venue end to end.** Bybit, because it is the only venue with a documented hard limit,
  so the connection-sharding logic is written against a real constraint rather than a guess.
  Verification: a quote visible on `/arbitrage` with `quotes_at` newer than `observed_at`.
- **W3 — gate and okx**, including okx's 30-second idle discipline and the EEA/US endpoint split.
- **W4 — subscription-set refresh**, so newly listed pairable markets join without a restart.

## 8. Deliberately not doing

- **No `funding_snapshots` writes from the feed.** Quotes are not funding observations, and the
  table's 30-day retention is already the largest thing in the database.
- **No depth beyond level 1.** Every BBO channel here is snapshot-style; adding book depth means
  taking on U/u resync on all three venues and is a separate decision.
- **No bybit `tickers` shortcut in W2**, despite it carrying funding — it is delta for linear.
- **No CVD yet.** But see below.

## 9. The CVD trigger has fired, and it is recorded rather than acted on

[`charting-roadmap.md`](charting-roadmap.md) §7 pre-registered the condition under which the CVD
refusal should be re-run: *"WebSocket ingestion gets built for tier-1 price arbitrage. CVD's marginal
cost collapses from a new subsystem to an extra subscription, and the refusal should be re-run rather
than inherited."* That has now happened, and the research settles the open question: **all three
venues publish taker side** — gate through a signed `size`, okx through `side`, bybit through `S`.
CVD is derivable on every venue this feed will touch.

What has *not* changed is the rest of the refusal: trades roughly double the topic count, the buyer
is delta-neutral and holds for days, and the volume still lands on a shared database. So the honest
position is that the blocker moved from *structural* to *a priced choice*, and the decision belongs
after W0 returns real message rates — not now, and not by inheritance.

## 10. What would change these conclusions

- **W0 finds okx or gate caps topics far below their whole book.** Then connection counts rise and
  the subset selection in §2 becomes mandatory rather than prudent.
- **The pairable three-venue set turns out to be most of 2,278 markets.** Then in-process Bun is
  unlikely to hold and §6 resolves toward a separate service earlier.
- **Bybit's undocumented behaviour bites.** The v5 docs contain no 24-hour forced disconnect despite
  that number being widely repeated; the design handles arbitrary drops anyway, and if a periodic
  cut is observed it should be recorded here with its measured interval.
