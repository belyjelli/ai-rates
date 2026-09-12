-- Phase 3: the homepage's "verified 7-day backtests", replayed nightly from settled funding.
--
-- This is the last unbuilt item in the original Phase 3 text, which assigned it to "py-analytics'
-- nightly run". That substrate never existed -- the same correction already recorded for
-- py-backfill, VenueHistoryDO and the stability scores -- so the collector does it.
--
-- WHY A READ MODEL AND NOT A PER-REQUEST COMPUTATION. A verified figure means replaying both legs'
-- actual settlements, which is 652 candidate pairs against 281,930 settlements in the last 7 days.
-- One query fetches every leg at once in 74ms (measured, all buffers shared hit), but the replay
-- itself is 652 calls into the backtest engine. The Worker has 10ms of CPU per request, so the
-- answer has to be precomputed. Nightly, per the original plan.
--
-- WHY THE ENGINE AND NOT SQL. `backtestPair` in packages/core is the one piece of arithmetic this
-- project treats as correctness-critical: it sums each leg at its OWN settlement times, never
-- resampling onto a shared grid, and reports gaps as missed settlements rather than as zero
-- funding. Re-expressing that in SQL would create a second implementation of exactly that, and the
-- plan's own verification section used to demand parity between two implementations -- a line
-- deleted as moot once there was only one. The collector imports the engine instead.
--
-- THE RANKING IS UNGATED, AND EACH ROW CARRIES ITS OWN RISK. A ranking by realised net funding puts
-- distressed listings first: IOST tops it at $835 per $10k because its gate leg funds at -962% APR
-- on $0.68M of open interest. Rather than hide those behind thresholds, every row stores what makes
-- it risky -- the thinner leg's open interest, the worse leg's absolute APR, and the pair's
-- stability -- so the page can show the danger next to the number. Floors were measured first
-- ($2M OI / 200% APR / 0.6 stability would have yielded a defensible but unfamiliar list) and
-- deliberately not applied.
--
-- ONE FLOOR IS APPLIED: both legs must have charged on all 7 days of the window. Without it, a
-- market with six charging days can top the table on a handful of settlements -- STONK's legs have
-- 6, 6 and 22 charging days. 4,004 of 4,838 markets clear 7/7, and 512 of 650 candidate pairs do,
-- so this costs little and removes the artefact. The day counts come from market_funding_daily,
-- which already holds them, so no second scan of funding_events is needed.

-- One row per pair per run. Dated rather than a single snapshot, so the page can state how fresh
-- the figures are and a run that fails leaves last night's answer standing rather than a hole.
--
-- At most 891 pairable assets exist, so this grows by under a thousand small rows a night --
-- negligible beside market_funding_daily's 344,598 rows at 84 MB.
CREATE TABLE IF NOT EXISTS market_pair_backtests (
  run_day date NOT NULL,
  asset text NOT NULL,
  long_venue_id text NOT NULL,
  long_symbol text NOT NULL,
  short_venue_id text NOT NULL,
  short_symbol text NOT NULL,
  -- Per leg, at the notional the replay used. Stored as the engine returned them.
  size_usd double precision NOT NULL,
  days double precision NOT NULL,
  net_funding_usd double precision NOT NULL,
  net_funding_apr_percent double precision NOT NULL,
  win_rate_days double precision NOT NULL,
  avg_daily_usd double precision NOT NULL,
  long_settlements integer NOT NULL,
  short_settlements integer NOT NULL,
  -- A gap is reported, never counted as zero funding, so the page can say what it did not see.
  missed_settlements integer NOT NULL,
  -- The risk disclosure the ranking deliberately does not filter on.
  thinner_leg_oi_usd double precision,
  worst_leg_abs_apr double precision,
  pair_stability double precision,
  long_charge_days integer NOT NULL,
  short_charge_days integer NOT NULL,
  PRIMARY KEY (run_day, asset)
);

-- The page reads one day's ranking, so the index leads with the day and orders by the figure.
CREATE INDEX IF NOT EXISTS market_pair_backtests_ranking
  ON market_pair_backtests (run_day, net_funding_usd DESC);
