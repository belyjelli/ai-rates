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

# Everything apps/collector-go/Dockerfile copies, plus the compose file. Keep in sync with it.
# (The Bun collector, and the package.json/bun.lock its image needed, were removed 2026-09-24.)
SRC="apps/collector-go packages/db/migrations packages/venues/catalog.json deploy/hklab/compose.yml"

for f in $SRC; do
  [ -e "$f" ] || { echo "deploy: missing '$f'" >&2; exit 1; }
done

# REFUSE TO DEPLOY BACKWARDS. On 2026-09-23 at 20:40 UTC this script ran from a checkout that was
# behind origin/main. It streamed that older tree, and the collector went back to reading Binance's
# TESTNET for nine hours, writing play-money liquidations into production (migration 025 deleted
# them). Nothing here noticed, because the script deploys whatever the working tree holds. So the
# checkout must contain origin/main: ahead of it (a branch being tried) is fine, behind it is not.
# AIRATES_DEPLOY_ALLOW_STALE=1 is for a deliberate rollback.
git fetch --quiet origin main || { echo "deploy: cannot fetch origin/main to check this checkout is current" >&2; exit 1; }
REV="$(git rev-parse --short HEAD)"
if ! git merge-base --is-ancestor origin/main HEAD && [ "${AIRATES_DEPLOY_ALLOW_STALE:-}" != "1" ]; then
  echo "deploy: this checkout ($REV, $(git rev-parse --abbrev-ref HEAD)) does not contain origin/main ($(git rev-parse --short origin/main))." >&2
  echo "  Deploying it would roll the collector BACK. Run 'git checkout main && git pull' first," >&2
  echo "  or set AIRATES_DEPLOY_ALLOW_STALE=1 if a rollback is what you mean." >&2
  exit 1
fi
# The tree is streamed as it sits on disk, so an uncommitted edit ships too. Say so, since REV
# would otherwise claim a commit that is not what is running.
if [ -n "$(git status --porcelain -- $SRC)" ]; then
  echo "deploy: warning: uncommitted changes under the deployed paths will ship with $REV" >&2
  REV="$REV+dirty"
fi
echo "==> deploying $REV"

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
# architecture for the server anyway -- the image builds its own inside golang:1.27.1-alpine.
tar czf - --exclude node_modules --exclude .DS_Store --exclude '*.test.ts' --exclude bin $SRC | $SSH "tar xzf - -C $STAGE_DIR"

# Which commit is on the server, readable there without guessing from file dates.
$SSH "echo '$REV' > $STAGE_DIR/DEPLOYED_REVISION"

echo "==> swapping remote tree (keeping .env)"
$SSH "cp $REMOTE_DIR/deploy/hklab/.env $STAGE_DIR/deploy/hklab/.env && chmod 600 $STAGE_DIR/deploy/hklab/.env && rm -rf $REMOTE_DIR && mv $STAGE_DIR $REMOTE_DIR"

echo "==> building and restarting"
$SSH "cd $REMOTE_DIR && docker compose -f deploy/hklab/compose.yml up -d --build"

echo "==> health (waiting up to 60s for the collector to start)"
$SSH 'for i in $(seq 1 30); do curl -fsS http://127.0.0.1:20090/health && exit 0; sleep 2; done; exit 1' \
  || { echo "deploy: health check failed; see 'docker logs airates-collector-go'" >&2; exit 1; }
echo
