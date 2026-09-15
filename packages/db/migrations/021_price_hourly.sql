-- Hourly mark, index and open interest per market: the rollup that outlives its own source.
--
-- Of the 14 tables before this one, NOT ONE holds price, open interest or basis over time. The only
-- rollups are funding -- market_funding_daily (008) and market_funding_hourly (014). Everything with
-- a price in it lives in funding_snapshots, which add_retention_policy drops at 30 days (001:49).
--
-- That makes this migration unlike every other rollup here, and the difference is the whole reason
-- it is urgent rather than merely useful:
--
--   * 008 and 014 fold funding_events, which is kept indefinitely (001:51). If either rollup were
--     dropped it could be rebuilt from source, so their jobs re-fold a wide window every run -- 70
--     days for the daily fold -- and late-arriving backfill rows are picked up for free.
--   * THIS rollup folds funding_snapshots, which is gone at 30 days. Nothing here can be rebuilt
--     once the source chunk is dropped. Every hour this table does not exist is an hour of price,
--     open interest and basis history that is permanently lost, for every market on the site.
--
-- Two consequences are designed into the job that maintains it (store.RefreshPriceHourly):
--
--   1. The lookback is narrow -- hours, not days. Snapshots are written by the collector at
--      observation time and are never backfilled, so there is no late arrival to catch; and
--      funding_snapshots takes ~324k rows an hour, so re-folding even three days would scan ~23M
--      rows on a box with one vCPU shared with the venue loops. The lookback is a parameter rather
--      than baked into the SQL precisely so a gap after a long outage can be folded by hand.
--   2. Retention here must OUTLIVE the source, which is the point of the table. 400 days keeps a
--      year plus a margin: ~5,300 markets x 24 hours x 400 days is about 51M narrow rows, a few GB
--      on the airates_nvme tablespace. Nothing reads past 60 days yet; the history is being banked
--      for the flow and basis analyses that cannot start until it exists.
--
-- Deliberately NOT a TimescaleDB continuous aggregate, for the three reasons 008 records and which
-- all still hold: funding_snapshots is compressed on a policy so a refresh window spans compressed
-- chunks, the background-worker pool is shared with 16 other tenants, and the integration-test
-- schema duplicates every policy so the refresh job would be created twice.
--
-- Averages AND endpoints are stored, because the two answer different questions and neither is
-- recoverable from the other: an OI-weighted funding index wants the hour's mean, while flow (dOI)
-- and any price change want the value at the hour's edge. Per-column sample counts are kept because
-- coverage genuinely differs per column and per venue -- HTX (337 swaps) and BitMart (228 perps)
-- publish no mark in any bulk call, which is why 020 taught screener_pairs to fall back to
-- index_price. On those venues mark_samples is 0 and basis is uncomputable, and a chart reading this
-- table must say so rather than silently drop the venue or plot a zero basis.
CREATE TABLE IF NOT EXISTS market_price_hourly (
  venue_id text NOT NULL,
  venue_symbol text NOT NULL,
  hour timestamptz NOT NULL,
  -- Snapshots folded into this hour. At a 60s cycle a healthy market reads 60; fewer means the
  -- venue was slow, circuit-broken or newly listed, and that is worth seeing rather than smoothing.
  samples integer NOT NULL,
  mark_avg double precision,
  mark_last double precision,
  mark_samples integer NOT NULL,
  index_avg double precision,
  index_last double precision,
  index_samples integer NOT NULL,
  oi_avg double precision,
  oi_last double precision,
  oi_samples integer NOT NULL,
  -- avg(mark - index) over the samples where BOTH are present, never avg(mark) - avg(index): the
  -- two columns have different coverage, so subtracting their means would compare a mean over 60
  -- samples with a mean over 3 and report the difference as basis.
  basis_avg double precision,
  basis_samples integer NOT NULL,
  PRIMARY KEY (venue_id, venue_symbol, hour)
);

-- Charts read one asset's markets through the primary key. Retention deletes by hour across every
-- market, so that sweep gets an index leading with the hour, as 008 and 014 both do.
CREATE INDEX IF NOT EXISTS market_price_hourly_hour ON market_price_hourly (hour);
