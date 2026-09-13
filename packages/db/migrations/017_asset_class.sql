-- Phase 5 / symbol identity refactor, step 2: an asset is (asset_class, base), not base alone.
--
-- THE PRIZE IS A GATE THAT STOPS BINNING HALF OF EVERY COLLIDED TICKER. Migration 016 keeps one
-- internally consistent cluster per base and discards the other, because `base` cannot hold two
-- assets under one ticker. Measured in production on 2026-09-14, among the 19 bases whose marks
-- disagree by more than 1.5x:
--
--   BB    BlackBerry on hl-xyz, lighter, okx     BounceBit on mexc, binance, aster, gate, kucoin, bybit
--   STX   Seagate on hl-para at 818              Stacks on eight venues at 0.27
--   CAT   Caterpillar on gate at 817             a memecoin on five venues
--   ON    ON Semiconductor on okx, bybit         a token on kucoin, gate, mexc, aster, binance
--   RTX   Raytheon on gate                       a token on aster
--   ADI   Analog Devices on gate, bybit          a token on lighter
--
-- Under (asset_class, base) the two sides are different keys, so both become listable instead of
-- one being thrown away -- BounceBit's five venues ($1.83M of open interest) come back. No price
-- filter is involved: equity:BB and crypto:BB simply never meet.
--
-- WHAT THIS DOES NOT FIX, SO NOBODY READS IT AS A CURE-ALL. Some of those 19 are collisions WITHIN a
-- class, and 016's gate keeps excluding them exactly as before:
--   - JPY: a reciprocal quote (mexc 1/153.6 against hl-xyz 153.6); both are fx.
--   - OPENAI, ANTHROPIC, US500 on hl-mkts, probably HK50, KR200 and BYD: contract scale, one venue
--     quoting 10x. That is `scale` in migration 015, fixed by setting a multiplier, not a class.
--   - MEME, B, AI, EDGE: two different crypto tokens sharing a ticker.
--   - MOONSHOT: a bad rename (mexc KIMISTOCK), which is refactor step 1's rename guard.
--
-- VALUES. Five, mirrored by `AssetClass` in packages/core/src/market.ts. Taken from what each venue
-- declares, never inferred from the ticker; a venue that declares nothing is 'crypto', because that
-- is what every such venue lists.
--
-- BACKFILL IS THE COLLECTOR'S OWN NEXT PASS. Existing rows take the default, and every market's row
-- is rewritten with its declared class on the next collection cycle, a minute at most. A one-off
-- UPDATE here would need a second copy of every venue's classification rules in SQL, which is the
-- kind of duplicate this project avoids. During that minute the gate behaves exactly as 016 did.
--
-- DEPLOY ORDER. The collector applies this at boot, so it ships before any worker reading the new
-- column or the new screener_pairs signature.

ALTER TABLE markets
  ADD COLUMN IF NOT EXISTS asset_class text NOT NULL DEFAULT 'crypto'
    CONSTRAINT markets_asset_class_check
    CHECK (asset_class IN ('crypto', 'equity', 'commodity', 'fx', 'index'));

-- Mirrored onto the read model so every reader keys on it without joining markets.
ALTER TABLE market_latest
  ADD COLUMN IF NOT EXISTS asset_class text NOT NULL DEFAULT 'crypto'
    CONSTRAINT market_latest_asset_class_check
    CHECK (asset_class IN ('crypto', 'equity', 'commodity', 'fx', 'index'));

CREATE INDEX IF NOT EXISTS market_latest_class_base ON market_latest (asset_class, base);

-- The identity report pools by asset, so it names the class as well as the base.
ALTER TABLE market_identity_checks
  ADD COLUMN IF NOT EXISTS asset_class text NOT NULL DEFAULT 'crypto'
    CONSTRAINT market_identity_checks_asset_class_check
    CHECK (asset_class IN ('crypto', 'equity', 'commodity', 'fx', 'index'));

-- The nightly ranking stores one row per asset per night. With BB now two assets, (run_day, asset)
-- would reject the second row, so the key gains the class. Same rows, same writer otherwise.
ALTER TABLE market_pair_backtests
  ADD COLUMN IF NOT EXISTS asset_class text NOT NULL DEFAULT 'crypto'
    CONSTRAINT market_pair_backtests_asset_class_check
    CHECK (asset_class IN ('crypto', 'equity', 'commodity', 'fx', 'index'));
ALTER TABLE market_pair_backtests DROP CONSTRAINT IF EXISTS market_pair_backtests_pkey;
ALTER TABLE market_pair_backtests ADD PRIMARY KEY (run_day, asset_class, asset);

-- screener_pairs gains an output column, so the return type changes and CREATE OR REPLACE cannot
-- apply: drop by exact arity (the 7-argument signature 010 introduced and 016 kept), then recreate.
--
-- The body is migration 016's, carried forward rather than rebuilt from an older one, so the anchor
-- gate stays exactly as shipped: the anchor read from market_latest directly, not from the filtered
-- candidates; the log-symmetric band; the 0.10 default shared with DIVERGENCE_TRIGGER; and the null
-- escapes. The only change is that every step which used to key on base -- the anchor, the join to
-- it, the venue count, the cheapest and richest legs and the final pairing -- now keys on
-- (asset_class, base). Anchoring on base alone would pick the deepest BB market whether it is
-- BlackBerry or BounceBit, which is the bug this migration exists to remove.
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
  p_max_mark_deviation double precision DEFAULT 0.10
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
  -- symbol so the choice is deterministic between runs. The pool is (asset_class, base).
  anchors AS (
    SELECT DISTINCT ON (asset_class, base) asset_class, base, mark_price AS anchor_mark
    FROM market_latest
    WHERE observed_at > now() - p_max_age AND mark_price > 0
    ORDER BY asset_class, base, open_interest_usd DESC NULLS LAST, venue_id, venue_symbol
  ),
  legs AS (
    SELECT c.* FROM candidates c
    LEFT JOIN anchors a ON a.asset_class = c.asset_class AND a.base = c.base
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
    SELECT asset_class, base, count(DISTINCT venue_id)::integer AS n
    FROM legs GROUP BY asset_class, base HAVING count(DISTINCT venue_id) >= 2
  ),
  cheapest AS (
    SELECT DISTINCT ON (asset_class, base, venue_id) * FROM legs
    ORDER BY asset_class, base, venue_id, apr ASC
  ),
  richest AS (
    SELECT DISTINCT ON (asset_class, base, venue_id) * FROM legs
    ORDER BY asset_class, base, venue_id, apr DESC
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
    least(l.observed_at, r.observed_at)
  FROM cheapest l
  JOIN counts c ON c.asset_class = l.asset_class AND c.base = l.base
  JOIN richest r ON r.asset_class = l.asset_class AND r.base = l.base AND r.venue_id <> l.venue_id
  ORDER BY l.asset_class, l.base, r.apr - l.apr DESC
$$;
