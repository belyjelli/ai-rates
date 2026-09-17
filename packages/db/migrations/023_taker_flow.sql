-- Taker flow: who initiated the volume, per market, in 5-minute buckets. The input to /cvd.
--
-- charting-roadmap.md §1b ruled CVD out on 2026-09-14 because it needs the aggressor side of every
-- trade and "REST cannot do it" -- recentTrades misses most of a busy tape between polls. That holds
-- for raw trades. It does NOT hold for the venues' own pre-aggregated taker statistics, which were
-- not considered there. Measured 2026-09-17, four venues publish taker buy and taker sell per market
-- per 5 minutes, computed by the venue from its full tape, with days of history:
--
--   binance  /fapi/v1/klines            taker-buy quote volume and total quote volume, USDT
--   okx      /api/v5/rubik/stat/taker-volume-contract?unit=2   sellVol, buyVol, USD
--   gate     /api/v4/futures/usdt/contract_stats               long_taker_size / short_taker_size,
--                                        CONTRACTS -- the same unit as its open_interest, which
--                                        reconciled to its open_interest_usd within a dollar on BTC
--   bitget   /api/v2/mix/market/taker-buy-sell                 buyVolume, sellVolume, BASE coin
--
-- So a gap-free CVD at a 5-minute grain is a REST poll, not a WebSocket subsystem. What it cannot be
-- is finer than 5 minutes, and it covers the assets polled, not every market: one call per market
-- per venue. The page says both.
--
-- WHY DOLLARS AT INGEST. The venues disagree on units (quote, USD, contracts, base coin), and the
-- conversion needs each venue's own contract scale and price at that bucket. The collector has both
-- when it fetches; the worker would have neither. The raw unit is not kept: unlike a liquidation
-- (012), a bucket can be re-fetched from the venue for its whole retention window, so a conversion
-- error is recoverable by re-polling rather than by a column.
--
-- close_price is the venue's own last price for the bucket where the response carries one (binance,
-- gate, bitget), and NULL where it does not (okx). The page draws price from the markets that have
-- it, never a zero.
CREATE TABLE IF NOT EXISTS taker_flow (
  venue_id text NOT NULL REFERENCES venues (id),
  venue_symbol text NOT NULL,
  -- Start of the 5-minute bucket, UTC. Adapters normalise to the START whatever the venue stamps.
  bucket_start timestamptz NOT NULL,
  buy_usd double precision NOT NULL CHECK (buy_usd >= 0),
  sell_usd double precision NOT NULL CHECK (sell_usd >= 0),
  close_price double precision,
  PRIMARY KEY (venue_id, venue_symbol, bucket_start)
);

SELECT create_hypertable('taker_flow', by_range('bucket_start', INTERVAL '7 days'), if_not_exists => TRUE);

-- The page reads every polled market over a window, so time leads here; per-market reads use the key.
CREATE INDEX IF NOT EXISTS taker_flow_bucket ON taker_flow (bucket_start DESC);

-- 35 days: the page's longest window is 7, binance keeps 30 days of klines at this grain, and a
-- little margin lets a later analysis compare one week with the month behind it.
SELECT add_retention_policy('taker_flow', INTERVAL '35 days', if_not_exists => TRUE);
