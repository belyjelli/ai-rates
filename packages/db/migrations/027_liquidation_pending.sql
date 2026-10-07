-- Modeled pending liquidations by price, one row per asset, rewritten by the collector.
--
-- WHY A TABLE AND NOT A QUERY. The Sides chart shows how much of an asset's open interest would be
-- force-closed if the price moved 1%, 2% ... 10% either way. No venue reports that: it is a model
-- over open interest (collector/internal/store/pending.go, which states every assumption). The first
-- version computed it in the Worker on each page render, which put a join of `liquidations` against
-- `market_latest` into a request path that shares a small pool. Preparing data is the collector's
-- job; the page reads one row.
--
-- long_usd[i] / short_usd[i] are the dollars in the (i)-(i+1)% row below / above the mark, i = 0..9.
-- Prices are not stored: the page bands them off its own anchor mark, so a row means the same price
-- on this chart as on the grids beside it.
--
-- Replaced wholesale each run, in one transaction. computed_at lets the page refuse a row older than
-- a few cycles rather than draw a stale model as current.
CREATE TABLE IF NOT EXISTS liquidation_pending (
  asset_class text NOT NULL
    CONSTRAINT liquidation_pending_asset_class_check
    CHECK (asset_class IN ('crypto', 'equity', 'commodity', 'fx', 'index')),
  base text NOT NULL,
  computed_at timestamptz NOT NULL,
  -- Fresh open interest on the venues whose liquidation feed reported this asset in the last day,
  -- which is what the closed bars beside the strip cover. Not the whole market.
  open_interest_usd double precision NOT NULL,
  venues integer NOT NULL,
  long_usd double precision[] NOT NULL,
  short_usd double precision[] NOT NULL,
  PRIMARY KEY (asset_class, base)
);
