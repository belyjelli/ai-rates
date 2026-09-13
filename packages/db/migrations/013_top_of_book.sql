-- Phase 4 Track B: best bid and ask on the latest row, for the price-spread view.
--
-- These arrive nearly free. gate (`highest_bid`/`lowest_ask`) and bybit (`bid1Price`/`ask1Price`)
-- publish top of book on ticker endpoints the adapters already call every cycle; okx publishes it
-- on its tickers call too, and costs one extra BULK request per cycle for `/public/instruments`
-- (479 rows) to turn contract sizes into money. The other seven venues never report it.
--
-- Sizes are stored beside the prices, not as an afterthought. Level 1 gives a spread quotable only
-- at the size shown: `ONE` measured a 269.6 bps gap whose OKX side was an ask of TWO units against
-- 220,004 on Gate. A spread column without a size column next to it is a number that invites a
-- loss, so the two always travel together and any view must render both.
--
-- Depth is USD because the three venues disagree on what a size is -- gate quotes contracts
-- (x quanto_multiplier), okx quotes contracts against ctVal with 15 inverse USD-denominated swaps,
-- bybit quotes base coin. Their raw numbers for one BTC book read 2776, 504.48 and 0.181 for
-- depths of roughly $21.6k, $392k and $14k: comparing them as printed is a 10,000x error, the same
-- class as the inverse-contract bug and KR200's 1375x mark mismatch. Each adapter converts where
-- it already holds the multiplier, matching open_interest_usd and liquidations.notional_usd.
--
-- Prices are per unit of base, matching mark_price and index_price -- the collector puts them
-- through the same `perUnitPrice` rescale. The USD sizes are already money and are never rescaled.
--
-- Nullable throughout: a market with no published book keeps NULL, which must render as "no quote"
-- and never as a zero bid.
ALTER TABLE market_latest
  ADD COLUMN IF NOT EXISTS best_bid double precision,
  ADD COLUMN IF NOT EXISTS best_bid_size_usd double precision,
  ADD COLUMN IF NOT EXISTS best_ask double precision,
  ADD COLUMN IF NOT EXISTS best_ask_size_usd double precision;
