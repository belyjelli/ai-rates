-- L3 feature extraction: one row per liquidation event, with the three snapshot boundaries the
-- pre-registered difference-in-differences needs.
--
-- Specification: plans/phase4-l3-preregistration.md. This file implements §3 and nothing else; all
-- estimation lives in analyse.py, so the extraction cannot quietly become the analysis.
--
-- Emits CSV on stdout. No hostname, user or password appears here: connection details come from the
-- environment, following deploy/hklab/deploy.sh, because this repository is public.

-- Server-side COPY, not psql's \copy: a meta-command must fit on one line, and this query does not.
COPY (

WITH
-- Market liveness (§3): a market whose predicted rate never changes cannot express an outcome.
-- Measured over the same 6h window the pre-registration quotes.
changes AS (
  SELECT venue_id, venue_symbol,
         count(*) FILTER (WHERE prev IS NOT NULL AND rate <> prev) AS rate_changes
  FROM (
    SELECT venue_id, venue_symbol, rate,
           lag(rate) OVER (PARTITION BY venue_id, venue_symbol ORDER BY observed_at) AS prev
    FROM funding_snapshots
    WHERE observed_at > now() - interval '6 hours'
  ) s
  GROUP BY 1, 2
),
live AS (SELECT venue_id, venue_symbol FROM changes WHERE rate_changes >= 6),

-- Events collapsed to the minute (§3). Side is the side holding the larger summed notional; ties
-- are dropped rather than broken arbitrarily, because an arbitrary rule would be an unregistered
-- choice that could shift the sample.
per_minute AS (
  SELECT l.venue_id, l.venue_symbol,
         date_trunc('minute', l.liquidated_at) AS t,
         sum(l.notional_usd) FILTER (WHERE l.side = 'long')  AS long_usd,
         sum(l.notional_usd) FILTER (WHERE l.side = 'short') AS short_usd,
         count(*) AS rows_collapsed
  FROM liquidations l
  JOIN live v ON v.venue_id = l.venue_id AND v.venue_symbol = l.venue_symbol
  -- §2: events within 30 minutes of the series end have no post-window.
  WHERE l.liquidated_at <= (SELECT max(observed_at) - interval '30 minutes' FROM funding_snapshots)
  GROUP BY 1, 2, 3
),
events AS (
  SELECT venue_id, venue_symbol, t, rows_collapsed,
         CASE WHEN coalesce(long_usd, 0) > coalesce(short_usd, 0) THEN 'long' ELSE 'short' END AS side,
         coalesce(long_usd, 0) + coalesce(short_usd, 0) AS notional_usd
  FROM per_minute
  -- Ties dropped, including the both-null case where neither side has a known notional.
  WHERE coalesce(long_usd, 0) <> coalesce(short_usd, 0)
)

SELECT e.venue_id, e.venue_symbol, e.t, e.side, e.notional_usd, e.rows_collapsed,
       pre.apr  AS apr_pre,  at0.apr  AS apr_0,  post.apr  AS apr_post,
       pre.mark AS mark_pre, at0.mark AS mark_0, post.mark AS mark_post
FROM events e
-- The nearest snapshot at or before each boundary (§3).
CROSS JOIN LATERAL (
  SELECT s.rate / nullif(s.basis_hours, 0) * 876000 AS apr, s.mark_price AS mark
  FROM funding_snapshots s
  WHERE s.venue_id = e.venue_id AND s.venue_symbol = e.venue_symbol
    AND s.observed_at <= e.t - interval '30 minutes'
  ORDER BY s.observed_at DESC LIMIT 1
) pre
CROSS JOIN LATERAL (
  SELECT s.rate / nullif(s.basis_hours, 0) * 876000 AS apr, s.mark_price AS mark
  FROM funding_snapshots s
  WHERE s.venue_id = e.venue_id AND s.venue_symbol = e.venue_symbol
    AND s.observed_at <= e.t
  ORDER BY s.observed_at DESC LIMIT 1
) at0
CROSS JOIN LATERAL (
  SELECT s.rate / nullif(s.basis_hours, 0) * 876000 AS apr, s.mark_price AS mark
  FROM funding_snapshots s
  WHERE s.venue_id = e.venue_id AND s.venue_symbol = e.venue_symbol
    AND s.observed_at >= e.t + interval '30 minutes'
  ORDER BY s.observed_at ASC LIMIT 1
) post
WHERE pre.apr IS NOT NULL AND at0.apr IS NOT NULL AND post.apr IS NOT NULL

) TO STDOUT WITH (FORMAT csv, HEADER);
