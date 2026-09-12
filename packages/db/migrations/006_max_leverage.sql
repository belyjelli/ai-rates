-- A1 of leverage-aware capital: the headline max leverage each venue publishes.
--
-- The pair page assumed 1x, so "capital $20,000" overstated what a pair actually ties up. Both legs
-- are open at once on different exchanges and margin independently, so capital is
-- size * (imr_long + imr_short); with symmetric leverage L that is 2 * size / L.
--
-- Nullable on purpose. Only bybit, gate, kucoin and hyperliquid publish this in a bulk call we
-- already make; aster, paradex and lighter publish nothing usable. A NULL renders as "–" rather
-- than silently assuming 1x, on the same principle as absent fees and absent marks.
--
-- This is the headline number, which holds only at small size: bybit's 150x on BTCUSDT lasts to
-- $300k notional and falls to 100x by $2M. The tiered ladder (market_leverage_tiers, B1) supersedes
-- this column for sized positions; it stays as the fallback when no tier row matches.

ALTER TABLE markets
  ADD COLUMN IF NOT EXISTS max_leverage double precision;
