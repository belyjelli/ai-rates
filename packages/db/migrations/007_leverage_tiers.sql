-- B1 of leverage-aware capital: each venue's own risk-limit ladder, one row per tier.
--
-- markets.max_leverage (006) holds only at small size. Bybit's 150x on BTCUSDT stops at $300k
-- notional and is 100x by $2M, so a flat headline overstates usable leverage by 3-5x at realistic
-- size. This table carries the whole ladder, letting capital come from the initial margin rate of
-- the tier a position's size actually falls into.
--
-- Bounds are USD notional per leg, half-open [lower_notional_usd, upper_notional_usd): the venues
-- publish an upper bound per tier and the next tier begins exactly there, so a size on a boundary
-- belongs to exactly one tier.
--
-- A NULL upper bound means the venue publishes no cap, not "very large". Bybit does publish one:
-- the top tier's riskLimitValue is the largest position it will open on that market at all
-- ($1.2bn on BTCUSDT), so it is stored as a real bound. A size above every tier therefore has no
-- valid tier, which is the honest answer -- the position cannot be opened -- rather than something
-- to round down into the top tier.
--
-- imr is stored rather than derived from max_leverage. The venues publish both and they are not
-- always exact reciprocals (Bybit tier 1 on BTCUSDT is 150x with an initialMargin of 0.0066, where
-- 1/150 is 0.006667), and it is the margin rate, not the leverage label, that sets capital.
--
-- No foreign key to markets: a ladder may be fetched for a symbol before the snapshot loop has
-- first written its markets row, and an orphan tier is harmless.

CREATE TABLE IF NOT EXISTS market_leverage_tiers (
  venue_id text NOT NULL REFERENCES venues (id),
  venue_symbol text NOT NULL,
  tier integer NOT NULL,
  lower_notional_usd double precision NOT NULL,
  upper_notional_usd double precision,
  imr double precision NOT NULL,
  mmr double precision,
  max_leverage double precision NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (venue_id, venue_symbol, tier)
);
