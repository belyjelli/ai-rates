-- Phase 3: project funding stability through the screener, so the sort key that was dropped
-- during the sortable-columns work can come back.
--
-- Migration 009 scores each MARKET. A screener row is a PAIR of markets on two exchanges, and a
-- pair is only as persistent as its weaker leg: a leg that keeps flipping will keep handing back
-- what the steady leg earns. So the pair figure is the minimum of the two.
--
-- WHY THE MINIMUM IS COMPUTED HERE AND NOT IN THE ORDER BY, with a CASE rather than a bare
-- least(): least() SKIPS nulls rather than propagating them. Verified on the instance --
-- `least(0.7, NULL)` returns 0.7, not NULL -- and 127 of 1,571 live assets currently have exactly
-- one scored leg and one unscored. A bare least() would therefore rank those 127 by their scored
-- leg alone, flattering precisely the pairs whose data is incomplete, and `NULLS LAST` could not
-- help because no null is ever produced. The CASE makes an unscored leg poison the pair, so the
-- ordering fragment gets a real null to push to the end. Only 5 assets are wholly unscored, so
-- this would have hidden behind a small-looking null count.
--
-- The columns come free: the `candidates` CTE already LEFT JOINs market_funding_stats for apr_7d,
-- and stability lives in the same table, so this adds no join and no scan.
--
-- stability_days travels with the score because 0.688 over 6 charging days and 0.688 over 30 are
-- not the same claim, and the day count is the only thing that separates them. The page renders it
-- the way the backtest page states its own coverage rather than annualizing a hole silently.
--
-- PostgreSQL cannot change a function's return type with CREATE OR REPLACE, so the function is
-- dropped first. It is dropped by the SEVEN-argument signature because that is what is actually
-- installed -- confirmed against pg_proc in both `public` and `airates_it`, with no six-argument
-- overload surviving migration 005's own DROP. The worker calls it with six arguments and picks up
-- p_max_mark_deviation's default, so the installed arity is not what the call site implies.

DROP FUNCTION IF EXISTS screener_pairs(double precision, double precision, text[], text[], interval, double precision, double precision);

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
  pair_stability double precision,
  long_venue_id text,
  long_symbol text,
  long_apr double precision,
  long_apr_7d double precision,
  long_interval_hours double precision,
  long_open_interest_usd double precision,
  long_volume_24h_usd double precision,
  long_stability double precision,
  long_stability_days integer,
  short_venue_id text,
  short_symbol text,
  short_apr double precision,
  short_apr_7d double precision,
  short_interval_hours double precision,
  short_open_interest_usd double precision,
  short_volume_24h_usd double precision,
  short_stability double precision,
  short_stability_days integer,
  oldest_observed_at timestamptz
)
LANGUAGE sql
STABLE
SET search_path FROM CURRENT
AS $$
  WITH candidates AS (
    SELECT m.*, s.apr_7d AS stat_apr_7d,
           s.stability_30d AS stat_stability, s.stability_days AS stat_stability_days
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
    -- An unscored leg poisons the pair; see the note at the top of this migration.
    CASE
      WHEN l.stat_stability IS NULL OR r.stat_stability IS NULL THEN NULL
      ELSE least(l.stat_stability, r.stat_stability)
    END,
    l.venue_id, l.venue_symbol, l.apr, l.stat_apr_7d, l.interval_hours, l.open_interest_usd, l.volume_24h_usd,
    l.stat_stability, l.stat_stability_days,
    r.venue_id, r.venue_symbol, r.apr, r.stat_apr_7d, r.interval_hours, r.open_interest_usd, r.volume_24h_usd,
    r.stat_stability, r.stat_stability_days,
    least(l.observed_at, r.observed_at)
  FROM cheapest l
  JOIN counts c ON c.base = l.base
  JOIN richest r ON r.base = l.base AND r.venue_id <> l.venue_id
  ORDER BY l.base, r.apr - l.apr DESC
$$;
