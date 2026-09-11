-- Phase 1 schema: market catalog, funding snapshots and settled funding history (TimescaleDB).
CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS venues (
  id text PRIMARY KEY,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('cex', 'dex', 'hip3')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS markets (
  venue_id text NOT NULL REFERENCES venues (id),
  venue_symbol text NOT NULL,
  base text NOT NULL,
  quote text,
  multiplier double precision NOT NULL DEFAULT 1,
  dex text,
  interval_hours double precision,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (venue_id, venue_symbol)
);
CREATE INDEX IF NOT EXISTS markets_base ON markets (base);

-- One row per market per collection cycle. `rate` is a fraction over `basis_hours`;
-- APR is derived at query time as rate / basis_hours * 8760 * 100.
CREATE TABLE IF NOT EXISTS funding_snapshots (
  observed_at timestamptz NOT NULL,
  venue_id text NOT NULL,
  venue_symbol text NOT NULL,
  rate double precision NOT NULL,
  basis_hours double precision NOT NULL,
  interval_hours double precision,
  next_funding_at timestamptz,
  kind text NOT NULL CHECK (kind IN ('predicted', 'settled')),
  mark_price double precision,
  index_price double precision,
  open_interest_usd double precision,
  volume_24h_usd double precision
);
SELECT create_hypertable('funding_snapshots', by_range('observed_at', INTERVAL '1 day'), if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS funding_snapshots_market ON funding_snapshots (venue_id, venue_symbol, observed_at DESC);
ALTER TABLE funding_snapshots SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'venue_id, venue_symbol',
  timescaledb.compress_orderby = 'observed_at DESC'
);
SELECT add_compression_policy('funding_snapshots', INTERVAL '1 day', if_not_exists => TRUE);
SELECT add_retention_policy('funding_snapshots', INTERVAL '30 days', if_not_exists => TRUE);

-- Settled funding payments; the backtester's source of truth. Kept indefinitely.
CREATE TABLE IF NOT EXISTS funding_events (
  settled_at timestamptz NOT NULL,
  venue_id text NOT NULL,
  venue_symbol text NOT NULL,
  rate double precision NOT NULL,
  basis_hours double precision NOT NULL,
  mark_price double precision,
  -- 'history': from the venue's funding-history API; 'observed': a settled value seen while collecting.
  source text NOT NULL CHECK (source IN ('history', 'observed')),
  PRIMARY KEY (venue_id, venue_symbol, settled_at)
);
SELECT create_hypertable('funding_events', by_range('settled_at', INTERVAL '30 days'), if_not_exists => TRUE);
ALTER TABLE funding_events SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'venue_id, venue_symbol',
  timescaledb.compress_orderby = 'settled_at DESC'
);
SELECT add_compression_policy('funding_events', INTERVAL '60 days', if_not_exists => TRUE);

-- One row per venue per collection cycle, for health and freshness.
CREATE TABLE IF NOT EXISTS collector_runs (
  started_at timestamptz NOT NULL,
  venue_id text NOT NULL,
  duration_ms integer NOT NULL,
  markets integer NOT NULL,
  requests integer NOT NULL,
  error text
);
SELECT create_hypertable('collector_runs', by_range('started_at', INTERVAL '7 days'), if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS collector_runs_venue ON collector_runs (venue_id, started_at DESC);
SELECT add_retention_policy('collector_runs', INTERVAL '30 days', if_not_exists => TRUE);
