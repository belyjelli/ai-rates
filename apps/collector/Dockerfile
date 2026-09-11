# Build context: repository root (see deploy/hklab/compose.yml).
FROM oven/bun:1.3.14-alpine

WORKDIR /app

# Workspace manifests first so the dependency layer is cached across code-only deploys.
COPY package.json bun.lock ./
COPY apps/worker/package.json apps/worker/
COPY apps/collector/package.json apps/collector/
COPY packages/core/package.json packages/core/
COPY packages/venues/package.json packages/venues/
COPY packages/adapters/package.json packages/adapters/
COPY packages/db/package.json packages/db/
RUN bun install --frozen-lockfile --production

COPY packages ./packages
COPY apps/collector ./apps/collector

USER bun
ENV NODE_ENV=production
EXPOSE 8080
CMD ["bun", "apps/collector/src/main.ts"]
