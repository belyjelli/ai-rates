-- Hourly funding for the pair page's comparison chart over its short windows: 1, 3 and 7 days.
--
-- market_funding_daily (008) is too coarse to draw a day, and funding_events is too large to read per
-- request inside a Worker's 10ms of CPU. One row per market per UTC hour is the grain a short chart
-- needs: an 8-hourly market lands in one hour and the line holds that rate until its next
-- settlement, which is how funding actually accrues. Windows of 15 days and more read the daily
-- rollup instead, so this keeps 8 days and no more: ~5,300 markets x 24 x 8 is about a million rows.
--
-- A plain table the collector maintains, not a continuous aggregate, for the reasons 008 records.
-- Sums, never a finished APR, also for 008's reason: a window divides sum(rate) by sum(basis_hours)
-- once at the end, which only works if both sums survive to the end.
CREATE TABLE IF NOT EXISTS market_funding_hourly (
  venue_id text NOT NULL,
  venue_symbol text NOT NULL,
  hour timestamptz NOT NULL,
  rate_sum double precision NOT NULL,
  basis_hours_sum double precision NOT NULL,
  settlements integer NOT NULL,
  PRIMARY KEY (venue_id, venue_symbol, hour)
);

-- The chart reads one asset's markets through the primary key. Retention deletes by hour across
-- every market, so that sweep gets an index leading with the hour.
CREATE INDEX IF NOT EXISTS market_funding_hourly_hour ON market_funding_hourly (hour);
