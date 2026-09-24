# L3 — do liquidations move predicted funding?

The specification is `plans/phase4-l3-preregistration.md`, and it was committed **before** this code
was ever run. Read it first. If something here is not in that document, it is a bug rather than a
refinement.

## Running it

Extraction is deliberately separate from estimation, so the query cannot quietly become the analysis.

```sh
# 1. Extract. No host, user or password lives in this repo -- the connection comes from the
#    environment, following deploy/hklab/README.md, because this repository is public.
psql "$DATABASE_URL" -f py/l3/extract.sql > /tmp/l3-events.csv

# 2. Estimate.
python3 py/l3/analyse.py /tmp/l3-events.csv
```

`DATABASE_URL` reaches the database through the SSH tunnel documented in `.env.test.local`
(`-L 55437:127.0.0.1:5437`). Note that hklab runs **two** Postgres containers — `timescaledb_container`
publishes 5437 and is ours; a separate `postgres_container` publishes 5432 and is not.

Requires `numpy`, `pandas`, `scipy`. Not `statsmodels`: the estimator is a bootstrap over markets,
not a regression, because 1.5 days of 60-second observations are autocorrelated enough that OLS
standard errors would claim more precision than the data holds.

## What the output means

One row per side. `DiD` is the mean over markets of the mean within-event difference-in-differences,
in APR percentage points of *predicted* funding — never funding actually paid.

- **`95% CI`** — bootstrap over markets, 10,000 resamples, fixed seed so it is reproducible rather
  than shopped for. An interval spanning zero is a null, and a null is a publishable result here.
- **`leave-1-out`** — the same estimate with the largest market removed. One market holds ~29% of
  all events; if the sign flips, the finding is that market's, not the market's.
- **`pre`** — mean pre-window change. If this is already directional, the event is not what moved
  the rate and the DiD is contaminated.
- **`zero%`** — share of events whose post-window change is exactly zero. Around 40% is expected:
  the predicted rate genuinely does not move in many markets, which is why the median is useless
  and the mean is the reported statistic.

The script prints `NULL`, `FALSIFIED` and `FRAGILE` lines by applying section 6's criteria
mechanically, so the conclusion is not left to whoever reads the table.
