-- Phase 2 read models: latest state per market, settled funding averages, and the cross-venue screener.

-- Latest snapshot per market, upserted by the collector every cycle, so reads never scan funding_snapshots.
-- `apr` is rate / basis_hours * 8760 * 100.
CREATE TABLE IF NOT EXISTS market_latest (
  venue_id text NOT NULL,
  venue_symbol text NOT NULL,
  base text NOT NULL,
  quote text,
  observed_at timestamptz NOT NULL,
  rate double precision NOT NULL,
  basis_hours double precision NOT NULL,
  apr double precision NOT NULL,
  interval_hours double precision,
  next_funding_at timestamptz,
  kind text NOT NULL,
  mark_price double precision,
  index_price double precision,
  open_interest_usd double precision,
  volume_24h_usd double precision,
  PRIMARY KEY (venue_id, venue_symbol)
);
CREATE INDEX IF NOT EXISTS market_latest_base ON market_latest (base);

-- Time-weighted settled funding per market over trailing windows (sum of rates / hours covered).
-- Refreshed by the collector every few minutes.
CREATE TABLE IF NOT EXISTS market_funding_stats (
  venue_id text NOT NULL,
  venue_symbol text NOT NULL,
  apr_24h double precision,
  apr_7d double precision,
  settlements_24h integer NOT NULL,
  settlements_7d integer NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (venue_id, venue_symbol)
);

-- Best funding spread per asset: long the cheapest market, short the richest, on two different venues.
-- Filters apply to each leg before pairing; markets older than p_max_age are ignored.
CREATE OR REPLACE FUNCTION screener_pairs(
  p_min_open_interest_usd double precision DEFAULT 0,
  p_min_volume_24h_usd double precision DEFAULT 0,
  p_venue_ids text[] DEFAULT NULL,
  p_venue_types text[] DEFAULT NULL,
  p_max_age interval DEFAULT interval '5 minutes'
)
RETURNS TABLE (
  asset text,
  venue_count integer,
  spread_apr double precision,
  spread_apr_7d double precision,
  long_venue_id text,
  long_symbol text,
  long_apr double precision,
  long_apr_7d double precision,
  long_interval_hours double precision,
  long_open_interest_usd double precision,
  long_volume_24h_usd double precision,
  short_venue_id text,
  short_symbol text,
  short_apr double precision,
  short_apr_7d double precision,
  short_interval_hours double precision,
  short_open_interest_usd double precision,
  short_volume_24h_usd double precision,
  oldest_observed_at timestamptz
)
LANGUAGE sql
STABLE
SET search_path FROM CURRENT
AS $$
  WITH legs AS (
    SELECT m.*, s.apr_7d AS stat_apr_7d
    FROM market_latest m
    JOIN venues v ON v.id = m.venue_id
    LEFT JOIN market_funding_stats s ON s.venue_id = m.venue_id AND s.venue_symbol = m.venue_symbol
    WHERE m.observed_at > now() - p_max_age
      AND (p_venue_ids IS NULL OR m.venue_id = ANY (p_venue_ids))
      AND (p_venue_types IS NULL OR v.type = ANY (p_venue_types))
      AND (p_min_open_interest_usd <= 0 OR m.open_interest_usd >= p_min_open_interest_usd)
      AND (p_min_volume_24h_usd <= 0 OR m.volume_24h_usd >= p_min_volume_24h_usd)
  ),
  counts AS (
    SELECT base, count(DISTINCT venue_id)::integer AS n
    FROM legs GROUP BY base HAVING count(DISTINCT venue_id) >= 2
  ),
  cheapest AS (
    SELECT DISTINCT ON (base, venue_id) * FROM legs ORDER BY base, venue_id, apr ASC
  ),
  richest AS (
    SELECT DISTINCT ON (base, venue_id) * FROM legs ORDER BY base, venue_id, apr DESC
  )
  SELECT DISTINCT ON (l.base)
    l.base,
    c.n,
    r.apr - l.apr,
    r.stat_apr_7d - l.stat_apr_7d,
    l.venue_id, l.venue_symbol, l.apr, l.stat_apr_7d, l.interval_hours, l.open_interest_usd, l.volume_24h_usd,
    r.venue_id, r.venue_symbol, r.apr, r.stat_apr_7d, r.interval_hours, r.open_interest_usd, r.volume_24h_usd,
    least(l.observed_at, r.observed_at)
  FROM cheapest l
  JOIN counts c ON c.base = l.base
  JOIN richest r ON r.base = l.base AND r.venue_id <> l.venue_id
  ORDER BY l.base, r.apr - l.apr DESC
$$;
