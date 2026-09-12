#!/bin/sh
# Deploys the airates collector to hklab.
#   - streams an allowlist of the repo to the server (no registry)
#   - swaps the remote tree atomically, keeping the server-only deploy/hklab/.env
#   - builds the image on the server and restarts it with docker compose
# Usage (from the repository root): ./deploy/hklab/deploy.sh
#
# THE TARGET IS NOT IN THIS FILE. This repository is public, and a hostname plus an SSH user and
# port is most of what someone needs to start knocking. Those three values live in
# deploy/hklab/.env.deploy (gitignored; copy .env.deploy.example), or in the environment.
set -eu
(set -o pipefail 2>/dev/null) && set -o pipefail

cd "$(dirname "$0")/../.."

ENV_FILE="deploy/hklab/.env.deploy"
# shellcheck source=/dev/null
[ -f "$ENV_FILE" ] && . "./$ENV_FILE"

# Refuse rather than fall back. A default here would mean a typo or a missing file silently
# deploying to whatever host was hardcoded last, which is worse than not deploying at all.
: "${AIRATES_DEPLOY_HOST:?not set -- copy deploy/hklab/.env.deploy.example to .env.deploy and fill it in}"
: "${AIRATES_DEPLOY_USER:?not set -- copy deploy/hklab/.env.deploy.example to .env.deploy and fill it in}"
: "${AIRATES_DEPLOY_SSH_PORT:?not set -- copy deploy/hklab/.env.deploy.example to .env.deploy and fill it in}"

SSH="ssh -o BatchMode=yes -o ServerAliveInterval=20 -o ServerAliveCountMax=15 -p $AIRATES_DEPLOY_SSH_PORT $AIRATES_DEPLOY_USER@$AIRATES_DEPLOY_HOST"
REMOTE_DIR="\$HOME/airates-app"
STAGE_DIR="$REMOTE_DIR.staging"

# Everything the Dockerfile copies, plus the compose file. Keep in sync with apps/collector/Dockerfile.
SRC="package.json bun.lock apps/collector apps/worker/package.json packages deploy/hklab/compose.yml"

for f in $SRC; do
  [ -e "$f" ] || { echo "deploy: missing '$f'" >&2; exit 1; }
done

$SSH "test -f $REMOTE_DIR/deploy/hklab/.env" || {
  echo "deploy: create $REMOTE_DIR/deploy/hklab/.env on the server first (DATABASE_URL=...)" >&2
  exit 1
}

echo "==> streaming source to hklab"
$SSH "rm -rf $STAGE_DIR && mkdir -p $STAGE_DIR"
tar czf - --exclude node_modules --exclude .DS_Store --exclude '*.test.ts' $SRC | $SSH "tar xzf - -C $STAGE_DIR"

echo "==> swapping remote tree (keeping .env)"
$SSH "cp $REMOTE_DIR/deploy/hklab/.env $STAGE_DIR/deploy/hklab/.env && chmod 600 $STAGE_DIR/deploy/hklab/.env && rm -rf $REMOTE_DIR && mv $STAGE_DIR $REMOTE_DIR"

echo "==> building and restarting"
$SSH "cd $REMOTE_DIR && docker compose -f deploy/hklab/compose.yml up -d --build"

echo "==> health (waiting up to 60s for the collector to start)"
$SSH 'for i in $(seq 1 30); do curl -fsS http://127.0.0.1:20090/health && exit 0; sleep 2; done; exit 1' \
  || { echo "deploy: health check failed; see 'docker logs airates-collector'" >&2; exit 1; }
echo
