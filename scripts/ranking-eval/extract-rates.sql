-- Read-only. The settled-funding fold for every leg any variant held, over both windows' held days.
-- plans/ranking-evaluation-preregistration.md §3 fixes these dates; do not edit them to peek earlier.
\set QUIET on
COPY (
  WITH legs AS (
    SELECT long_venue_id AS venue_id, long_symbol AS venue_symbol FROM market_pair_candidates
    WHERE run_day BETWEEN DATE '2026-09-14' AND DATE '2026-09-27'
      AND (chosen_widest OR chosen_settled OR chosen_shrunk OR chosen_hysteresis OR chosen_capacity)
    UNION
    SELECT short_venue_id, short_symbol FROM market_pair_candidates
    WHERE run_day BETWEEN DATE '2026-09-14' AND DATE '2026-09-27'
      AND (chosen_widest OR chosen_settled OR chosen_shrunk OR chosen_hysteresis OR chosen_capacity)
  )
  SELECT d.venue_id, d.venue_symbol, d.day, d.rate_sum
  FROM market_funding_daily d
  JOIN legs l ON l.venue_id = d.venue_id AND l.venue_symbol = d.venue_symbol
  WHERE d.day BETWEEN DATE '2026-09-15' AND DATE '2026-09-28'
  ORDER BY d.venue_id, d.venue_symbol, d.day
) TO STDOUT WITH (FORMAT csv, HEADER);
