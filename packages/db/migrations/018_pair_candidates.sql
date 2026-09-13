-- Ranking sprint 0: store every candidate pair, not just the winner.
--
-- This table displays nothing and changes nothing a reader sees. It exists so that the ranking
-- variants in plans/ranking-system-design.md can be COMPARED at all, which today they cannot be.
--
-- WHY IT IS NEEDED. market_pair_backtests is keyed (run_day, asset_class, asset) and therefore
-- stores only the pair that won for each asset on each night. The counterfactual -- what the other
-- candidates would have paid, and what the pair we held would have paid had we kept it -- is not
-- recoverable from it at any price. So no proposed ranking can be measured against the shipped one
-- using data we already have, however long we wait. That is not an argument for guessing; it is the
-- reason the work is staged, and this table is stage zero.
--
-- WHAT IT IS FOR. Measured 2026-09-13: the shipped ranking selects each asset's WIDEST spread
-- (DISTINCT ON ... ORDER BY spread DESC), which selects outliers by construction, and the
-- recommended venue pair then changes for 71% of assets overnight -- 371 of 524 assets present in
-- two consecutive runs. At ~$20 per $10k round trip (four fills: open and close, both legs) that is
-- 0.71 x 52 x $20 = $738 per $10k per year, or 7.4% of capital against a 15.6% size-weighted gross.
-- The ranking would destroy roughly half the return it advertises. Whether a no-trade band fixes
-- that is an empirical question, and this is the instrument that answers it.
--
-- ---------------------------------------------------------------------------------------------
-- PRE-REGISTERED VARIANTS. Named before any of them was compared, so the evaluation is a test
-- rather than a search. One boolean per variant, recording which pair that variant SELECTED for
-- that asset on that night:
--
--   chosen_widest      A -- today's behaviour: the widest instantaneous spread. The control.
--   chosen_settled     B -- the widest settled 7-day spread instead of the live one.
--   chosen_shrunk      C -- B's evidence, shrunk toward the pool median (k = 10, migration 009's
--                           precedent), scored net of nothing: entry fees are paid once whichever
--                           candidate is chosen, so they cannot separate candidates.
--   chosen_hysteresis  D -- C plus a no-trade band: switch only when the challenger beats the
--                           incumbent by more than the round trip costs over the holding period.
--   chosen_capacity    E -- D ranked by deployable dollars per week rather than by rate.
--
-- Every variant is computed by packages/core/src/ranking.ts, the same pure functions the eventual
-- job uses. SQL gathers evidence; the engine decides. There is no second implementation here.
--
-- WHY ONE ROW PER CANDIDATE RATHER THAN PER ASSET. To score a variant you need what it did NOT
-- pick. A table of winners can only ever tell you what happened, never what would have. The primary
-- key is therefore the whole pair, and an asset contributes as many rows as it has candidate
-- venue pairings that survive the anchor gate.
--
-- WHY was_incumbent AND switch_cost_usd ARE STORED RATHER THAN DERIVED. Hysteresis is
-- path-dependent: variant D's selection on any night depends on what D selected the night before,
-- which in turn depends on the night before that. It cannot be reconstructed after the fact from
-- evidence alone, so the chain has to be recorded as it happens or it is lost.
--
-- WHY BOOLEAN COLUMNS RATHER THAN ONE text[] OF VARIANT NAMES. The worker runs behind Hyperdrive
-- with fetch_types: false, and this repository has already shipped a broken query because an array
-- parameter was serialised as the bare string "a,b" without type introspection (see the header of
-- apps/worker/src/app/data.int.test.ts). Five explicit booleans cannot be got wrong that way, are
-- indexable, and say what they mean when someone reads a row by hand.
--
-- NAMING. plans/ranking-system-design.md called this market_pair_ranked and described it as "one
-- row per asset per run", which conflated two grains: the same section also requires every
-- candidate to be retained. It holds candidates, so it is named for candidates; the plan is
-- corrected in the same commit.
-- ---------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS market_pair_candidates (
  run_day date NOT NULL,
  -- An asset is (asset_class, base) since migration 017. Enumerating on base alone would make
  -- equity BB and crypto BB candidates against each other, which is the collision 017 ended.
  asset_class text NOT NULL
    CONSTRAINT market_pair_candidates_asset_class_check
    CHECK (asset_class IN ('crypto', 'equity', 'commodity', 'fx', 'index')),
  asset text NOT NULL,
  long_venue_id text NOT NULL REFERENCES venues (id),
  long_symbol text NOT NULL,
  short_venue_id text NOT NULL REFERENCES venues (id),
  short_symbol text NOT NULL,

  -- The evidence, as gathered. Kept beside the score so a later reader can re-derive the score
  -- rather than trust it, and so a change to the scoring function can be replayed over history.
  rate_per_week double precision NOT NULL,
  charge_days integer NOT NULL,
  thinner_leg_oi_usd double precision,

  -- Derived by packages/core/src/ranking.ts at write time.
  score double precision NOT NULL,
  deployable_usd double precision NOT NULL,
  expected_weekly_usd double precision NOT NULL,

  -- Which variant selected this pair for this asset on this night. Exactly one row per asset per
  -- run should carry each flag; more than one is a bug in the writer, not a tie.
  chosen_widest boolean NOT NULL DEFAULT false,
  chosen_settled boolean NOT NULL DEFAULT false,
  chosen_shrunk boolean NOT NULL DEFAULT false,
  chosen_hysteresis boolean NOT NULL DEFAULT false,
  chosen_capacity boolean NOT NULL DEFAULT false,

  -- The hysteresis chain, which cannot be rebuilt afterwards.
  was_incumbent boolean NOT NULL DEFAULT false,
  -- What switching to this pair would have cost, at the fee tier the run assumed. Null where no
  -- switch was contemplated, which is not the same as a switch that was free.
  switch_cost_usd double precision,

  PRIMARY KEY (run_day, asset_class, asset, long_venue_id, long_symbol, short_venue_id, short_symbol)
);

-- No secondary index. The evaluation reads whole nights and whole assets, and the primary key
-- already leads with (run_day, asset_class, asset), so that prefix serves both. Saying so here
-- rather than adding one by habit, since this table writes far more rows than it reads.

-- RETENTION IS THE WRITER'S JOB, NOT THIS FILE'S. A first draft of this migration ended with a
-- DELETE of rows older than thirty days, which would have been worse than useless: a migration runs
-- exactly once, is recorded in schema_migrations and never re-applied, so that statement would have
-- deleted nothing from a table created four lines above it and then never run again -- leaving a
-- file that reads as though retention were handled when nothing was pruning anything.
--
-- refreshRankedPairs prunes on each run instead, exactly as refreshPairBacktests does, to thirty
-- days. Two non-overlapping 7-day windows are the minimum the evaluation needs and four are
-- preferred, so a month is comfortably enough while keeping a table that grows by every candidate
-- rather than by every winner from running away.
