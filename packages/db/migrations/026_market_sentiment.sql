-- Fear & greed: one score for the whole book, every 30 minutes, for the header bar and its chart.
--
-- THE FORMULA. Four components, each normalised to a 0-100 percentile rank against its own trailing
-- 30-day history, oriented so higher always means greedier, then averaged:
--
--   funding_component     percentile of the OI-weighted average APR across the book right now
--   oi_component           percentile of total open interest right now
--   liquidation_component percentile of (long-liquidation - short-liquidation) / total over the
--                          last 24h, INVERTED: a book where longs are being forced out is fear, not
--                          greed, however unusual that reading is against its own history
--   taker_flow_component  percentile of net taker buy dollars over the last 24h
--
--   score = mean of whichever of the four are available
--
-- WHY PERCENTILE AGAINST OWN HISTORY, NOT A FIXED SCALE. An OI-weighted APR of 5% means something
-- different in a quiet month than a volatile one. Percentile rank answers "is this unusual for this
-- book lately", which is what a fear/greed reading is actually claiming, the same reason
-- stability_30d (migration 009) is shrunk toward a prior rather than read as a raw magnitude.
--
-- WHY THIS TABLE IS ITS OWN HISTORY, NOT A RESCAN OF funding_snapshots/liquidations/taker_flow EVERY
-- 30 MINUTES. The raw materials for percentile ranking live in this table's own earlier rows, not in
-- a fresh 30-day GROUP BY over the source hypertables on every tick. A first pass at this migration
-- computed the percentile baseline by rescanning funding_snapshots directly; measured against hklab's
-- shared Postgres, a naive version of that query (a window function over every row, not a plain
-- aggregate) ran 85+ seconds before it had to be cancelled by hand. Even the corrected, cheap-looking
-- version still means four GROUP-BY-day scans over up to 30 days of the collector's largest tables,
-- repeated every 30 minutes forever, against an instance other tenants share. Reading this table's own
-- last 30 days instead is a handful of rows: cheap regardless of how large the source tables grow, and
-- it is exactly what the four RAW columns beside each component are for.
--
-- WHAT THIS COSTS. Percentile ranking is thin for the first 30 days after this ships, and the
-- earliest possible readings percentile-rank against nothing at all -- COALESCEd to 50 (neutral)
-- rather than left NULL, so the score is always a number, just an uninformative one until real
-- history accumulates. The same caveat migration 018 already states about its own evaluation
-- windows: a decision needing genuine history should wait for it, not read early rows as settled.
CREATE TABLE IF NOT EXISTS market_sentiment (
  computed_at timestamptz NOT NULL,
  score double precision NOT NULL,
  label text NOT NULL CHECK (label IN ('extreme fear', 'fear', 'neutral', 'greed', 'extreme greed')),

  -- Raw values are kept beside their percentile so a later reader can re-derive the score, replay
  -- history with a different window, or spot a component that has gone stale or absent -- the same
  -- reasoning migration 018 gives for keeping market_pair_candidates' evidence beside its score.
  funding_raw double precision,
  funding_component double precision,
  oi_raw double precision,
  oi_component double precision,
  liquidation_raw double precision,
  liquidation_component double precision,
  taker_flow_raw double precision,
  taker_flow_component double precision,

  PRIMARY KEY (computed_at)
);

-- The chart reads a trailing window in order; the job's own percentile lookup does too.
CREATE INDEX IF NOT EXISTS market_sentiment_computed_at ON market_sentiment (computed_at DESC);
