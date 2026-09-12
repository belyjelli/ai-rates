-- Phase 3 heatmap: trailing 30d and 60d funding windows, and the daily rollup they are summed from.
--
-- The heatmap switches cells between NOW / 7d / 30d / 60d. The first two exist already; 30d and 60d
-- cannot be computed per request -- funding_events holds ~3.5M rows over 91 days and the Worker has
-- 10ms of CPU -- so they become columns here, refreshed by the collector.
--
-- Deliberately NOT a TimescaleDB continuous aggregate, though funding_events is a hypertable and
-- the heatmap plan said to try one first. Three reasons, all measured on this instance:
--   1. funding_events already has compressed chunks and a 12-hourly compression policy, so a
--      60-day refresh window spans compressed data -- the interaction the plan flagged as most
--      likely to bite.
--   2. The database shares a background-worker pool with 16 other tenants and already runs nine
--      policy jobs; a continuous aggregate adds a refresh job to that pool.
--   3. The integration-test schema duplicates every policy (jobs 1004-1006 mirror 1000-1002), so
--      the refresh job would be created twice.
-- A rollup table the collector maintains costs no background jobs, is portable off TimescaleDB,
-- and is exercised by the integration harness that already exists.

ALTER TABLE market_funding_stats
  ADD COLUMN IF NOT EXISTS apr_30d double precision,
  ADD COLUMN IF NOT EXISTS apr_60d double precision,
  ADD COLUMN IF NOT EXISTS long_windows_at timestamptz;

-- One row per market per UTC day.
--
-- The rate sum and the hours it accrued over are stored apart, never a finished APR, because
-- markets settle on different intervals: folding a 1-hourly market and an 8-hourly one by averaging
-- their daily APRs would weight them equally. A window has to be sum(rate)/sum(basis_hours),
-- divided once at the end, which only works if both sums survive to the end.
CREATE TABLE IF NOT EXISTS market_funding_daily (
  venue_id text NOT NULL,
  venue_symbol text NOT NULL,
  day date NOT NULL,
  rate_sum double precision NOT NULL,
  basis_hours_sum double precision NOT NULL,
  settlements integer NOT NULL,
  PRIMARY KEY (venue_id, venue_symbol, day)
);

-- The window sums filter by day across every market, so the index leads with day. A plain table is
-- enough: ~5,300 markets x 70 retained days is a few hundred thousand small rows.
CREATE INDEX IF NOT EXISTS market_funding_daily_day ON market_funding_daily (day);
