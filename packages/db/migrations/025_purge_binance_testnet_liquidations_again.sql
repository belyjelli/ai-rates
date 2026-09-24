-- Delete binance liquidations written by a stale deploy that read the TESTNET again.
--
-- 024 purged the testnet rows and ad254d7 moved binance to production's /market/ route. At
-- 2026-09-23 20:40:19 UTC a deploy from an out-of-date checkout replaced that build with one from
-- before both fixes: DefaultBinanceLiquidationURL was fstream.binancefuture.com again and binance was
-- back in the default liquidation venues. Found 2026-09-24 ~05:45 UTC, by which time it had stored
-- 3,371 binance rows (~$29.9M) that are play money.
--
-- The cutoff is that container's creation time. Rows before it came from the /market/ route and are
-- real, so they stay. Rows after it until this migration runs are testnet. The corrected collector
-- applies migrations BEFORE it starts any feed, so no production row it collects can precede this
-- delete.
DELETE FROM liquidations
WHERE venue_id = 'binance'
  AND liquidated_at >= '2026-09-23 20:40:19+00';
