# Ranking evaluation

Runs the evaluation fixed in `plans/ranking-evaluation-preregistration.md`. **Do not run it before
2026-09-29 06:00Z.** The runner refuses to start before then, and the extracts must not be taken early
either: looking at partial windows is what the pre-registration exists to prevent.

## 1. Extract, read-only, from hklab

From the repository root, with `deploy/hklab/.env.deploy` in place:

```sh
set -a && . deploy/hklab/.env.deploy && set +a
PSQL="docker exec -i timescaledb_container sh -c 'psql -U \"\$POSTGRES_USER\" -d vaultdeck -q'"
ssh -p "$AIRATES_DEPLOY_SSH_PORT" "$AIRATES_DEPLOY_USER@$AIRATES_DEPLOY_HOST" "$PSQL" < scripts/ranking-eval/extract-picks.sql > picks.csv
ssh -p "$AIRATES_DEPLOY_SSH_PORT" "$AIRATES_DEPLOY_USER@$AIRATES_DEPLOY_HOST" "$PSQL" < scripts/ranking-eval/extract-rates.sql > rates.csv
```

Both queries only `SELECT`, and their dates are the pre-registered ones.

## 2. Evaluate

```sh
bun scripts/ranking-eval/evaluate.ts picks.csv rates.csv
```

It prints both windows' figures for every variant, then the decision.

An error beginning `window invalid` means a §5 condition was hit, such as a missed nightly run. Do not
work around it. Record the substitute window in the pre-registration's §9 first, then evaluate that
window.

## 3. Record the result

Add the output, the extract date and the commit to the pre-registration's §9, whatever the result,
including "no variant is eligible".
