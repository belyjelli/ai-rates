#!/bin/sh
# Deploys the airates collector to hklab ($AIRATES_DEPLOY_HOST:$AIRATES_DEPLOY_SSH_PORT, host epos).
#   - streams an allowlist of the repo to the server (no registry)
#   - swaps the remote tree atomically, keeping the server-only deploy/hklab/.env
#   - builds the image on the server and restarts it with docker compose
# Usage (from the repository root): ./deploy/hklab/deploy.sh
set -eu
(set -o pipefail 2>/dev/null) && set -o pipefail

HOST="$AIRATES_DEPLOY_USER@$AIRATES_DEPLOY_HOST"
SSHPORT=$AIRATES_DEPLOY_SSH_PORT
SSH="ssh -o BatchMode=yes -o ServerAliveInterval=20 -o ServerAliveCountMax=15 -p $SSHPORT $HOST"
REMOTE_DIR="\$HOME/airates-app"
STAGE_DIR="$REMOTE_DIR.staging"

# Everything the Dockerfile copies, plus the compose file. Keep in sync with apps/collector/Dockerfile.
SRC="package.json bun.lock apps/collector apps/worker/package.json packages deploy/hklab/compose.yml"

cd "$(dirname "$0")/../.."
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

echo "==> health"
sleep 5
$SSH "curl -fsS http://127.0.0.1:20090/health" || { echo "deploy: health check failed; see 'docker logs airates-collector'" >&2; exit 1; }
echo
