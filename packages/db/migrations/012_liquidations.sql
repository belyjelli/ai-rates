-- Phase 4: forced closes, the regressor the liquidation study needs.
--
-- The plan's Phase 4 text says liquidations are observable "on venue websockets" and prices
-- self-collection as a new long-lived WS ingestion. Measured 2026-09-13, that is only partly true:
-- Gate publishes every contract's forced closes in ONE public REST call, which the collector's
-- existing HTTP client, rate limiter and circuit breaker can poll on a PeriodicTask with no new
-- infrastructure. OKX also serves REST but needs one call per instFamily (479) and its BTC feed ran
-- 69 minutes stale; Bybit's liq-records is 404; MEXC is 403 even from hklab; Binance's
-- allForceOrders is gone. So ingestion starts REST-first on Gate.
--
-- WHY BOTH size_contracts AND notional_usd. Venues quote size in CONTRACTS and the multiplier is
-- per market: Gate's BTC_USDT is 0.0001 BTC per contract, so a size of 8 is about $62, not 8 BTC.
-- The 2026-09-13 probe confirmed this by reconciling sizes against quanto_multiplier x mark into a
-- plausible spread (median $154, min $3.60, max $254k) -- read as coins the same records would have
-- been absurd. Keeping the raw size means a conversion error stays recoverable rather than baked
-- irreversibly into the only column retained.
--
-- WHY THE PRIMARY KEY IS A COMPOSITE OF FIVE FIELDS. Gate's records carry no unique id -- only
-- contract, size, order_size, fill_price, order_price and a time in whole SECONDS -- and the
-- endpoint silently IGNORES from/to (verified with a bogus-parameter control that returned the
-- identical first record), so there is no resumable window and every poll re-reads the same page.
-- The key therefore has to be the event's own content. The cost is explicit: two genuinely distinct
-- liquidations on one contract, in the same second, at the same size and price, are stored once.
-- That is the right trade against double-counting the whole page on every poll, and it biases the
-- regressor DOWN in exactly the busiest moments, which is worth stating before any analysis leans
-- on counts.
CREATE TABLE IF NOT EXISTS liquidations (
  venue_id text NOT NULL REFERENCES venues (id),
  venue_symbol text NOT NULL,
  liquidated_at timestamptz NOT NULL,
  -- The side of the POSITION that was closed, not of the order that closed it: a liquidated long
  -- is sold. Adapters normalise to the position, because "longs were liquidated" is the claim.
  side text NOT NULL CHECK (side IN ('long', 'short')),
  size_contracts double precision NOT NULL,
  fill_price double precision NOT NULL,
  notional_usd double precision,
  PRIMARY KEY (venue_id, venue_symbol, liquidated_at, size_contracts, fill_price)
);

SELECT create_hypertable('liquidations', by_range('liquidated_at', INTERVAL '7 days'), if_not_exists => TRUE);

-- The study reads per market over weeks, so the market leads the index and time descends within it.
CREATE INDEX IF NOT EXISTS liquidations_market ON liquidations (venue_id, venue_symbol, liquidated_at DESC);

ALTER TABLE liquidations SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'venue_id, venue_symbol',
  timescaledb.compress_orderby = 'liquidated_at DESC'
);

-- 60 days, matching funding_events rather than funding_snapshots' one day: a regression scans this
-- repeatedly over weeks, so compressing yesterday's data would fight the only query that matters.
SELECT add_compression_policy('liquidations', INTERVAL '60 days', if_not_exists => TRUE);
-- Kept as long as the funding history it is regressed against.
SELECT add_retention_policy('liquidations', INTERVAL '120 days', if_not_exists => TRUE);
