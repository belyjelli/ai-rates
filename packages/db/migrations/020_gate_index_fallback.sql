-- Phase 5: gate a market on its index price when its venue publishes no mark.
--
-- WHY NOW. Migration 016's gate lets a market with no mark price agree with any anchor by default: "a
-- field the venue does not publish is not evidence of a mismatch". That was right while every venue
-- published a mark. HTX and BitMart, collected from this deploy, do not in any bulk call -- HTX only
-- per contract, BitMart nowhere -- so under 016 all 337 HTX swaps and 228 BitMart perps would pass
-- the gate unexamined. A token that merely shares a ticker (the MEME, AI and EDGE shape, 8x to 100x
-- apart) would pair as if it were the same asset.
--
-- Both venues do publish an index price: the venue's own reference for the underlying, which is what
-- the identity question is about. Mark and index differ by the funding basis, a fraction of a percent,
-- far inside the 10% band, so the index is a sound stand-in for this test and only this test.
--
-- WHAT CHANGES. The gate compares coalesce(mark_price, index_price) where it compared mark_price, for
-- both the anchor and every candidate. A market with neither still agrees by default, exactly as
-- before. Nothing else moves: the body is migration 019's, the anchor is still the deepest market by
-- open interest, keyed on (asset_class, base), and quote grouping is unchanged. The signature and the
-- returned columns are identical, so CREATE OR REPLACE applies and no caller changes.
CREATE OR REPLACE FUNCTION screener_pairs(
  p_min_open_interest_usd double precision DEFAULT 0,
  p_min_volume_24h_usd double precision DEFAULT 0,
  p_venue_ids text[] DEFAULT NULL,
  p_venue_types text[] DEFAULT NULL,
  p_max_age interval DEFAULT interval '5 minutes',
  p_max_abs_apr double precision DEFAULT NULL,
  p_max_mark_deviation double precision DEFAULT 0.10,
  p_same_quote boolean DEFAULT false
)
RETURNS TABLE (
  asset text,
  asset_class text,
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
  oldest_observed_at timestamptz,
  long_quote text,
  short_quote text
)
LANGUAGE sql
STABLE
SET search_path FROM CURRENT
AS $$
  WITH candidates AS (
    SELECT m.*, s.apr_7d AS stat_apr_7d,
           s.stability_30d AS stat_stability, s.stability_days AS stat_stability_days,
           CASE WHEN p_same_quote THEN m.quote ELSE '' END AS quote_group,
           -- The price the identity gate reads: the venue's mark, or its index where it has no mark.
           coalesce(m.mark_price, m.index_price) AS gate_price
    FROM market_latest m
    JOIN venues v ON v.id = m.venue_id
    LEFT JOIN market_funding_stats s ON s.venue_id = m.venue_id AND s.venue_symbol = m.venue_symbol
    WHERE m.observed_at > now() - p_max_age
      AND (p_venue_ids IS NULL OR m.venue_id = ANY (p_venue_ids))
      AND (p_venue_types IS NULL OR v.type = ANY (p_venue_types))
      AND (p_min_open_interest_usd <= 0 OR m.open_interest_usd >= p_min_open_interest_usd)
      AND (p_min_volume_24h_usd <= 0 OR m.volume_24h_usd >= p_min_volume_24h_usd)
      AND (p_max_abs_apr IS NULL OR abs(m.apr) <= p_max_abs_apr)
      AND (NOT p_same_quote OR m.quote IS NOT NULL)
  ),
  anchors AS (
    SELECT DISTINCT ON (asset_class, base) asset_class, base,
           coalesce(mark_price, index_price) AS anchor_mark
    FROM market_latest
    WHERE observed_at > now() - p_max_age AND coalesce(mark_price, index_price) > 0
    ORDER BY asset_class, base, open_interest_usd DESC NULLS LAST, venue_id, venue_symbol
  ),
  legs AS (
    SELECT c.* FROM candidates c
    LEFT JOIN anchors a ON a.asset_class = c.asset_class AND a.base = c.base
    WHERE p_max_mark_deviation IS NULL
       OR a.anchor_mark IS NULL
       OR c.gate_price IS NULL
       OR c.gate_price BETWEEN a.anchor_mark / (1 + p_max_mark_deviation)
                           AND a.anchor_mark * (1 + p_max_mark_deviation)
  ),
  counts AS (
    SELECT asset_class, base, quote_group, count(DISTINCT venue_id)::integer AS n
    FROM legs GROUP BY asset_class, base, quote_group HAVING count(DISTINCT venue_id) >= 2
  ),
  cheapest AS (
    SELECT DISTINCT ON (asset_class, base, quote_group, venue_id) * FROM legs
    ORDER BY asset_class, base, quote_group, venue_id, apr ASC
  ),
  richest AS (
    SELECT DISTINCT ON (asset_class, base, quote_group, venue_id) * FROM legs
    ORDER BY asset_class, base, quote_group, venue_id, apr DESC
  )
  SELECT DISTINCT ON (l.asset_class, l.base)
    l.base,
    l.asset_class,
    c.n,
    r.apr - l.apr,
    r.stat_apr_7d - l.stat_apr_7d,
    -- An unscored leg poisons the pair; see the note at the top of migration 010.
    CASE
      WHEN l.stat_stability IS NULL OR r.stat_stability IS NULL THEN NULL
      ELSE least(l.stat_stability, r.stat_stability)
    END,
    l.venue_id, l.venue_symbol, l.apr, l.stat_apr_7d, l.interval_hours, l.open_interest_usd, l.volume_24h_usd,
    l.stat_stability, l.stat_stability_days,
    r.venue_id, r.venue_symbol, r.apr, r.stat_apr_7d, r.interval_hours, r.open_interest_usd, r.volume_24h_usd,
    r.stat_stability, r.stat_stability_days,
    least(l.observed_at, r.observed_at),
    l.quote,
    r.quote
  FROM cheapest l
  JOIN counts c ON c.asset_class = l.asset_class AND c.base = l.base AND c.quote_group = l.quote_group
  JOIN richest r
    ON r.asset_class = l.asset_class AND r.base = l.base AND r.quote_group = l.quote_group
   AND r.venue_id <> l.venue_id
  ORDER BY l.asset_class, l.base, r.apr - l.apr DESC
$$;
