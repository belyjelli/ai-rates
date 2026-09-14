# Deploying the collector to hklab

Target: **hklab** (`ssh -p $AIRATES_DEPLOY_SSH_PORT $AIRATES_DEPLOY_USER@$AIRATES_DEPLOY_HOST`, host `epos`). The collector runs as the `airates-collector`
container on the `postgres_postgres` network. It writes to database **`vaultdeck`** as role **`$AIRATES_PG_ROLE`** in the existing
`timescaledb_container` (TimescaleDB 2.20.3 / PostgreSQL 17.5), over the internal Docker network.

Credentials never go in the repo: locally in `plans/access.md` (gitignored), on the server in
`~/airates-app/deploy/hklab/.env` (mode 600).

**The deploy target is not in this repository.** It is public, so the host, SSH user, SSH port,
Postgres port and database role live in `deploy/hklab/.env.deploy` (gitignored; copy
`.env.deploy.example` and fill it in). `deploy.sh` sources that file and refuses to run without it,
rather than falling back to a stale default. Every snippet below uses those variable names, so
source the file once per shell:

```sh
set -a && . ./deploy/hklab/.env.deploy && set +a
```

> **`$AIRATES_DEPLOY_HOST:$AIRATES_PG_PORT` exposes this Postgres instance to the internet.** TLS is enabled but not enforced (see
> [TLS](#tls)), so outside clients must connect with `sslmode=verify-full` and `deploy/hklab/postgres-ca.crt`.

## Current state (2026-09-12)

- **Database:** live on `vaultdeck`. On 2026-09-12 it was migrated from the earlier `airates` database, with identical
  row counts in all five tables.
- **Disk:** since 2026-09-12 `vaultdeck` lives in tablespace `airates_nvme` on the 466 GB NVMe
  (`/srv/airates-data/timescale-airates`, `/data/airates` inside the container). Steps 1–3 below are done; they stay
  here as a record and for rebuilding the server.

## Moving the data onto the NVMe

### 1. Mount the NVMe (sudo)

The partition already holds an ext4 filesystem. Inspect it read-only first, and **don't reformat it if it holds
anything worth keeping**.

```sh
sudo mkdir -p /mnt/nvme-inspect && sudo mount -o ro /dev/nvme0n1p1 /mnt/nvme-inspect
sudo ls -la /mnt/nvme-inspect && df -h /mnt/nvme-inspect
sudo umount /mnt/nvme-inspect

sudo mkdir -p /srv/airates-data
echo 'UUID=36be1152-0714-4bf4-aec3-c20b639b09c5 /srv/airates-data ext4 defaults,nofail 0 2' | sudo tee -a /etc/fstab
sudo systemctl daemon-reload && sudo mount /srv/airates-data
df -h /srv/airates-data

# Tablespace directory, owned by the container's postgres user (uid/gid 1000).
sudo mkdir -p /srv/airates-data/timescale-airates
sudo chown 1000:1000 /srv/airates-data/timescale-airates
sudo chmod 700 /srv/airates-data/timescale-airates
```

- `nofail` keeps the server booting if the disk is missing.
- The mount point is deliberately outside `/srv/filegator/data`, which the FileGator container serves, so database
  files never appear in its file browser.

### 2. Expose the directory to TimescaleDB (sudo)

Add one volume to the `timescaledb` service in `/srv/postgres/db_compose.yml`:

```yaml
    volumes:
      - /srv/postgres/timesc_data:/data/postgrestimesc   # existing
      - /srv/airates-data/timescale-airates:/data/airates   # new
```

Recreating the container briefly interrupts **every database on this instance**, so pick a quiet moment:

```sh
cd /srv/postgres && sudo docker compose -f db_compose.yml up -d timescaledb
docker exec timescaledb_container ls -ld /data/airates
```

### 3. Move `vaultdeck` (no sudo)

The collector is stopped while the files copy. Any other client connected to `vaultdeck` is disconnected.

```sh
docker compose -f ~/airates-app/deploy/hklab/compose.yml stop collector
docker exec -i timescaledb_container sh -c 'psql -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1' <<'SQL'
CREATE TABLESPACE airates_nvme OWNER $AIRATES_PG_ROLE LOCATION '/data/airates';
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'vaultdeck' AND pid <> pg_backend_pid();
ALTER DATABASE vaultdeck SET TABLESPACE airates_nvme;
SQL
docker compose -f ~/airates-app/deploy/hklab/compose.yml start collector
```

## TLS

Enabled 2026-09-12 so Cloudflare Hyperdrive (Phase 2) can reach the database over `$AIRATES_DEPLOY_HOST:$AIRATES_PG_PORT`.

- **Server:** `ssl = on` via `ALTER SYSTEM` (persisted in `postgresql.auto.conf`), applied with a reload, no restart.
  Certificate and key are at `/data/postgrestimesc/server.crt` and `server.key` inside `timescaledb_container`.
- **Server certificate:** SANs `$AIRATES_DEPLOY_HOST`, `timescaledb_container`, `localhost`, `127.0.0.1`. **Expires 2028-12-14.**
- **Private CA:**
  - Key and cert live on hklab in `~/.airates-pki/` (mode 700). Never copy `ca.key` off the server.
  - The public CA certificate is committed as `deploy/hklab/postgres-ca.crt`: SHA-256
    `70:85:FC:6C:EB:F4:FF:8C:DA:3D:DB:3C:ED:70:B0:9F:DA:22:DF:C4:F3:E6:20:81:9B:06:C5:EB:E8:09:D0:5B`, valid to 2036-09-08.
  - Uploaded to Cloudflare as `airates-hklab-postgres-ca` (ID `b5d9c603-1b6f-44f8-a6e7-0104680c3959`).
- **Hyperdrive:** config `airates-vaultdeck`, ID `7c04838b33a6423d8a195fafab6d101f`. It connects to
  `$AIRATES_DEPLOY_HOST:$AIRATES_PG_PORT/vaultdeck` as `$AIRATES_PG_ROLE` with `sslmode=verify-full` and the CA above, with an origin connection
  limit of 5. It isn't bound to a Worker yet (Phase 2).
- **Not enforced yet:**
  - `pg_hba.conf` still has `host all all all scram-sha-256`, so the other databases' clients keep working
    unencrypted.
  - To require TLS for outside connections, replace it with `hostssl all all all scram-sha-256`, keeping a `host`
    line for the Docker networks the collector uses. Agree it with the owners of the other databases first.

Check from any machine:

```sh
openssl s_client -starttls postgres -connect $AIRATES_DEPLOY_HOST:$AIRATES_PG_PORT -servername $AIRATES_DEPLOY_HOST \
  -CAfile deploy/hklab/postgres-ca.crt -verify_hostname $AIRATES_DEPLOY_HOST -verify_return_error </dev/null | grep "Verify return code"
```

Renew the server certificate before 2028-12-14 (on hklab). The CA stays the same, so Hyperdrive needs no change:

```sh
cd ~/.airates-pki
openssl req -new -newkey rsa:2048 -nodes -keyout server.key -out server.csr -subj "/CN=$AIRATES_DEPLOY_HOST"
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out server.crt -days 825 -sha256 -extfile server.ext
docker exec -i timescaledb_container sh -c 'cat > /data/postgrestimesc/server.crt' < server.crt
docker exec -i timescaledb_container sh -c 'umask 077 && cat > /data/postgrestimesc/server.key' < server.key
docker exec timescaledb_container sh -c 'chown postgres:postgres /data/postgrestimesc/server.crt /data/postgrestimesc/server.key && chmod 600 /data/postgrestimesc/server.key'
docker exec timescaledb_container sh -c 'psql -U "$POSTGRES_USER" -d postgres -c "SELECT pg_reload_conf()"'
```

## TimescaleDB background jobs

Compression and retention policies only run if TimescaleDB has a scheduler worker for the database. Each database
with the extension needs one, plus one launcher for the whole instance.

- **The problem:** until 2026-09-12 the instance allowed 16 workers for 17 TimescaleDB databases, so `vaultdeck` never
  got a scheduler and its policies had never run.
- **The fix:** raised to `timescaledb.max_background_workers = 24` and `max_worker_processes = 48` (`ALTER SYSTEM`,
  container restart).
- **Keep it in step:** if more databases on this instance install TimescaleDB, raise the limit again.
- **The integration tests add jobs too.** `migrate()` runs against schema `airates_it`, so that schema carries its own 3 hypertables and 4 policy jobs — compression on `funding_snapshots` and `funding_events`, retention on `funding_snapshots` and `collector_runs` — duplicating every production policy while holding no rows. They consume scheduler slots on an instance shared with 16 other databases, which is part of what exhausted the worker limit. They are safe to drop (`SELECT delete_job(<id>)` for the `airates_it` rows below) and the next test run will recreate them.

```sh
docker exec -i timescaledb_container sh -c 'psql -U "$POSTGRES_USER" -d vaultdeck' <<'SQL'
SELECT job_id, hypertable_schema, hypertable_name, proc_name
FROM timescaledb_information.jobs WHERE hypertable_schema = 'airates_it';
SQL
```

Check that `vaultdeck`'s jobs are actually scheduled and running:

```sh
docker exec -i timescaledb_container sh -c 'psql -U "$POSTGRES_USER" -d vaultdeck' <<'SQL'
SELECT count(*) AS schedulers FROM pg_stat_activity WHERE backend_type = 'TimescaleDB Background Worker Scheduler';
SELECT j.job_id, j.proc_name, j.hypertable_name, s.last_run_status, s.next_start
FROM timescaledb_information.jobs j JOIN timescaledb_information.job_stats s USING (job_id)
WHERE j.hypertable_schema = 'public';
SQL
```

## Server environment

`~/airates-app/deploy/hklab/.env` (created once, preserved by every deploy):

```sh
DATABASE_URL=postgres://$AIRATES_PG_ROLE:<password>@timescaledb_container:5432/vaultdeck
COLLECT_INTERVAL_MS=60000
# Optional: Slack- or Discord-style incoming webhook for stale-venue alerts. Without it the
# collector logs "stale venue alerts disabled" and never posts anywhere.
ALERT_WEBHOOK_URL=https://hooks.slack.com/services/...
```

A venue is stale once it hasn't collected successfully for three intervals. The alerter posts when
venues newly go stale and again when every venue is healthy, not on every check, so a partial outage
is a couple of messages rather than one a minute.

## Deploy

From the repository root on a machine with SSH access:

```sh
./deploy/hklab/deploy.sh
```

The script streams the source, builds the image on the server, runs `docker compose up -d --build`, and waits for
`http://127.0.0.1:20090/health`. Migrations run automatically when the collector starts.

## Operations (on hklab)

```sh
docker logs -f airates-collector-go                    # collector logs
curl -s http://127.0.0.1:20090/health                  # per-venue freshness
docker compose -f ~/airates-app/deploy/hklab/compose.yml restart collector-go
docker exec timescaledb_container sh -c 'psql -U "$POSTGRES_USER" -d vaultdeck -c "\dt+"'
```

**The collector is `collector-go` as of 2026-09-15.** The Bun collector (`airates-collector`) is
deprecated and profile-gated, so an ordinary `docker compose up -d` no longer starts it.

**What it runs.** On boot it applies `packages/db/migrations` (the same `schema_migrations` table the Bun
runner used) and upserts every venue from `packages/venues/catalog.json`. Beside the 56 snapshot loops:

- per venue, where the adapter supports it: the history sweep and backfill (49 venues), leverage tiers
  (17) and liquidations (2);
- fleet-wide: funding stats every 10 minutes; the daily and hourly folds, 30/60-day windows and
  stability hourly; identity checks hourly; verified pair backtests and ranked pair candidates nightly,
  first run one hour after boot;
- stale-venue alerts to `ALERT_WEBHOOK_URL` in `.env`, when it is set.

**The first cutover build ran snapshot loops only.** None of the list above ran until the
`go-jobs-port` build, so the site's derived figures (settled averages, stability, verified pairs,
identity checks) were frozen at the last Bun boot. If those look stale, check which build is running
before anything else.

`/v1/latest` is **gone**: the Bun collector served `/health` and `/v1/latest`, the Go one serves
`/health` only. Nothing consumed it — the Worker reads Postgres through Hyperdrive, not this API —
so it was an operator convenience. Query `market_latest` directly for the same answer.

Rollback, if the Go collector misbehaves:

```sh
docker compose -f ~/airates-app/deploy/hklab/compose.yml stop collector-go
docker compose -f ~/airates-app/deploy/hklab/compose.yml --profile bun up -d collector
```

They cannot run at the same time: both bind 20090, so Docker refuses the second one. That is
deliberate — two collectors writing `market_latest` and `funding_snapshots` would race over the same
rows, both writes would succeed, and the loser would be silent.

## Public site (Cloudflare Worker)

The Worker `airates` (https://airates.jobhesk.workers.dev) deploys from `main` through Workers Builds.

- **How it reads data:** through Hyperdrive config `airates-vaultdeck`, binding `HYPERDRIVE` in `wrangler.jsonc`.
- **What it reads:** only the read models the collector maintains: `market_latest`, `market_funding_stats` and `screener_pairs()`.
- **If the collector stops:** markets go stale after five minutes. Pages then show empty states, and `/v1/health` returns 503.

Run it locally against the real database through the SSH tunnel:

```sh
ssh -f -N -L 55437:127.0.0.1:5437 -p $AIRATES_DEPLOY_SSH_PORT $AIRATES_DEPLOY_USER@$AIRATES_DEPLOY_HOST
set -a && . ./.env.test.local && set +a
CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE="$DATABASE_URL" npx wrangler dev
```

## Integration tests

`apps/collector/src/store.int.test.ts` runs in its own schema, `airates_it`, inside `vaultdeck`, through an SSH tunnel:

```sh
ssh -f -N -L 55437:127.0.0.1:5437 -p $AIRATES_DEPLOY_SSH_PORT $AIRATES_DEPLOY_USER@$AIRATES_DEPLOY_HOST
bun --env-file=.env.test.local test apps/collector   # DATABASE_URL=postgres://$AIRATES_PG_ROLE:...@127.0.0.1:55437/vaultdeck
```
