-- Phase 2 data quality: legs of one asset must agree on price.
--
-- Two venues listing the same ticker do not always list the same thing. Measured 2026-09-12 against
-- live rows: gate's CAT_USDT marks $817.90 while CAT elsewhere is a memecoin at $0.000002,
-- hl-para's para:STX marks $830.95 against Stacks at $0.2533, JPY is quoted both ways (0.0065 vs
-- 153.50), KR200 disagrees 1371x, and hl-mkts' US500 is scaled 10x against the other index venues.
-- Pairing those produces spectacular, entirely fictional spreads.
--
-- A curated identity map would need constant tending; price is self-describing instead. Legs sitting
-- further than p_max_mark_deviation from the asset's median mark are dropped before pairing. At the
-- 0.05 default this removed 31 of 4702 legs (0.66%) and every one of them was genuinely mismatched.
-- NULL disables the check. Only workable now that migration 004 put all venues on one price scale.

DROP FUNCTION IF EXISTS screener_pairs(double precision, double precision, text[], text[], interval, double precision);

CREATE OR REPLACE FUNCTION screener_pairs(
  p_min_open_interest_usd double precision DEFAULT 0,
  p_min_volume_24h_usd double precision DEFAULT 0,
  p_venue_ids text[] DEFAULT NULL,
  p_venue_types text[] DEFAULT NULL,
  p_max_age interval DEFAULT interval '5 minutes',
  p_max_abs_apr double precision DEFAULT NULL,
  p_max_mark_deviation double precision DEFAULT 0.05
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
  WITH candidates AS (
    SELECT m.*, s.apr_7d AS stat_apr_7d
    FROM market_latest m
    JOIN venues v ON v.id = m.venue_id
    LEFT JOIN market_funding_stats s ON s.venue_id = m.venue_id AND s.venue_symbol = m.venue_symbol
    WHERE m.observed_at > now() - p_max_age
      AND (p_venue_ids IS NULL OR m.venue_id = ANY (p_venue_ids))
      AND (p_venue_types IS NULL OR v.type = ANY (p_venue_types))
      AND (p_min_open_interest_usd <= 0 OR m.open_interest_usd >= p_min_open_interest_usd)
      AND (p_min_volume_24h_usd <= 0 OR m.volume_24h_usd >= p_min_volume_24h_usd)
      AND (p_max_abs_apr IS NULL OR abs(m.apr) <= p_max_abs_apr)
  ),
  -- The median, not the mean: a mismatched leg must not drag the reference toward itself.
  marks AS (
    SELECT base, percentile_cont(0.5) WITHIN GROUP (ORDER BY mark_price) AS median_mark
    FROM candidates WHERE mark_price > 0 GROUP BY base
  ),
  legs AS (
    SELECT c.* FROM candidates c
    LEFT JOIN marks k ON k.base = c.base
    WHERE p_max_mark_deviation IS NULL
       OR k.median_mark IS NULL
       OR c.mark_price IS NULL
       OR abs(c.mark_price - k.median_mark) <= p_max_mark_deviation * k.median_mark
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
