-- The pending strip's zoomed-out view: half the mark to double it (migration 027 has the near view).
--
-- long_wide_usd[i] is the dollars of longs the model puts (5i)-(5i+5)% below the mark, i = 0..9, down
-- to -50%; short_wide_usd[i] the shorts (10i)-(10i+10)% above it, up to +100%. Different widths on
-- the two sides because the range is ½x to 2x: halving and doubling are the same move in ratio, not
-- in percent. Same positions as the near rows, binned wider; written by the same collector job.
--
-- Defaulted to empty so the rows already in the table stay valid until the job next replaces them;
-- the page treats an empty array as "no model" and draws nothing rather than zeros.
ALTER TABLE liquidation_pending
  ADD COLUMN IF NOT EXISTS long_wide_usd double precision[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS short_wide_usd double precision[] NOT NULL DEFAULT '{}';
