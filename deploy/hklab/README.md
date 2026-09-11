# Deploying the collector to hklab

Target: **hklab** (`ssh -p $AIRATES_DEPLOY_SSH_PORT $AIRATES_DEPLOY_USER@$AIRATES_DEPLOY_HOST`, host `epos`). The collector runs as the `airates-collector`
container on the `postgres_postgres` network, writing to the database `airates` in the existing
`timescaledb_container` (TimescaleDB 2.20.3 / PostgreSQL 17.5).

Its data lives on the 466 GB NVMe (`/dev/nvme0n1p1`), mounted at `/srv/filegator/data/database`, through a
Postgres tablespace. The root filesystem (~12 GB free) is too small for a year of funding data.

## One-time setup

Steps 1–2 need `sudo` on hklab, so an operator runs them from an interactive session (`connect connect hklab`).

### 1. Mount the NVMe

The partition already holds an ext4 filesystem. Inspect it read-only first and **don't reformat it if it holds
anything worth keeping**.

```sh
sudo mkdir -p /mnt/nvme-inspect && sudo mount -o ro /dev/nvme0n1p1 /mnt/nvme-inspect
sudo ls -la /mnt/nvme-inspect && df -h /mnt/nvme-inspect
sudo umount /mnt/nvme-inspect

sudo mkdir -p /srv/filegator/data/database
echo 'UUID=36be1152-0714-4bf4-aec3-c20b639b09c5 /srv/filegator/data/database ext4 defaults,nofail 0 2' | sudo tee -a /etc/fstab
sudo systemctl daemon-reload && sudo mount /srv/filegator/data/database
df -h /srv/filegator/data/database

# Tablespace directory, owned by the container's postgres user (uid/gid 1000).
sudo mkdir -p /srv/filegator/data/database/timescale-airates
sudo chown 1000:1000 /srv/filegator/data/database/timescale-airates
sudo chmod 700 /srv/filegator/data/database/timescale-airates
```

`nofail` keeps the server booting if the disk is missing. `/srv/filegator/data` is also served by the FileGator
container, so after FileGator's next restart the database files would be visible in its file browser. To avoid
that, mount somewhere outside `/srv/filegator/data` (e.g. `/srv/airates-data`) and adjust the paths below.

### 2. Expose the directory to TimescaleDB

Add one volume to the `timescaledb` service in `/srv/postgres/db_compose.yml`:

```yaml
    volumes:
      - /srv/postgres/timesc_data:/data/postgrestimesc   # existing
      - /srv/filegator/data/database/timescale-airates:/data/airates   # new
```

Then recreate the container. This briefly interrupts the **16 other databases** on this instance, so pick a
quiet moment:

```sh
cd /srv/postgres && sudo docker compose -f db_compose.yml up -d timescaledb
docker exec timescaledb_container ls -ld /data/airates
```

### 3. Tablespace, database and credentials

No sudo needed. The role `airates` already exists (created for `airates_test`).

```sh
docker exec -i timescaledb_container sh -c 'psql -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1' <<'SQL'
CREATE TABLESPACE airates_nvme OWNER airates LOCATION '/data/airates';
CREATE DATABASE airates OWNER airates TABLESPACE airates_nvme;
\c airates
CREATE EXTENSION IF NOT EXISTS timescaledb;
SQL
```

Create the server-only env file (never commit it). Use the `airates` role's password:

```sh
mkdir -p ~/airates-app/deploy/hklab
cat > ~/airates-app/deploy/hklab/.env <<'ENV'
DATABASE_URL=postgres://airates:<password>@timescaledb_container:5432/airates
COLLECT_INTERVAL_MS=60000
ENV
chmod 600 ~/airates-app/deploy/hklab/.env
```

## Deploy

From the repository root on a machine with SSH access:

```sh
./deploy/hklab/deploy.sh
```

The script streams the source, builds the image on the server, runs `docker compose up -d --build`, and
checks `http://127.0.0.1:20090/health`. Migrations run automatically when the collector starts.

## Operations (on hklab)

```sh
docker logs -f airates-collector                       # collector logs
curl -s http://127.0.0.1:20090/health                  # per-venue freshness
curl -s 'http://127.0.0.1:20090/v1/latest?base=BTC'    # latest BTC funding across venues
docker compose -f ~/airates-app/deploy/hklab/compose.yml restart collector
docker exec timescaledb_container sh -c 'psql -U "$POSTGRES_USER" -d airates -c "\dt+"'
```
