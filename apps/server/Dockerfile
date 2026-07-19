# Base image with Bun
FROM oven/bun:latest AS base
WORKDIR /app

# Build stage
FROM base AS builder
WORKDIR /app

# Copy everything
COPY . .

# Install deps from bun.lock
RUN bun install --frozen-lockfile

# Build (runs tsoa + openapi, then bundles; see apps/server package.json)
RUN bun run build --filter=@cmugpt-frontend/server...

# Final runtime image
FROM base AS runner
WORKDIR /app

# Create non-root user
RUN groupadd --system --gid 1001 server && \
    useradd --system --uid 1001 --gid 1001 server
USER server

# Copy OpenAPI spec (served at /api/openapi.json and rendered by Scalar)
COPY --from=builder --chown=server:server \
  /app/apps/server/build/swagger.yaml \
  /app/apps/server/build/swagger.yaml

# Copy only what's needed to run the server
COPY --from=builder --chown=server:server \
  /app/apps/server/dist \
  /app/apps/server/dist

EXPOSE 3000
WORKDIR /app/apps/server
CMD ["bun", "dist/server.js"]
