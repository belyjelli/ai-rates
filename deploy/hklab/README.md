# hklab Postgres: what ai-rates needs to know

This repo is the Cloudflare Worker frontend only. **The collector — the service that writes to this
database — moved to `belyjelli/profitlock-worker` (`collector/`) on 2026-09-24.** Its deploy, its
`docker exec` operations, its own commands (`collector status`, `collector doctor`, ...), and the full
TLS/background-jobs ops history now live in that repo's `collector/README.md`.

What's still here is what ai-rates itself needs: reaching the same database for local dev and for this
repo's own integration tests.

Credentials never go in the repo: locally in a password manager, on the server in
`~/collector-app/deploy/.env` (mode 600, in the collector repo's deploy target now).

**The deploy target is not in this repository.** It is public, so the host, SSH user, SSH port,
Postgres port and database role live in `deploy/hklab/.env.deploy` (gitignored; copy
`.env.deploy.example` and fill it in). Source it once per shell:

```sh
set -a && . ./deploy/hklab/.env.deploy && set +a
```

> **`$AIRATES_DEPLOY_HOST:$AIRATES_PG_PORT` exposes this Postgres instance to the internet.** TLS is
> enabled but not enforced, so outside clients must connect with `sslmode=verify-full` and
> `deploy/hklab/postgres-ca.crt`. Renewal and the full TLS setup are documented in
> profitlock-worker's `collector/README.md`; the CA certificate here is a copy of the same one, valid
> to 2036-09-08.

## Public site (Cloudflare Worker)

The Worker `airrates` (https://www.airrates.net) deploys from this repo's `main` through Cloudflare
Workers Builds.

- **How it reads data:** through Hyperdrive config `airates-vaultdeck`, binding `HYPERDRIVE` in
  `wrangler.jsonc`.
- **What it reads:** only the read models the collector maintains: `market_latest`,
  `market_funding_stats` and `screener_pairs()`.
- **If the collector stops:** markets go stale after five minutes. Pages then show empty states, and
  `/v1/health` returns 503.

Run it locally against the real database through the SSH tunnel:

```sh
ssh -f -N -L 55437:127.0.0.1:5437 -p $AIRATES_DEPLOY_SSH_PORT $AIRATES_DEPLOY_USER@$AIRATES_DEPLOY_HOST
set -a && . ./.env.test.local && set +a
CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE="$DATABASE_URL" npx wrangler dev
```

## Integration tests

`apps/worker/src/app/*.int.test.ts` (including the `screener_pairs()` rules) add and delete their own
tagged rows, inside schema `airates_it` of `vaultdeck`, through the tunnel:

```sh
ssh -f -N -L 55437:127.0.0.1:5437 -p $AIRATES_DEPLOY_SSH_PORT $AIRATES_DEPLOY_USER@$AIRATES_DEPLOY_HOST
bun --env-file=.env.test.local test apps/worker   # DATABASE_URL=postgres://$AIRATES_PG_ROLE:...@127.0.0.1:55437/vaultdeck
```

They add jobs to `vaultdeck`'s TimescaleDB scheduler too (their own hypertables under schema
`airates_it`, duplicating every production compression/retention policy while holding no rows). Safe
to drop if the instance's worker budget is tight — see profitlock-worker's `collector/README.md` for
the query and for the background-worker-limit history.

## packages/db

The migrations here (`packages/db/migrations`) are the schema ai-rates' own tests set up against. They
are **also copied** into profitlock-worker's `collector/schema/migrations`, which is what the running
collector actually applies at boot. **A schema change needs both repos updated** — there is no
automated sync yet.
