-- Phase 2 data quality: store prices per unit of the base asset, not per contract.
--
-- Venues quote scaled contracts (1000PEPE, kPEPE, 10000CAT) and the symbol parser already folds that
-- into `multiplier` while canonicalising `base`. Prices were stored exactly as the venue quoted them,
-- so the same asset appeared at two scales: on 2026-09-12 PEPE marked 0.00000327 on the eight
-- multiplier-1 venues and 0.00327 on the six 1000x venues, and CAT spanned multipliers 1, 1000 and
-- 10000. Funding rates are fractions, so the screener was unaffected — but displayed marks were wrong
-- by up to 1000x, and cross-venue price comparison (Phase 4) is impossible while the scales differ.
--
-- Collector code divides by the multiplier from this point on; this backfills what is already stored.
-- Open interest is untouched: adapters derive open_interest_usd from the venue's raw price and
-- contract size before the snapshot is built, so those figures were always correct.

UPDATE funding_snapshots s
SET mark_price = s.mark_price / m.multiplier,
    index_price = s.index_price / m.multiplier
FROM markets m
WHERE m.venue_id = s.venue_id
  AND m.venue_symbol = s.venue_symbol
  AND m.multiplier <> 1
  AND (s.mark_price IS NOT NULL OR s.index_price IS NOT NULL);

UPDATE funding_events e
SET mark_price = e.mark_price / m.multiplier
FROM markets m
WHERE m.venue_id = e.venue_id
  AND m.venue_symbol = e.venue_symbol
  AND m.multiplier <> 1
  AND e.mark_price IS NOT NULL;

UPDATE market_latest l
SET mark_price = l.mark_price / m.multiplier,
    index_price = l.index_price / m.multiplier
FROM markets m
WHERE m.venue_id = l.venue_id
  AND m.venue_symbol = l.venue_symbol
  AND m.multiplier <> 1
  AND (l.mark_price IS NOT NULL OR l.index_price IS NOT NULL);
