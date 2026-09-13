-- Phase 5 / symbol identity refactor, step 6: say when a pair's legs settle in different dollars, and
-- let a reader pair only within one.
--
-- MEASURED BEFORE WRITING, production 2026-09-13 ~22:00Z, screener_pairs at the default $250k floor:
-- 678 pairs, of which 166 (24%) pair a leg in one quote currency with a leg in another. By
-- combination: 88 USDT against an unknown quote (Hyperliquid HIP-3 dexes and Lighter never set one),
-- 59 USDT/USDC, 6 USD/USDT, 4 unknown/USDC, 3 USD1/USDT, 2 USD/USD1, 2 USD1/USDC, 1 unknown/USD1,
-- 1 USD/USDC. Live markets by quote: USDT 5,221, USDC 430, unknown 350, USD 110, USD1 48, U 4.
--
-- WHY IT MATTERS. A USDT-margined long against a USDC-margined short is not delta-neutral in dollars:
-- it carries the USDT/USDC basis on both notionals, collateral sits in two currencies, and moving it
-- between the legs costs a conversion. Usually a few basis points and not a reason to hide the pair,
-- which is why the default still pairs across quotes. But a reader running size wants to see it, and
-- one who cannot hold two stablecoins wants those pairs gone rather than merely labelled.
--
-- WHAT CHANGES.
--   1. Two output columns, long_quote and short_quote, so every reader can mark a mixed pair.
--   2. An eighth parameter, p_same_quote, default false. When true, a pair's two legs must share a
--      quote currency, and a leg whose quote is unknown pairs with nothing -- an unknown quote cannot
--      be shown to match. Crucially this is applied BEFORE choosing the cheapest and richest legs,
--      not after: filtering finished pairs would drop an asset whose widest pair is mixed even when a
--      narrower same-quote pair exists, which is exactly the pair such a reader wants.
--
-- NOT A NEW IDENTITY. The quote does not join (asset_class, base). BTC on USDT and BTC on USDC are one
-- asset; quote is a property of the position, and the default keeps pairing them.
--
-- COMPATIBILITY. The existing seven-argument calls (the collector's nightly refreshPairBacktests, the
-- worker's screener) resolve to this function through the new parameter's default, so neither needs
-- to change for this to apply. The body is migration 017's with the quote threaded through.
DROP FUNCTION IF EXISTS screener_pairs(
  double precision, double precision, text[], text[], interval, double precision, double precision
);

CREATE FUNCTION screener_pairs(
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
           -- The pairing group within an asset. Constant unless the reader asked for one quote, so
           -- the default pairs exactly as 017 did.
           CASE WHEN p_same_quote THEN m.quote ELSE '' END AS quote_group
    FROM market_latest m
    JOIN venues v ON v.id = m.venue_id
    LEFT JOIN market_funding_stats s ON s.venue_id = m.venue_id AND s.venue_symbol = m.venue_symbol
    WHERE m.observed_at > now() - p_max_age
      AND (p_venue_ids IS NULL OR m.venue_id = ANY (p_venue_ids))
      AND (p_venue_types IS NULL OR v.type = ANY (p_venue_types))
      AND (p_min_open_interest_usd <= 0 OR m.open_interest_usd >= p_min_open_interest_usd)
      AND (p_min_volume_24h_usd <= 0 OR m.volume_24h_usd >= p_min_volume_24h_usd)
      AND (p_max_abs_apr IS NULL OR abs(m.apr) <= p_max_abs_apr)
      -- An unknown quote cannot be shown to match any other, so it sits out a same-quote reading.
      AND (NOT p_same_quote OR m.quote IS NOT NULL)
  ),
  -- The deepest market in the asset's pool, from every fresh market. Deliberately NOT per quote: the
  -- anchor answers "is this the same asset", and a USDC market of BTC is the same asset as a USDT one.
  anchors AS (
    SELECT DISTINCT ON (asset_class, base) asset_class, base, mark_price AS anchor_mark
    FROM market_latest
    WHERE observed_at > now() - p_max_age AND mark_price > 0
    ORDER BY asset_class, base, open_interest_usd DESC NULLS LAST, venue_id, venue_symbol
  ),
  legs AS (
    SELECT c.* FROM candidates c
    LEFT JOIN anchors a ON a.asset_class = c.asset_class AND a.base = c.base
    WHERE p_max_mark_deviation IS NULL
       OR a.anchor_mark IS NULL
       OR c.mark_price IS NULL
       OR c.mark_price BETWEEN a.anchor_mark / (1 + p_max_mark_deviation)
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
  -- Across quote groups, the widest pair wins: one row per asset, as before.
  ORDER BY l.asset_class, l.base, r.apr - l.apr DESC
$$;
