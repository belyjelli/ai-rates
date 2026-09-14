# Build context: repository root, matching apps/collector/Dockerfile and deploy/hklab/compose.yml.
#
# Multi-stage so the shipped image carries a single static binary and no toolchain. The Bun image it
# replaces ships a runtime plus node_modules; this one is the binary and a CA bundle, which is most
# of why the image is small and all of why there is nothing in it to patch.

FROM golang:1.26-alpine AS build

WORKDIR /src

# Manifests first, so the dependency layer survives code-only deploys.
COPY apps/collector-go/go.mod apps/collector-go/go.sum ./
RUN go mod download

COPY apps/collector-go/ ./

# CGO off gives a genuinely static binary, so the runtime stage needs no libc.
# -trimpath keeps build paths out of the binary; -s -w drop the symbol and DWARF tables.
ENV CGO_ENABLED=0
RUN go build -trimpath -ldflags="-s -w" -o /out/collector ./cmd/collector

FROM alpine:3.21

# TLS roots for the venue APIs and for sslmode=verify-full against Postgres.
RUN apk add --no-cache ca-certificates && adduser -D -u 10001 collector

COPY --from=build /out/collector /usr/local/bin/collector

# The two things the binary reads from the repository at startup. Migrations are applied before any
# loop starts; the catalog supplies every venue's row (market tables reference it) and the curated
# leverage. Both are generated or owned on the TypeScript side, so they are copied, never duplicated.
COPY packages/db/migrations/ /usr/local/share/airates/migrations/
COPY packages/venues/catalog.json /usr/local/share/airates/catalog.json
ENV MIGRATIONS_DIR=/usr/local/share/airates/migrations \
    VENUE_CATALOG=/usr/local/share/airates/catalog.json

USER collector
EXPOSE 8080

# A soft limit a little under the container's mem_limit of 1g. The garbage collector backs off as
# the heap approaches it, instead of the kernel killing the process at the hard ceiling — which is
# what the Bun collector did roughly every 50 minutes, losing every warmed cache each time.
ENV GOMEMLIMIT=900MiB

ENTRYPOINT ["/usr/local/bin/collector"]
