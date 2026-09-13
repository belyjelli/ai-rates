-- Phase 5 / symbol identity refactor, Layer 3: verify by price that a market is the asset it says.
--
-- Migration 005 made the screener DROP legs sitting more than 5% from their asset's median mark.
-- That guard works, and it is invisible: a mismatched market simply stops appearing. It is exactly
-- how `CAT` (a memecoin and Caterpillar, 387,440,758x apart) went unnoticed. This table is the
-- other half -- the same question asked out loud, with the evidence attached, so a collision is an
-- alarm on /status rather than a quietly absent row.
--
-- It CHECKS identity and never changes it. Nothing here filters a query, sets a multiplier, or
-- merges a pool; the refactor plan's "no automatic price-based merging" applies in full, and a
-- price-derived multiplier is exactly that. Every entry in ALIASES was added by hand with recorded
-- evidence, and anything this table proposes is decided the same way.
--
-- ---------------------------------------------------------------------------------------------
-- PRE-REGISTERED DEFINITION. Measured 2026-09-14 over 6h of minute bars: 899 multi-venue pools,
-- 29 diverging markets. Stated before use, as migration 009 does, because a metric fitted after
-- the fact proves only that it was fitted.
--
--   anchor       = the pool member with the greatest open interest
--   price_ratio  = member mark / anchor mark            (both already per unit of base)
--   return_corr  = corr of minute log-returns, member against anchor
--   verdict      = scale | tracks | mismatch | unverified
--
-- WHY THE ANCHOR IS THE DEEPEST MARKET AND NOT THE MEDIAN. The median names the biggest CLUSTER as
-- correct, and the biggest cluster is not the truest one. PURR splits three venues at ~11.4
-- (gate, okx, bybit; $0.91M of open interest between them) against two at ~0.109 (hyperliquid and
-- mexc, $11.15M). A median hands the verdict to the three thin venues and reports Hyperliquid's
-- own token -- the deepest market in the pool -- as the outlier. Open interest is the tiebreak
-- that gets this right, and it is the figure a trader would use to decide the same question.
--
-- WHY CORRELATION DECIDES AND THE RATIO ONLY REFINES. The refactor plan originally specified
-- "near 10x/100x/1000x -> scale variance -> set multiplier". Measured, that rule is WRONG and
-- dangerous, because landing near a power of ten is a coincidence:
--
--   member            ratio        corr     what it really is
--   gate PURR         104.65       0.005    a different asset, 2% off 100x
--   bybit BB          0.00105      0.030    BlackBerry vs BounceBit, 5% off 1/1000
--   aster MEME        93.64       -0.002    a different asset
--   okx ANTHROPIC     0.10164      0.855    a genuine 10x contract
--   hl-mkts US500     0.09988      0.842    a genuine 10x contract
--   okx OPENAI        0.10257      0.823    a genuine 10x contract
--
-- Three markets scored 0.823-0.855; the highest of the other 26 was 0.183, and nothing has been
-- observed in between. Applying the ratio rule would have set a 1000x multiplier on BB and merged
-- BlackBerry into BounceBit -- the precise failure the refactor exists to prevent. So a clean
-- power of ten is necessary but never sufficient, and correlation is tested first.
--
-- WHY THE EVIDENCE FLOOR COUNTS MOVES, NOT VOLATILITY. A quiet market still correlates: hl-mkts'
-- US500 anchor had a return sd of 0.000073, second-lowest in the sample, and still scored 0.842
-- because both sides moved on 226 and 263 of 358 bars. A volatility floor would have discarded it.
-- The case that genuinely cannot be judged is lighter's BYD, whose mark did not move ONCE in six
-- hours: its correlation is null rather than low, and it is reported `unverified`, not alarmed.
-- Crying wolf on a thin market is how a report stops being read.
--
-- A COLLISION DOES NOT HAVE TO BE LARGE. okx/hl-xyz/lighter quote QNT at ~48.7 while four venues
-- quote ~64.7 -- just 1.32x, far too small to notice by eye and far too large to be a basis. Its
-- anchor moved on 280 of 358 bars (more than US500's), so 0.183 is a real answer. Magnitude was
-- never the signal.
--
-- LIMITS, STATED. `unverified` is a real outcome and will be common on thin markets. Reciprocal
-- quotes are NOT detected: mexc's JPY_USDT is 1/153.56 against hl-xyz's JPY and should show a
-- correlation near -1, but the two markets trade too far apart in time to show it (55 anchor moves
-- against 281) and it lands in `mismatch`. That verdict is still right -- never pair them -- but
-- the reason in the report will be wrong, so the ratio and both symbols are stored for a reader.
-- ---------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS market_identity_checks (
  checked_at timestamptz NOT NULL,
  base text NOT NULL,
  venue_id text NOT NULL REFERENCES venues (id),
  venue_symbol text NOT NULL,
  -- Stored, not joined: which market anchored the pool is part of reading the verdict, and the
  -- anchor can change between runs as open interest moves.
  anchor_venue_id text NOT NULL REFERENCES venues (id),
  anchor_venue_symbol text NOT NULL,
  verdict text NOT NULL CHECK (verdict IN ('scale', 'tracks', 'mismatch', 'unverified')),
  price_ratio double precision NOT NULL,
  -- n where price_ratio is about 10^n. NULL unless the verdict is 'scale', so nothing can read a
  -- proposed multiplier off a row whose correlation never supported one.
  scale_exponent integer,
  -- NULL when either side never moved. That is a distinct state from a low correlation and the
  -- two must not collapse into each other.
  return_corr double precision,
  ratio_sd double precision,
  shared_minutes integer NOT NULL,
  member_moves integer NOT NULL,
  anchor_moves integer NOT NULL,
  -- The figures behind the anchor choice, so the page can show why this market was the reference.
  member_oi_usd double precision,
  anchor_oi_usd double precision,
  PRIMARY KEY (venue_id, venue_symbol)
);

-- The page reads every row and there are tens of them (29 at the time of writing, against 899
-- pools), so the primary key is the only index this needs. Say so rather than adding one by habit.
