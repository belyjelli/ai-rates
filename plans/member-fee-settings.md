# Member fee settings — development note

Status: **to develop. Nothing built.** Written 2026-09-13 from the `profitlock-worker` side, where the
execution worker needs a member's real fees before it may start a strategy.

**Decision:** a member's fee settings are **membership data, stored in the official airates
Postgres** alongside the rest of the member area (the `members` schema proposed in
`profitlock-worker/planning/development-plan.md` §6). They are not worker configuration, not URL
parameters, and not browser storage.

---

## Why here, and why now

Three things are waiting on the same missing piece:

1. **`/arbitrage` net-of-fees.** Designed and deliberately not displayed (development-plan.md,
   "Net-of-fees is designed and defined"). It ranks many venue pairs at once, so it needs a schedule
   keyed by venue, which is member state, not a link. A shareable URL carrying someone's VIP tier is
   the wrong artefact.
2. **The pair page backtest (F1).** Today it takes `fee_long` / `fee_short` per request via
   `parseTakerBps`. That stays for anonymous readers; a signed-in member should get their saved
   schedule without retyping it.
3. **The execution worker's entry gate.** `profitlock-worker` §3.2: *no strategy starts without the
   member's real taker fees.* §3.3 gate 4 (`netAfterCostsUsd > 0`, payback within horizon) cannot be
   evaluated without them. Hosted and self-hosted workers must read the same schedule the site shows,
   or the site and the worker will disagree about whether a trade is worth taking.

There is no user concept in airates yet (12+ tables, all market data), so this lands **with or
after** member accounts. It should be designed now so accounts are not built without it.

---

## What already exists and must not be re-decided

- **`packages/core/src/fees.ts` is the authority.** `VenueFees { takerBps, withdrawalUsd? }`,
  `FeeSchedule` keyed by venue id, `venueFees()`, `gapCost()`, `backtestFeesFrom()`. The stored
  shape maps onto `VenueFees`; the database does not get its own fee policy.
- **Absent is unknown, never zero.** No row for a venue means unknown. An explicit `0` is honoured
  (some venues rebate takers) and is distinguished by `Number.isFinite`, not truthiness.
- **Taker is unconditional, transfer is not.** A missing taker fee nulls the net figure; a missing
  withdrawal cost leaves it computed without the transfer and says so.
- **Two fills for a price gap, four for a funding carry.** Stored fees are per fill; each consumer
  keeps its own fill model.
- **`MAX_TAKER_FEE_BPS = 100`** bounds input, as `parseTakerBps` does today.
- **Across the language boundary**, the Go worker is pinned to `fees.ts` by shared test vectors, not
  shared code (development-plan.md, Phase 4 note).

---

## Proposed shape

A sketch to argue with, not a migration. Take the next free number when this is built (`015` is
already in use as of 2026-09-14, so `016` at the earliest); per the process note, never edit a
migration after it has run.

**Reconcile first with `profitlock-worker/planning/development-plan.md` §6.1**, which sketches the
same table and differs in two places:

1. **Withdrawal cost grain.** §6.1 stores `withdrawal_usd` **per asset**; `VenueFees.withdrawalUsd` in
   `fees.ts` is **per venue**. Per asset is more accurate, since withdrawal costs vary by asset and
   chain, but it means extending `fees.ts` (and its vectors) before the migration, not after.
2. **History.** §6.1 says one row per (member, venue); this note proposes append-only rows, so every
   verdict can cite the schedule it used. Pick one before `014`.

Both documents agree on the rest: `fees.ts` is the authority, absent means unknown, maker fees are
deferred, and the Go worker keeps the arithmetic local, pinned by shared test vectors, fetching only
the schedule.

```sql
-- members.venue_fees: one member's fees on one venue, append-only.
member_id        -- FK to members.members
venue_id         -- same ids as the venue catalog and FeeSchedule keys
taker_bps        numeric NOT NULL CHECK (taker_bps >= 0 AND taker_bps <= 100)
maker_bps        numeric NULL                -- see open question 1
withdrawal_usd   numeric NULL CHECK (withdrawal_usd >= 0)   -- null = unknown, as in VenueFees
source           text NOT NULL CHECK (source IN ('member', 'venue_api'))
effective_at     timestamptz NOT NULL DEFAULT now()
PRIMARY KEY (member_id, venue_id, effective_at)
```

- **Append-only, current = latest per venue.** Fees drift with 14-day (Hyperliquid) and 30-day (CEX)
  volume. Every backtest verdict and every strategy start should record *which* schedule it used, so
  "why did the worker enter at a loss" is answerable afterwards.
- **Removing a venue's fees** is a row that marks it unknown (or a tombstone), never a delete that
  silently turns a past decision's inputs into nothing.
- **Private to the member.** Never in public `/v1` responses, never in cache keys shared across
  members, never in shareable URLs. A VIP tier reveals trading volume.

---

## Two sources, and which wins

Members type fees in today. The worker can also **observe** them from the venue, which is ground
truth for that account:

- Hyperliquid: the `userFees` info query for the master address. Confirmed live on testnet
  2026-09-13: `userCrossRate` (taker) and `userAddRate` (maker) as decimal fractions, e.g. `"0.00045"` =
  4.5 bps, alongside `activeReferralDiscount`, `activeStakingDiscount` and `dailyUserVlm`. *Still to
  confirm: whether the two rates already include the referral and staking discounts.*
- Bybit: the account fee-rate endpoint (`/v5/account/fee-rate`). *Verify the path and that a Read
  permission suffices.*

Recommendation: the worker reports observed fees through the control plane as `source = 'venue_api'`.
The page shows both when they differ, and the entry gate uses the **higher** of the two taker fees.
The flattering number is never the one that decides a trade.

---

## The cost the member does not see on the venue: our builder fee

On Hyperliquid every order carries our builder code, which charges up to `f` tenths of a basis point
(capped at 10 bps on perps) **on top of** the venue's taker or maker fee. On the member's fills it is
a cost like any other, so:

- the effective Hyperliquid fee for a member trading through the worker is
  **venue fee + builder fee**, and every net figure, backtest and gate check must use that sum;
- the member page must show the builder fee as a separate, labelled line, not folded silently into
  "fees".

The Bybit Broker ID rebate is paid to us out of Bybit's fee revenue and does **not** change the
member's fee, so it adds nothing here. It is still worth stating on the page, since the member pays
the same either way.

This follows the same rule as everything above: a net figure that silently omits a cost is the
flattering number this codebase refuses everywhere else.

---

## How the worker gets it

- **Through the control plane, never by database access.** A self-hosted worker runs on a member's
  machine and must never hold Postgres credentials. The relay Durable Object (worker plan Phase 2)
  serves the paired tenant's current schedule and pushes changes.
- **The schedule is small** (one row per venue), so it fits the 10 ms CPU budget: one indexed read per
  session, cached for the session.
- The worker treats a schedule it cannot fetch as **unknown**, which blocks strategy starts. It does
  not keep trading on a stale copy indefinitely.

---

## Open questions

1. **Maker fees in v1?** `VenueFees` has no maker field. The worker sometimes posts (`Alo` /
   `PostOnly`), and Hyperliquid maker fees go negative at high tiers. Either extend `VenueFees` in
   `fees.ts` first, with vectors, or store maker nullable and leave it unused until it is.
2. **Negative taker fees.** `parseTakerBps` rejects negatives. Keep the `>= 0` check until a venue we
   support actually rebates takers.
3. **History retention.** Keep indefinitely (tiny), or tie it to the retention of the decisions that
   reference it?
4. **Precedence when the member enters a *higher* fee than the venue reports.** Honour it: it is
   conservative, and the member may know about a cost we do not.

## Build order

1. Member accounts and sessions (prerequisite; no member concept exists yet).
2. `members.venue_fees` migration and data access, with the `fees.ts` mapping and its tests.
3. Member settings page: per-venue taker, optional withdrawal, provenance and date shown.
4. Wire into `/arbitrage` net-of-fees, then the pair page for signed-in members.
5. Control-plane endpoint for the paired worker, and the shared Go/TS test vectors.
6. Worker-observed fees (`venue_api` source) and the divergence display.
