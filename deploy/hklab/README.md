# Deploying the collector to hklab

Target: **hklab** (`ssh -p $AIRATES_DEPLOY_SSH_PORT $AIRATES_DEPLOY_USER@$AIRATES_DEPLOY_HOST`, host `epos`). The collector runs as the `airates-collector`
container on the `postgres_postgres` network. It writes to database **`vaultdeck`** as role **`$AIRATES_PG_ROLE`** in the existing
`timescaledb_container` (TimescaleDB 2.20.3 / PostgreSQL 17.5), over the internal Docker network.

Credentials never go in the repo: locally in `plans/access.md` (gitignored), on the server in
`~/airates-app/deploy/hklab/.env` (mode 600).

> **`$AIRATES_DEPLOY_HOST:$AIRATES_PG_PORT` exposes this Postgres instance to the internet.** TLS is enabled but not enforced (see
> [TLS](#tls)), so outside clients must connect with `sslmode=verify-full` and `deploy/hklab/postgres-ca.crt`.

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
