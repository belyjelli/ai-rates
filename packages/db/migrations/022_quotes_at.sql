-- Phase 6 / W1: when the book was seen, as distinct from when the funding rate was.
--
-- market_latest has had exactly one timestamp since 002. Migration 013 added best_bid, best_ask and
-- their USD sizes to the same row and gave them no timestamp of their own, because at the time one
-- writer filled every column in one cycle and a second timestamp would have been a copy of the
-- first. Phase 6 adds a second writer -- a WebSocket feed pushing quotes at up to 10ms granularity
-- while the funding poll continues at 60s -- and the single timestamp stops being able to tell the
-- truth about both.
--
-- THE BIND, which has no acceptable side and is why this column is forced rather than convenient.
-- arbitrage() (apps/worker/src/app/data.ts) gates its candidates AND its anchors on
-- `observed_at > now() - 5 minutes`:
--
--   * If the feed does NOT touch observed_at, a venue whose funding poll dies takes its still-live
--     streamed quotes off /arbitrage with it. The page would hide a book it is actively receiving.
--   * If the feed DOES touch observed_at, a quote silently resurrects a dead venue's funding row:
--     the rate, APR and next settlement on that row keep reading as fresh while nothing has fetched
--     them for hours, and the stale-venue alerting added after the last silent outage never fires.
--
-- So the row carries two timestamps and the reader splits: mark, rate, APR, open interest and
-- identity keep reading observed_at; the four quote columns read quotes_at. A row may then be fresh
-- in one sense and stale in the other. That is not an inconsistency to paper over -- it is the
-- accurate description of a market whose book is streaming and whose funding poll has stopped, and
-- any view that renders such a row must show which half is old.
--
-- NULLABLE, AND NULL MEANS SOMETHING. A venue that publishes no book keeps a null quotes_at
-- forever, exactly as it keeps a null best_bid. Ten venues publish top of book and 46 do not; null
-- is the normal state here, not a gap waiting to be filled.
--
-- THE BACKFILL IS NOT OPTIONAL. Measured 2026-09-17: gate 977, bybit 833, okx 483 -- plus bingx
-- 1026, bitget 836, toobit 760, pionex 562, htx 341, grvt 186 and sodex 91 -- carry a fresh book
-- right now, and all ten arrive over REST. The moment the worker starts gating bid/ask on quotes_at,
-- every one of those rows reads as "no quote" until its venue's next cycle writes the new column.
-- That is a self-inflicted outage of up to a full collection interval across the whole arbitrage
-- page, avoidable in one UPDATE, so: one UPDATE. Rows with no book stay null.
ALTER TABLE market_latest ADD COLUMN IF NOT EXISTS quotes_at timestamptz;

UPDATE market_latest
SET quotes_at = observed_at
WHERE quotes_at IS NULL
  AND (best_bid IS NOT NULL OR best_ask IS NOT NULL);

-- NO INDEX, deliberately. market_latest is one row per live market -- 15,427 on 2026-09-17, a few
-- megabytes -- and every query that will read this column already scans the whole table to group by
-- asset. An index here would be maintained on every one of the ~5,300 upserts a cycle and read by
-- nothing. 002 indexes only `base`, for the same reason.
