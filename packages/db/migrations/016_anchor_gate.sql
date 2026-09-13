-- Phase 5 / symbol identity refactor: one call per market — is this the asset it claims to be?
--
-- Migration 005 dropped legs sitting more than 5% from their asset's MEDIAN mark. Migration 015
-- then verified identity properly, by correlation against the pool's deepest market, and the two
-- disagree in a way that matters. Measured 2026-09-14 on live data, both filters drop 29 of 4,730
-- legs — but not the same 29. They disagree on 10 legs in each direction:
--
--   asset   the median guard drops            the anchor gate drops
--   PURR    hyperliquid $11.15M + mexc        bybit/okx/gate ($0.91M between them)
--   BB      hl-xyz $8.48M + okx + lighter     five venues ($1.83M between them)
--   JPY     hl-xyz $20.86M                    nothing (it is the anchor)
--
-- The median names the biggest CLUSTER as correct, and the biggest cluster is not the truest one.
-- So the filter running in production today drops Hyperliquid's own PURR market -- the deepest in
-- its pool by twelvefold -- and keeps three thin venues quoting something else entirely. Both
-- filters leave one internally consistent cluster behind, so pairing was never unsafe; the anchor
-- gate simply keeps the deeper side.
--
-- WHAT THIS COSTS, MEASURED BEFORE COMMITTING TO IT. 899 assets currently quote on two or more
-- venues; 887 still do under the anchor gate. Of the 12 that lose pairability, only four carry any
-- open interest at all -- JPY ($12.01M, a reciprocal quote that must never pair: mexc quotes
-- 1/153.56 against hl-xyz's 153.56), AI ($0.60M), HK50 ($0.07M) and RTX ($0.01M). The other eight
-- drop legs reporting no open interest whatsoever, and five of them (MUSTOCK, SKHYSTOCK, SNDKSTOCK,
-- SPCXSTOCK, SKHYNIXSTOCK) are pre-consolidation artefacts that step 1 of the refactor re-bases
-- onto their real pools as soon as it deploys.
--
-- ONE CALL, AND THE REASON IS SEPARATE. A market is listed if its mark agrees with its asset's
-- anchor, and excluded if it does not. That is the whole decision -- there is no partial listing
-- and no second opinion. WHY it disagrees is migration 015's job: `scale`, `tracks`, `mismatch` or
-- `unverified`, reported on /status. A market quoted 10x per contract (`scale`) is excluded along
-- with the rest, because until someone sets its multiplier the number it publishes is not the
-- asset's price, and a wrong number is worth less than no number. Fixing the multiplier puts it
-- back automatically.
--
-- THE ANCHOR IS CHOSEN FROM EVERY FRESH MARKET, NOT FROM THE FILTERED CANDIDATES. Identity is a
-- property of the asset, not of whatever the reader happened to filter to. The old median was
-- computed over `candidates`, so filtering down to two thin venues quietly recomputed the reference
-- from those two and admitted a pair the unfiltered query would have rejected. Reading the anchor
-- from market_latest directly closes that.
--
-- The tolerance moves 0.05 -> 0.10 and the test becomes log-symmetric (a member at 1.1x the anchor
-- and one at 1/1.1x are the same distance away, which `abs(mark - ref) <= d * ref` is not). 0.10
-- sits in an empty band: of 899 pools, 860 agree within 2%, 18 more within 5%, 2 more within 10%,
-- and then nothing at all until QNT at 1.32x. It is the same DIVERGENCE_TRIGGER packages/core uses,
-- so the gate and the report cannot drift apart.
--
-- The signature, parameter names and return type are all unchanged, so this is a plain CREATE OR
-- REPLACE -- none of the DROP-by-exact-arity pain migration 010 documents applies here. Only the
-- body and the default change. `p_max_mark_deviation` keeps its name: it still measures a mark's
-- deviation, just from the anchor rather than from the median.

CREATE OR REPLACE FUNCTION screener_pairs(
  p_min_open_interest_usd double precision DEFAULT 0,
  p_min_volume_24h_usd double precision DEFAULT 0,
  p_venue_ids text[] DEFAULT NULL,
  p_venue_types text[] DEFAULT NULL,
  p_max_age interval DEFAULT interval '5 minutes',
  p_max_abs_apr double precision DEFAULT NULL,
  p_max_mark_deviation double precision DEFAULT 0.10
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
  -- The deepest market in the asset's pool, read from every fresh market rather than from the
  -- filtered candidates, so the reader's filters cannot move the reference. Ties break on the
  -- symbol so the choice is deterministic between runs.
  anchors AS (
    SELECT DISTINCT ON (base) base, mark_price AS anchor_mark
    FROM market_latest
    WHERE observed_at > now() - p_max_age AND mark_price > 0
    ORDER BY base, open_interest_usd DESC NULLS LAST, venue_id, venue_symbol
  ),
  legs AS (
    SELECT c.* FROM candidates c
    LEFT JOIN anchors a ON a.base = c.base
    -- Expressed as a band rather than abs(mark - ref) <= d * ref so that it is symmetric in the
    -- ratio: which market happens to hold the most open interest is an accident, and the same two
    -- prices must not agree or disagree depending on which of them is the anchor. A missing mark
    -- still agrees by default -- a field the venue does not publish is not evidence of a mismatch.
    WHERE p_max_mark_deviation IS NULL
       OR a.anchor_mark IS NULL
       OR c.mark_price IS NULL
       OR c.mark_price BETWEEN a.anchor_mark / (1 + p_max_mark_deviation)
                           AND a.anchor_mark * (1 + p_max_mark_deviation)
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
    -- An unscored leg poisons the pair; see the note at the top of migration 010.
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
