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

## 0. W0 ran on hklab, 2026-09-17. The numbers replace the estimates below.

W0 is the slice §7 describes as "a probe that keeps no code", and it kept none: a single-file Bun
script mounted into the existing `airates-collector:latest` image on hklab, run twice — once against
each venue's whole fresh book, once against the pairable subject set — with all three venues
connected at the same time, because a limit that only appears under concurrent load is still a limit.
Everything below is measured on the box that would run the feed, not read from a document.

**The subject set is not small, and that question is now closed.** §2 said the three-venue pairable
set "has not been measured yet and must be before the subscription list is built", and guessed it
would be "materially smaller" than the book. It is not: **2,105 markets of 2,297** — gate 840, bybit
792, okx 473 — once `arbitrage()`'s own guards are applied (fresh, `best_bid`/`best_ask` > 0, inside
the `DIVERGENCE_TRIGGER` = 0.1 band around the deepest-by-OI anchor, asset carried by ≥ 2 venues).
Restricting the pairing to the three WS venues only takes it to 1,935. An open-interest floor is what
actually cuts it: 1,690 markets at $100k, **764 at $1M**, 165 at $10M.

**Each venue's whole book fits on one connection. The fleet is three connections, not 6–12.**

| | requested | delivering | frames | msg/s | subscribe errors |
| --- | --- | --- | --- | --- | --- |
| bybit `orderbook.1` | 833 | **833** | 5 | 1,104 | none |
| okx `bbo-tbt` | 483 | **483** | 3 | 787 | none |
| gate `futures.book_ticker` | 977 | 843 | 10 | 1,036 | none |

Gate's 843 is not a cap: the same run at an 8-second window showed 522 and at 64 seconds 843, so the
shortfall is illiquid contracts that had not ticked yet, not topics refused. No venue rejected a
subscription, and bybit's 833 topics — the one documented hard limit in the fleet, 21,000 characters
of `args` — landed on a single connection. **Shard for failure isolation if you want to; do not
shard because the venues make you.**

**The CPU premise in §2 is wrong by more than an order of magnitude.** Held on the subject set for
123 seconds, all three venues at once: **2,320 messages/second**, 53.8 MB, and `JSON.parse` cost
**1,285 ms — 1.0% of one core**. The whole probe process, frame handling included, cost **18.0% of
one core**, *in Bun*. §2's "`JSON.parse` at that rate inside the same single-CPU process as the poll
loops will starve them" does not survive the measurement. The message rate estimate was good (2,300
predicted, 2,320 measured); the cost of servicing it was not.

**And the container has the headroom.** `docker stats` on the running `airates-collector-go`,
2026-09-17: **2.57% CPU, 40.7 MiB of 1 GiB**. The Go port dropped the Bun collector's 537 MB peak by
about thirteen times, and 97% of the core is idle. The `cpus: 1.0` constraint that §2 calls "the
binding constraint" is not currently binding on anything.

**What W0 did not measure**, so that nothing here is read as more than it is: reconnect behaviour,
bybit's rumoured 24-hour forced disconnect (the window was two minutes), depth or accuracy of the
quotes against the REST path, and the cost of the *write* side — the flush in §3 is still unbuilt and
unmeasured.

### The one finding that changes a different section: ten venues quote, not three

§1 says "only three venues publish top of book at all". That was true of the WebSocket research and
is **no longer true of the data**. Fresh rows carrying both `best_bid` and `best_ask`, 2026-09-17:

| bingx | gate | bitget | bybit | toobit | pionex | okx | htx | grvt | sodex |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1,026 | 977 | 836 | 833 | 760 | 562 | 483 | 341 | 186 | 91 |

Seven venues beyond the three researched here publish a book over REST and are already on
`/arbitrage`. They do not change the socket design — they are polled and will stay polled — but they
**change migration 022 and they are why the freshness split cannot be written as §3 writes it**. If
`quotes_at` is filled only by the feed, those seven venues get a permanently null `quotes_at`, and
the moment `arbitrage()` gates bid/ask on it they vanish from the page: a WebSocket slice for three
venues would silently delete seven venues' quotes. The REST path has to stamp `quotes_at` too,
whenever the cycle it writes actually carries a quote. See §3.

---

## 1. What the venues actually publish

Only three venues publish top of book **over WebSocket**, and they are three of the ones already
parsed for it over REST (migration 013): gate, okx, bybit. *Corrected 2026-09-17: as a claim about
venues publishing a book at all this was wrong by seven — see §0. It holds for sockets, which is what
the rest of this section is about.*

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

## 2. The constraint is CPU, not connections or memory — measured, and it is not binding either

> **Withdrawn 2026-09-17.** The reasoning below is sound and its conclusion is wrong: parsing the
> full three-venue feed costs 1.0% of one core and servicing it costs 18%, against a collector idling
> at 2.57% of the same core. §0 has the measurements. The section is kept because its *method* —
> subscribe to the pairable set rather than to everything — is still the right default, and because
> the numbers it guessed at are the ones W0 went and got.

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

> **Amended 2026-09-17 by W0 (§0): `quotes_at` belongs to every quote, not to the feed.** Ten venues
> publish a book today and seven of them will never open a socket. Three rules follow, and W1 is not
> correct without all three:
>
> - **The REST path stamps it.** `recordBatch`'s `market_latest` upsert
>   (`apps/collector-go/internal/store/store.go:255`) sets `quotes_at = EXCLUDED.observed_at` **only
>   where the cycle actually carries a quote** — a venue that publishes no book keeps a null
>   `quotes_at`, which is the honest value and the one the page already renders as "no quote".
> - **The migration backfills it**, `quotes_at = observed_at` wherever a bid or ask is already
>   stored. Without it `/arbitrage` empties on deploy and refills only as each venue's next cycle
>   lands — a self-healing outage is still an outage, and this one is avoidable in one statement.
> - **Neither writer may overwrite a fresher quote with a staler one.** Not because a polled book is
>   stale — at the instant a poll lands it is exactly as current as the stream, and it should win —
>   but because *arrival order is not observation order*. A cycle observed at t+60 can commit at
>   t+66, after a streamed quote observed at t+65 has landed, and the row's own
>   `WHERE EXCLUDED.observed_at >= market_latest.observed_at` cannot catch it: the stream never
>   writes `observed_at`, so the cycle is genuinely the newer row and is admitted with a book that
>   has gone backwards in time. So the four quote columns and `quotes_at` move together under
>   `EXCLUDED.quotes_at >= coalesce(market_latest.quotes_at, '-infinity')`, and the feed's own write
>   gates on `quotes_at` the same way — which also makes a reconnect's replayed snapshot a no-op.
>   The two writers end up ordered by *when the book was seen*, with neither needing to know which
>   venues the other covers: no `STREAM_VENUES` coupling in SQL.
>
>   *An earlier draft of this bullet, and the first test written against it, claimed the polled book
>   was the stale one. The test failed, correctly, and the claim was wrong rather than the code.*

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

> **Resolved 2026-09-17, and not the way this section recommends: build it in Go, in-process.**
>
> Every reason below was written on 2026-09-14, the day before the Go cutover, and the cutover
> falsified all three. The adapters, `core.PerUnitPrice` and the units conversions **are** in Go
> (`apps/collector-go/internal/{adapters,core}`); `apps/collector-go` **has** a database layer —
> `go.mod` requires `jackc/pgx/v5` and `internal/store` holds the very `recordBatch` this section's
> §3 is about; and the collector is no longer split across two languages by adding Go, it is split
> by adding Bun. `apps/collector` is the deprecated one, kept buildable only as the rollback.
>
> W0 removes the remaining objection rather than supplying the new reason: at 1.0% of a core for
> parsing and 18% to service the whole fleet *in Bun*, with the container idling at 2.57%, both
> languages fit comfortably and CPU decides nothing. What decides it is that **in-process now means
> Go**. A Bun feed would be a second process, in a second language, holding a second connection pool,
> writing the same four columns of the same table — which is the cost this section was trying to
> avoid when it argued against Go.
>
> The escape hatch below survives with its sign flipped: if the feed ever does starve the poll loops,
> move it **out** of the collector. `profitlock-worker`'s `internal/relay/client.go` — a mature
> `coder/websocket` client with capped jittered backoff, reconnect and heartbeat — is still the
> nearest working code, and is now a library to copy from rather than an argument about where to
> live. `apps/collector-go/go.mod` has no WebSocket dependency yet; W2 adds one.

**Superseded recommendation (2026-09-14): build it in Bun, in-process, against a selected subset, and measure.** Reasons: the
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

- **W0 — probe, no code kept. Done, 2026-09-17; the numbers are §0.** One connection per venue, all
  three at once, against the whole book and against the pairable subject set. Outcome: three
  connections carry the fleet, the subject set is 2,105 of 2,297 markets, 2,320 msg/s costs 1.0% of a
  core to parse and 18% to service in Bun, and the collector container is idling at 2.57%. This was
  the slice that decides §2 and §6, and both are now decided — §2's starvation premise is withdrawn
  and §6 resolves to Go in-process, for a reason that has nothing to do with CPU.
- **W1 — migration 022 + the quote-scoped writer. Done, 2026-09-17.** `022_quotes_at.sql` (column,
  backfill, no index, with the reasoning for each); `store.WriteQuotes` — a partial UPDATE of five
  columns that never inserts, never touches `observed_at`, never writes `funding_snapshots`, and
  reports what it could not write; the funding path stamping `quotes_at` where it carries a book;
  and both queries split, with `arbitrage()` gaining `oldest_quoted_at` beside `oldest_observed_at`
  so a row can state its two ages. **10 new store integration tests and 2 new worker integration
  tests**, run against a throwaway PostgreSQL 14.19 carrying all 22 migrations — the 4 TimescaleDB-
  only statements elided as `go-collector.md` §6 describes. No socket, as specified.

  Three things W1 learned that the plan did not say:
  - **A stale mark must be withheld, not inherited.** Gating candidates on `quotes_at` alone leaves
    the *mark* the deviation guard compares against coming from a funding row that may be hours old.
    So the candidate's mark is nulled when its `observed_at` is stale, and null marks already agree
    by default — the guard's own escape, since a missing mark is not evidence of a mismatch. A venue
    that is streaming while its poll is dead therefore keeps quoting and stops gating. The detail
    page shows the withheld mark as a null with a reason, which is what a detail page is for.
  - **Every fixture that writes a quote is now a fixture that must stamp `quotes_at`.** Six existing
    worker tests failed until they did, which is the schema telling the truth: a row with a
    `best_bid` and no `quotes_at` is one the collector can no longer produce.
  - **The guard is about arrival order, not about polled books being stale.** Written up in §3; the
    first test asserted the wrong thing and failed, and the claim was wrong rather than the code.
- **W2 — one venue end to end. Built and verified against live bybit, 2026-09-17; not yet deployed.**
  `internal/stream` holds the feed — an injected `Dialer`/`Conn` (so tests script a venue rather than
  stand up a server), an in-memory book per market, a flush timer, jittered backoff and a breaker
  mirroring `httpclient`, and a `Stop(ctx) error` that joins main.go's shutdown path and flushes on
  the way out. `stream.Bybit` speaks v5 `orderbook.1`. `STREAM_VENUES` is **empty by default**, so
  this code changes nothing until someone turns it on; `STREAM_FLUSH_MS` (5,000, floored at 1,000)
  and `STREAM_MIN_OI_USD` (0) tune it. **12 unit tests, clean under `-race`, plus 2 store
  integration tests for the subscription query.**

  **Verified on hklab against the real venue** by a throwaway binary that ran the actual feed with a
  printing sink — no writes, no restart of the running collector, deleted afterwards. Streamed
  against what REST had stored for the same markets: `1000000MOGUSDT` bid 9.68e-08 and **$1,216 of
  size against REST's 9.679999e-08 and $1,215.90**, `10000SATSUSDT` 1.0033e-08 against 1.0033e-08,
  `1000BONKUSDT` 2.684e-06 against 2.685e-06, BTCUSDT tracking 76,193 → 76,200 while the REST row sat
  at 76,176. So the 10,000× trap of migration 013 is cleared on all four contract scales, in both
  directions: prices divided by the multiplier, sizes left as the money they already are. Quote ages
  ran **21–230 ms** on liquid markets against 60 seconds from polling, flushes cost **37–109 µs**,
  and each one synthesized a run as `bybit:ws` with `requests=0` and no error.

  Three things the plan did not anticipate:
  - **`orderbook.1` is snapshot-then-delta after all.** §8 chose it over `tickers` *because* tickers
    is delta — but orderbook.1 sends a snapshot per topic and deltas thereafter. At depth 1 this
    needs no U/u resync, only three rules: an empty side means unchanged, a quantity of zero means
    the level was removed (stored as a cleared side, never as a zero quote), anything else replaces.
    The live run shows it working: 4 of 5 markets changed per window, not 5.
  - **The feed reports health as `bybit:ws`, not `bybit`.** §4 says the flush synthesizes a
    `CollectorRun` so the existing health machinery works untouched — but recording it under the
    venue's own id would let a live socket satisfy the staleness check for a venue whose funding poll
    had died. That is migration 022's silent resurrection, reappearing one layer up. Two ids, one
    extra `venues` row (which cannot reach `/exchanges`: that query inner-joins `market_latest`, and
    the feed never writes a row under this id), and the poll and the feed fail independently.
  - **`quotes_at` does not exist in production yet**, confirmed by a query that errored on it. The
    collector migrates at boot, so W1's schema lands with the first deploy of this code — which is
    also the moment `/arbitrage` starts gating on it. Deploy the collector before, or with, the
    worker.
- **W3 — gate and okx. Built and verified live, 2026-09-17.** `futures.book_ticker` and `bbo-tbt`,
  okx pinging every 20 seconds against its 30-second idle cut, both from the hklab endpoint W0
  measured. Verified against the same markets the REST path had just stored: gate BTC 76,304 against
  76,264 a minute earlier, PEPE 3.462e-06 against 3.459e-06; okx BTC 76,312 and the **inverse**
  `BTC-USD-SWAP` sizing at $108,000 and $43,930 — exact multiples of its contract, and *not*
  multiplied by the price, which would have read as billions.

  **The size conversion had to move into the protocol, and that is the real content of W3.** The
  feed's original `price × quantity` is bybit's rule and only bybit's: gate quotes contracts against
  `quanto_multiplier`, okx quotes contracts against `ctVal`, and fifteen okx swaps are inverse, their
  contracts denominated in dollars so the price plays no part. One shared formula would have been
  wrong on two venues by four orders of magnitude on one and by the price of the coin on the other —
  migration 013's trap, reached by a different road. So `Protocol.SizeUSD` is per-venue, and an
  optional `Preparer` fetches the contract metadata before each subscribe (which also means a
  contract listed mid-run gets its real scale rather than a null depth). An unknown scale returns
  **nil, never a raw contract count**: a null fails the depth floor, a fabricated number invites a
  loss.

  Smaller things the venues required: gate sends sizes as JSON **numbers** while the others send
  strings, so the parser takes both or gate's depth column would silently have been null; okx answers
  a ping with the bare string `pong`, which is not JSON and must not be reported as an unreadable
  message every twenty seconds.

- **W4 — subscription-set refresh. Built and verified live, 2026-09-17.** `Feed.SetSubjects` diffs
  the set, keeps the books of markets that survive, and cycles the connection when anything actually
  changed; a `PeriodicTask` re-runs `StreamSubjects` every 15 minutes per feed. Watched on a live
  gate feed: `+2 -1`, ETH gone and SOL and DOGE quoting in the next flush window, BTC's book
  untouched, no reconnect logged as a failure.

  Three decisions worth keeping:
  - **A refresh cycles the connection rather than sending incremental subscribe/unsubscribe
    frames.** The incremental path needs an unsubscribe frame per venue, a partially-subscribed
    state to reason about, and its own way to re-run `Prepare` for a newly listed contract's size
    metadata. A reconnect gets all three from code that already runs on every drop, and costs a
    sub-second gap a few times an hour.
  - **A re-subscribe is not a fault.** It returns a sentinel the connect loop recognises, so it skips
    the backoff and does not touch the failure counter — otherwise a refresh every fifteen minutes
    would eventually trip the circuit breaker on a feed that had never failed.
  - **An empty subject set is refused.** A query that returns nothing — a collector cycle that has
    not landed, a venue mid-outage — would otherwise unsubscribe the whole feed and leave it
    connected to nothing, which reads on `/status` as a healthy feed with no markets.

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

- ~~**W0 finds okx or gate caps topics far below their whole book.**~~ **Did not fire, 2026-09-17.**
  Neither venue capped anything: 483 of 483 and 843 of 977 delivering on one connection each, the
  gate shortfall being contracts that had not ticked. Subset selection stays prudent, not mandatory.
- ~~**The pairable three-venue set turns out to be most of 2,278 markets.**~~ **Fired, 2026-09-17,
  and its conclusion is withdrawn anyway.** The set is 2,105 of 2,297 — 92%, which is "most" by any
  reading. But the conclusion this trigger drew ("in-process Bun is unlikely to hold") was a CPU
  prediction, and W0 measured the CPU directly: 1.0% of a core to parse, 18% to service. A trigger
  that fires on a proxy loses to the measurement it was a proxy for. §6 resolved to Go in-process,
  on a different argument entirely.
- **Bybit's undocumented behaviour bites.** The v5 docs contain no 24-hour forced disconnect despite
  that number being widely repeated; the design handles arbitrary drops anyway, and if a periodic
  cut is observed it should be recorded here with its measured interval.
