-- Read-only. Every row any pre-registered variant selected, for both windows' run days.
-- plans/ranking-evaluation-preregistration.md §3 fixes these dates; do not edit them to peek earlier.
\set QUIET on
COPY (
  SELECT run_day, asset_class, asset, long_venue_id, long_symbol, short_venue_id, short_symbol,
         deployable_usd, chosen_widest, chosen_settled, chosen_shrunk, chosen_hysteresis, chosen_capacity
  FROM market_pair_candidates
  WHERE run_day BETWEEN DATE '2026-09-14' AND DATE '2026-09-27'
    AND (chosen_widest OR chosen_settled OR chosen_shrunk OR chosen_hysteresis OR chosen_capacity)
  ORDER BY run_day, asset_class, asset, long_venue_id, long_symbol, short_venue_id, short_symbol
) TO STDOUT WITH (FORMAT csv, HEADER);
