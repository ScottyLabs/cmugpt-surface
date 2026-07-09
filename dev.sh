#!/usr/bin/env bash
# Start the cmugpt-surface backend and frontend together for local development.
#
# - backend (Deno/tsoa) listens on :3001 (PORT from ./.env)
# - frontend (Vite) serves on http://localhost:3000 and proxies the API routes
#   to the backend, so the whole app is same-origin (needed for auth cookies).
#
# Run inside the devenv shell (`devenv shell` or direnv) so `deno` and the
# local ricochet relay are on PATH. Ctrl-C stops both services.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Backend port (matches ./.env PORT / SERVER_URL) and the origin Vite proxies
# API routes to. Override either by exporting it before running.
export PORT="${PORT:-3001}"
export VITE_DEV_API_ORIGIN="${VITE_DEV_API_ORIGIN:-http://localhost:${PORT}}"

pids=()
cleanup() {
  trap - INT TERM EXIT
  for pid in "${pids[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}
trap cleanup INT TERM EXIT

echo "▶ backend  → http://localhost:${PORT}"
( cd "$repo_root/apps/server" && deno task dev ) &
pids+=($!)

echo "▶ frontend → http://localhost:3000 (proxying API → ${VITE_DEV_API_ORIGIN})"
( cd "$repo_root/apps/web" && deno task dev ) &
pids+=($!)

# Exit (and trigger cleanup) as soon as either service dies.
wait -n
