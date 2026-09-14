# The Go collector — a port, measured rather than asserted

Opened 2026-09-14, on the decision to rewrite the collector in Go for memory and CPU. This records
what was built, what the measurements actually said, and three claims of mine that the evidence
refuted along the way.

The argument I made *against* a rewrite is in §7, kept because it still bounds what this can be.

---

## 1. The problem that motivated it, with figures

Measured, from the commit that raised the ceiling (`decb64c`, 2026-09-14): at 56 venues the Bun
collector **peaked at 537 MB against a 512 MB cap**, hit that cap **1,508 times in one boot**, and
exited and restarted roughly **every 50 minutes**.

The restart is the real damage, not the memory. Every job that waits an hour after boot never ran:
the nightly pair backtests stayed on 2026-09-13 and the ranking job wrote **no rows** — the job that
`ranking-system-design.md` calls sprint 0, whose value is entirely in the date of its first row.

Growth is **superlinear**: 20 venues → 70 MB, 56 venues → 537 MB. That is 7.7× memory for 2.8×
venues, which is what ruled out "it is just runtime overhead".

The host has ~17.7 GB. The cap was 512 MB. **Raising the limit was the correct first fix and it cost
nothing.**

## 2. What exists now

*Updated 2026-09-15, at parity.* `apps/collector-go`, a Go 1.26 module: **545 test functions passing
under `-race`** across **48 packages**, `go vet` and `gofmt` clean, binary builds, and **all 56
venues wired** into the registry — 42 venue packages plus `adapters`, `core`, `collector`,
`httpclient`, `store` and `cmd/collector`.

| package | what it is | tests |
| --- | --- | --- |
| `internal/core` | domain types, symbol parsing, units, asset class | pinned |
| `internal/adapters` | `Num` decoder, `MarketRefFor`, `SelectRefreshBatch`, `ResolveDeclaredBase` | pinned |
| `internal/httpclient` | spacing, retry, backoff, breaker, body cap | pinned |
| `internal/collector` | `VenueLoop`, `PeriodicTask`, `Status` | pinned |
| `internal/adapters/*` | 42 venue packages, serving 56 venues | **each pinned to the TypeScript fixtures** |
| `internal/store` | pgx writer: `CopyFrom` + `unnest` upserts | **8 integration tests — §6** |
| `cmd/collector` | wiring, health server, `GOMEMLIMIT` | registry guards, below |

The `cmd/collector` guards are worth naming, because the registry is hand-maintained wiring and
three ways of getting it wrong all compile cleanly and pass every adapter's own tests: a **duplicate
venue id** (two loops writing one venue, both writes succeeding, the `observed_at` guard silently
picking a winner), a **venue silently dropped** from the 56, and an **untyped spacing constant** —
`MinInterval = 120` without `time.Millisecond` compiles as 120 *nanoseconds*, builds, passes, and
then hammers the venue until it bans the host. `registry_test.go` pins all three, plus the
hyperliquid shared-rate-limit group in both directions.

**Venue counts differ from package counts, and both are easy to get wrong.** Three packages carry
more than one venue: `binancefapi` is the family base for aster, binance, weex and bullet;
`hyperliquid` serves the core dex plus ten HIP-3 dexes (xyz, flx, hyna, vntl, km, abcd, cash, para,
io, mkts) from one adapter sharing one rate-limit group, because Hyperliquid limits by IP; `lighter`
serves mainnet and RH, which deliberately do *not* share a group because their market ids disagree.

**The arithmetic to parity, verified against `registry()` and the TS tree on 2026-09-15:**

| | venues |
| --- | --- |
| wired in `registry()` (26 explicit candidates + 10 HIP-3) | 36 |
| ported this session, not yet registered | bitmart, orderly, lbank, + 15 in flight |
| **target** | **56** |

56 is exactly what the TypeScript collector runs, so the completed port drops nothing.

**`blofin` is excluded deliberately, and this is not an omission.** `packages/adapters/src/registry.ts`
records that it "answers from a development machine but returns HTTP 403 to the collector's host,
measured 2026-09-13 22:53Z on its first production run. It is left out rather than left failing
every run on /status". A TS adapter exists and is not collected; the Go side matches that, and
re-adding it is one registry entry on both sides once the host can reach `openapi.blofin.com`.
This is why 46 TS venue *files* and 57 venue *ids* reconcile to 56 collected.

**The port is verifiable, and that is the whole de-risking strategy.** `packages/adapters/__fixtures__`
holds 205 JSON files across 47 venues. Every Go parser reads *the same bytes* its TypeScript twin is
pinned to and is asserted against *the same expected values* — bybit BTCUSDT at rate `0.00004936`,
mark `77766.7`, bid depth `0.181 × 77766.7`, OI `4142076932.53`, 60 risk-limit tiers with tier 1
`[0, 10000)` at imr `0.02`. A port either reproduces those numbers or fails.

## 3. The architecture, and what it is actually worth

- **`pgx.CopyFrom` for `funding_snapshots`** — the binary COPY protocol for the append-only table
  that takes ~4.8k rows a cycle and ~324k an hour, instead of chunked 2,000-row multi-row INSERTs
  that build a fresh SQL string with thousands of placeholders every time.
- **`unnest()` over column-oriented arrays for the upserts** — one statement with a fixed parameter
  count whatever the row count, so the planner sees the same query every cycle and the client
  allocates one slice per column rather than one per row.
- **A goroutine per loop** (~2 KB of stack) instead of ~250 live timer closures each retaining its
  captured scope. 56 venues × 4 loops is about half a megabyte of stacks.
- **`GOMEMLIMIT` set below the container cap** (900 MiB against `mem_limit: 1g`). This is the fix
  aimed squarely at §1: a *soft* limit makes the collector work the garbage collector harder as it
  approaches the ceiling, instead of the kernel killing it at a hard one. Memory pressure becomes
  slower cycles rather than a restart that loses every warmed cache and re-runs migrations.
- **A response size cap** (`MaxBodyBytes`, 64 MB) — a bound neither implementation had before, and
  the property that actually protects a 1 GB container from a venue answering something absurd.

### Measured, on this hardware

Parse path, 830 markets (a bybit linear book): **1.79 ms, 702 KB, 13,950 allocs** — about **846 B
and 17 allocs per market**. A full 4.8k-market cycle is therefore ~4 MB of transient allocation,
which is not where 537 MB came from.

## 4. Three corrections, because each one was a claim I made and then disproved

**(a) The "streaming decode" memory fix was wrong.** I built `GetJSON` on `json.Decoder` reading
off `resp.Body` and documented it as the whole point of the rewrite. Benchmarked at three sizes it
is false everywhere:

| body | streaming | buffered |
| --- | --- | --- |
| 5.6 KB | 61.6 µs, 17,937 B | **60.7 µs, 15,776 B** |
| ~240 KB (830 markets) | 3.58 ms, 896,433 B | **3.39 ms, 872,529 B** |
| ~1.4 MB (5,000 markets) | 22.6 ms, 8,196,708 B | 22.9 ms, **7,198,842 B** |

`json.Decoder` carries its own growing internal buffer — about a megabyte extra on a 1.4 MB body.
It earns its keep on streams of many values, which a venue response is not. `GetJSON` now reads and
unmarshals, bounded by the cap.

**The real advantage over Bun is the language, not the decoder**: Go holds a body as `[]byte` at one
byte per ASCII character where JavaScript holds a UTF-16 string at two, and the decoded structs are
far smaller than the equivalent JS object graph.

**(b) A raw NUL byte, again.** I wrote `"%s\x00%d"` as a composite map key with a *literal* 0x00 in
the source. This is the third occurrence in this repository; the first two cost two sessions each,
because grep goes silent on such a file rather than reporting a match. The Go compiler caught it
("illegal character NUL") — luckier than the TypeScript cases. `source-hygiene.test.ts` scans `*.ts`
only and could never have caught it, so `internal/core/hygiene_test.go` now guards the Go tree.

**(c) A health lie that would have compiled and shipped.** `main.go` attached `OnRun` to
`LoopOptions` *after* passing it by value into `NewVenueLoop`. Collection would have worked
perfectly while `/health` reported every venue as never having run — permanently stale, 503 forever.
Status is now constructed before the loops, and the ordering carries a comment saying why.

## 5. What the rewrite does NOT fix

Nothing here addresses §1's superlinear growth directly, because **nobody has measured where the
537 MB went**. The Bun `/health` endpoint reports no `process.memoryUsage()`, and the retained
caches I inspected (`intervals`, `openInterest`, `known`, the per-venue `exhausted` sets) are
bounded by market count — tens of megabytes, not five hundred.

Two cheap levers on the *existing* collector remain untried and should be, independently of this
port: **`--smol`** (a one-line Dockerfile change; Bun's low-memory mode), and removing the
`response.text()` + `JSON.parse` double-hold in `packages/adapters/src/http.ts`.

## 6. The largest risk in what was built — closed 2026-09-15

**`internal/store` now has integration tests, and they pass.** This section previously read "zero
tests… no assertion has ever executed its SQL". That is no longer true.

The cautionary tale that motivated it stands and is worth keeping: `/v1/pairs/:asset/backtest`
"shipped green on 60 tests and failed on every production call", because `app.test.ts` faked the
DataSource and no test ever executed the SQL. Reading SQL does not verify SQL.

**How it was closed.** No Postgres existed in this environment — `psql` client only, nothing
listening on 5432 or 5437, Docker daemon down. So a throwaway PostgreSQL 14.19 was initialised in
the session scratchpad and **all 20 real migration files applied verbatim** by
`apply_migrations.py`, which elides an auditable list of TimescaleDB-only statements and prints
exactly what it skipped: **1 `CREATE EXTENSION timescaledb` and 3
`ALTER TABLE … SET (timescaledb.compress…)`**. The `create_hypertable`, `add_compression_policy` and
`add_retention_policy` *call sites* are left in the migrations and satisfied by no-op stub
functions, so they still execute rather than being edited out. The schema under test is therefore
the real one, not a second copy maintained by hand.

`internal/store/store_int_test.go` holds **8 tests**, skipped unless `AIRATES_TEST_DSN` is set, each
against a truncated-and-reseeded database:

| test | what it pins |
| --- | --- |
| `TestRecordBatchWritesEveryTableInOneTransaction` | all four writes commit together |
| `TestMarketLatestGuardRejectsAnOlderRow` | `WHERE EXCLUDED.observed_at >= market_latest.observed_at` |
| `TestAbsentNumericsLandAsNullNotZero` | the pointer discipline survives the driver |
| `TestRecordBatchIsIdempotentOnRepeatedSymbols` | `ON CONFLICT` targets are right |
| `TestRecordBatchIgnoresOtherVenuesRows` | a venue loop cannot corrupt another's rows |
| `TestFundingEventsDedupeOnTheirKey` | the funding-event conflict key |
| `TestActiveMarketsFeedsTheWarmUpPhase` | the query that runs at startup |
| `TestRecordRunStoresACycleOutcome` | `int32(Duration.Milliseconds())` binds to `integer` |

**What this verifies:** every table, column, type, constraint, index and function the store's SQL
touches — the `unnest` arity and its 20-column ordering in the `market_latest` upsert, the
`CopyFrom` binary path into `funding_snapshots`, `ON CONFLICT` targets, the `observed_at` guard, and
that pgx binds `[]*string`/`[]*float64` to `text[]`/`float8[]` with NULLs intact rather than as zero.

**What it does NOT verify, and this is the remaining gap:** hypertable partitioning, compression and
retention. Those are precisely the four skipped statements, and they need real TimescaleDB — hklab,
or a tunnel to `airates_it`. Nothing here licenses pointing the Go collector at `vaultdeck`; §8's
disjoint-venue rule is what governs that, and it is unchanged.

## 7. What this cannot become, and the argument that still stands

*The count in this section is spent: all 56 venues were ported on 2026-09-15. The argument is kept
because what it was really about was never the arithmetic.*

The adapters are **13,878 lines across 46 venue files**, plus 1,442 lines of core math. Porting them
was mechanical and fixture-validated — but the code is not the asset. What it encodes is knowledge
that took months to derive: OKX tier bounds in contracts (a 3-orders-of-magnitude trap), inverse
`ctValCcy` markets, liquidation `size` vs `order_size` (sign-inverted in 167 of 167 records),
top-of-book sizes differing 10,000× across three venues, MEXC's INCREASE vs CUSTOM ladders,
interval inference from settlement gaps.

**That knowledge now exists in two languages, and that is a cost, not a win.** Every venue quirk
discovered from here has to be fixed twice, or the two implementations drift — and drift is silent,
because both write the same tables. The fixtures are what make drift detectable rather than
theoretical: both suites assert on the same JSON, so a divergence fails a test on one side. Keeping
that property is the price of running a port at all, and it is why neither side should gain a rule
the other does not get.

**Running two collectors against one database is the risk to manage.** Both write `market_latest`
and `funding_snapshots`. Until the Go side is trusted, it should run against a separate schema, or
with `COLLECT_VENUES` disjoint from the Bun side's — never both writing the same venue.

## 8. Where it runs, and the cutover

**Decided 2026-09-14: the Go collector is an hklab-only component.** Cloudflare is unaffected — the
worker there stays Bun, serving the site and reading Postgres through Hyperdrive. Nothing in this
port touches `wrangler.jsonc`, `apps/worker`, or the edge deployment.

The plumbing is in place and **deliberately inert**:

- `deploy/hklab/compose.yml` gains a `collector-go` service under `profiles: ["go"]`. `deploy.sh`
  runs `docker compose up -d --build`, which skips profiled services entirely, so an ordinary
  deploy neither builds nor starts it. Bringing it up is an explicit
  `--profile go up -d --build collector-go`.
- `deploy.sh` streams `apps/collector-go` on every deploy (excluding `bin`, a 16 MB locally-built
  binary of the wrong architecture), so the tree is already on the server when the decision is made.
- Health on `127.0.0.1:20091`, beside the Bun collector's 20090. `deploy.sh` health-checks only
  20090, so a failing Go service cannot fail an ordinary deploy.

**The arithmetic objection is gone as of 2026-09-15: all 56 venues are wired, so running the Go
collector instead of `collector` would now drop nothing.** What remains is not a count.

**It has never run.** Not on hklab, not against any database but the throwaway Postgres in §6, not
for one full cycle. Every number in this document comes from tests and benchmarks; none comes from
the Go collector actually collecting. Specifically unproven: that 56 venues fit inside a 60 s cycle
on a `cpus: 1.0` container, that memory settles where §3 predicts, that the venues answer this
client as they answer Bun's, and that the TimescaleDB-only behaviour §6 could not test — hypertable
routing, compression, retention — works under the real write load.

The order that follows from that: bring it up on hklab under its profile with a **small disjoint
venue set**, read `/health` and `collector_runs` for a few cycles, diff its rows against the Bun
collector's for one asset, and only then widen `COLLECT_VENUES`.

**The two MUST cover disjoint venues.** Both write `market_latest` and `funding_snapshots`. Two
writers on one venue race over the same rows, arbitrated unpredictably by the `observed_at` guard in
the `market_latest` upsert — and the loser is silent, because both writes succeed. So:

1. `COLLECT_VENUES: "bybit"` on the Go service (set explicitly; empty means *every* venue).
2. The matching exclusion on the Bun collector's `COLLECT_VENUES`, in `deploy/hklab/.env` on the
   server. **That file is server-only, mode 600, and is the one step no deploy script performs.**

**Do not do either until §6 is closed.** The store has no tests and would be writing to `vaultdeck`.
The safer first move is a separate schema and a day of diffing the two implementations' rows for one
asset, which the fixtures make decisive rather than impressionistic.

## 9. What would change these conclusions

- **Measuring the Bun collector's heap** and finding the 537 MB is baseline rather than retention.
  Then the port's premise is confirmed rather than assumed, and `--smol` is worth trying first.
- **The store's integration tests pass against a real schema.** Until then §6 stands and this is not
  production-ready whatever the unit-test count says.
- **A venue's numbers diverge between the two implementations.** The fixtures make that detectable;
  running both against one asset for a day and diffing `market_latest` would make it decisive.

## 10. The cutover dropped everything but snapshots — found and restored 2026-09-15

The port reached 56-venue parity on **snapshot adapters**, and the cutover took that for parity with
the collector. It was not. The Bun `main.ts` also did all of this, and the Go `run()` did none of it:

| Dropped at the cutover | What it did while missing |
| --- | --- |
| migrations at boot | a new migration would deploy and never apply |
| `venues` upsert | a newly catalogued venue's first market would fail the foreign key |
| curated leverage | new markets on aster, lighter and paradex stored no `max_leverage` |
| history sweep and backfill (49 venues) | no settled funding arrived, so everything below starved |
| leverage tiers (17), liquidations (2) | ladders and the Phase 4 liquidation series stopped |
| stats, folds, stability, identity checks, pair backtests, ranked pairs | every derived surface kept serving its last Bun values |
| stale-venue alerts | an outage would have been silent |

**Nothing failed.** Snapshots kept flowing, `/status` stayed green, and the site kept serving rows
that had stopped changing. Parity has to be defined over what the process does, not over its adapter
list.

**Restored on branch `go-jobs-port`:**
- `internal/migrate` — the TypeScript runner's algorithm on the same `schema_migrations` table.
- `internal/catalog` over `packages/venues/catalog.json`, generated from the TypeScript catalog and
  pinned to it by `catalog.test.ts`; it supplies the `venues` rows and the curated leverage.
- The sweeps: `internal/collector/sweeps.go` and `internal/store/sweeps.go`.
  `TestSideLoopsAttachToTheSameVenuesAsTypeScript` pins which venues get each loop to what
  `createAdapters(VENUES)` attaches.
- The engines: `internal/core/{backtest,ranking,identity}.go`, with the TypeScript test vectors for
  what they port. `backtestDaily` is not ported because no job calls it.
- The jobs: `internal/store/jobs.go`, SQL copied statement for statement.
- Stale-venue alerts, and the wiring in `main.go` on the Bun cadences and start delays.

**Verified** against a throwaway PostgreSQL 14 with the TimescaleDB statements stripped. All 50 Go
packages pass with the integration tests enabled. The binary booted on an empty database and applied
all 20 migrations. From real bybit and gate data it stored 26,958 history events, 40,162 tier rows and
116 liquidations, refreshed stats for 1,001 markets, folded 8,809 day and 39,376 hour rows, and ran the
identity checks, with no failed runs.

**Not verified:**
- The nightly pair backtests and ranked pairs outside their integration tests; they first run an hour
  after boot.
- Anything TimescaleDB-specific.
- Whether the side loops and jobs fit beside 56 venues on `cpus: 1.0`.

**One defect surfaced, and the TypeScript has it too.** The folds date settlements in UTC, but the
charge-day and retention cutoffs cast `now()` in the session's time zone. On a server at +07 the
7-of-7 charging floor saw six days, so the pair backtests came back empty. The collector and its test
harness now pin their sessions to UTC.
