# Deploying the collector to hklab

Target: **hklab** (`ssh -p $AIRATES_DEPLOY_SSH_PORT $AIRATES_DEPLOY_USER@$AIRATES_DEPLOY_HOST`, host `epos`). The collector runs as the `airates-collector`
container on the `postgres_postgres` network. It writes to database **`vaultdeck`** as role **`$AIRATES_PG_ROLE`** in the existing
`timescaledb_container` (TimescaleDB 2.20.3 / PostgreSQL 17.5), over the internal Docker network.

Credentials never go in the repo: locally in `plans/access.md` (gitignored), on the server in
`~/airates-app/deploy/hklab/.env` (mode 600).

> **`$AIRATES_DEPLOY_HOST:$AIRATES_PG_PORT` exposes this Postgres instance without TLS** (`ssl = off`). Don't connect over that port
> from outside hklab until TLS is enabled (planned for Phase 2, so Cloudflare Hyperdrive can reach it).

## Current state (2026-09-12)

- **Database:** live on `vaultdeck`. On 2026-09-12 it was migrated from the earlier `airates` database, with identical
  row counts in all five tables.
- **Disk:** `vaultdeck` is on the default tablespace, i.e. the root filesystem (~12 GB free). Watch `df -h /` until
  steps 1–3 below are done.

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

## Server environment

`~/airates-app/deploy/hklab/.env` (created once, preserved by every deploy):

```sh
DATABASE_URL=postgres://$AIRATES_PG_ROLE:<password>@timescaledb_container:5432/vaultdeck
COLLECT_INTERVAL_MS=60000
```

## Deploy

From the repository root on a machine with SSH access:

```sh
./deploy/hklab/deploy.sh
```

The script streams the source, builds the image on the server, runs `docker compose up -d --build`, and waits for
`http://127.0.0.1:20090/health`. Migrations run automatically when the collector starts.

## Operations (on hklab)

```sh
docker logs -f airates-collector                       # collector logs
curl -s http://127.0.0.1:20090/health                  # per-venue freshness
curl -s 'http://127.0.0.1:20090/v1/latest?base=BTC'    # latest BTC funding across venues
docker compose -f ~/airates-app/deploy/hklab/compose.yml restart collector
docker exec timescaledb_container sh -c 'psql -U "$POSTGRES_USER" -d vaultdeck -c "\dt+"'
```

## Integration tests

`apps/collector/src/store.int.test.ts` runs in its own schema, `airates_it`, inside `vaultdeck`, through an SSH tunnel:

```sh
ssh -f -N -L 55437:127.0.0.1:5437 -p $AIRATES_DEPLOY_SSH_PORT $AIRATES_DEPLOY_USER@$AIRATES_DEPLOY_HOST
bun --env-file=.env.test.local test apps/collector   # DATABASE_URL=postgres://$AIRATES_PG_ROLE:...@127.0.0.1:55437/vaultdeck
```
