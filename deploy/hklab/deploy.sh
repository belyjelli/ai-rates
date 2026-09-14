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

# Everything the Dockerfiles copy, plus the compose file. Keep in sync with
# apps/collector/Dockerfile and apps/collector-go/Dockerfile.
#
# apps/collector-go IS the collector as of 2026-09-15. apps/collector is the deprecated Bun one,
# still streamed because its compose service is the rollback and has to stay buildable.
SRC="package.json bun.lock apps/collector apps/collector-go apps/worker/package.json packages deploy/hklab/compose.yml"

for f in $SRC; do
  [ -e "$f" ] || { echo "deploy: missing '$f'" >&2; exit 1; }
done

# Reachability first, and separately, because these are different failures with different fixes.
# Previously one `test -f` over ssh covered both: when ssh itself could not start -- a broken
# ~/.ssh/config aborts every connection before any network call -- the script reported a missing
# .env on the server and sent the reader to fix the wrong machine.
$SSH true 2>/dev/null || {
  echo "deploy: cannot open an ssh session to the target." >&2
  echo "  This is a LOCAL failure, not a missing file on the server. Check ~/.ssh/config parses" >&2
  echo "  (\`ssh -G <host> >/dev/null\` reports the offending line), then that the host is reachable." >&2
  exit 1
}

$SSH "test -f $REMOTE_DIR/deploy/hklab/.env" || {
  echo "deploy: ssh works, but $REMOTE_DIR/deploy/hklab/.env is missing on the server." >&2
  echo "  Create it with DATABASE_URL=... (mode 600); see deploy/hklab/README.md." >&2
  exit 1
}

echo "==> streaming source to hklab"
$SSH "rm -rf $STAGE_DIR && mkdir -p $STAGE_DIR"
# `bin` excluded because apps/collector-go/bin holds a 16 MB locally-built binary that is the wrong
# architecture for the server anyway -- the image builds its own inside golang:1.26-alpine.
tar czf - --exclude node_modules --exclude .DS_Store --exclude '*.test.ts' --exclude bin $SRC | $SSH "tar xzf - -C $STAGE_DIR"

echo "==> swapping remote tree (keeping .env)"
$SSH "cp $REMOTE_DIR/deploy/hklab/.env $STAGE_DIR/deploy/hklab/.env && chmod 600 $STAGE_DIR/deploy/hklab/.env && rm -rf $REMOTE_DIR && mv $STAGE_DIR $REMOTE_DIR"

echo "==> building and restarting"
$SSH "cd $REMOTE_DIR && docker compose -f deploy/hklab/compose.yml up -d --build"

echo "==> health (waiting up to 60s for the collector to start)"
$SSH 'for i in $(seq 1 30); do curl -fsS http://127.0.0.1:20090/health && exit 0; sleep 2; done; exit 1' \
  || { echo "deploy: health check failed; see 'docker logs airates-collector-go'" >&2; exit 1; }
echo
