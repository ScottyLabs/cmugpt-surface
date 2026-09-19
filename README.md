# Bark Surface (cmugpt-surface)

Bark Surface is the user-facing web app and BFF (backend-for-frontend) API for
**Bark**, ScottyLabs' CMU-focused AI chat assistant. It handles authentication,
chat history, memory management, and streams chat responses from the
[`cmugpt-agent`](../cmugpt-agent) service, which does the actual LLM/agent
work.

This repo is built on
[ScottyStack](https://github.com/ScottyLabs/ScottyStack/wiki), ScottyLabs'
[full-stack typesafe](https://github.com/ScottyLabs/ScottyStack/wiki/Full%E2%80%90Stack-Type%E2%80%90Safety)
template, so the general ScottyStack docs also apply here. This README covers
what's specific to this project.

## Repo structure

This is a [Deno workspace](./deno.json) with two apps and no separate agent
code — the actual chat/LLM logic lives in the sibling `cmugpt-agent` repo.

```
cmugpt-surface/
├── apps/
│   ├── server/            # Express API (BFF) — auth, chat, memory
│   │   ├── src/
│   │   │   ├── server.ts        # entrypoint: migrations, middleware, routes
│   │   │   ├── env.ts           # zod-validated environment schema
│   │   │   ├── controllers/     # tsoa controllers (source of truth for the API)
│   │   │   ├── routes/          # hand-written routes (SSE streaming, auth)
│   │   │   ├── services/        # business logic (chat, memory, preferences)
│   │   │   ├── middlewares/     # error handling, 404s
│   │   │   ├── lib/              # OIDC client, agent HTTP client, auth helpers
│   │   │   └── db/               # drizzle schema + client
│   │   ├── drizzle/               # SQL migrations (drizzle-kit)
│   │   └── build/                 # generated: OpenAPI spec, routes, types
│   └── web/                # React SPA
│       ├── src/
│       │   ├── routes/            # TanStack Router file-based routes
│       │   ├── components/        # chat UI, memory manager, icons
│       │   ├── integrations/      # auth + TanStack Query wiring
│       │   └── lib/api/           # typed API client (generated from server OpenAPI)
│       └── e2e/                   # Playwright end-to-end tests
├── nix/, devenv.nix, flake.nix    # Nix/devenv dev environment + build packages
├── scripts/secrets/               # git submodule: secrets-sync-scripts
└── secretspec.toml                # declares required env vars / secrets
```

Key thing to know: **`apps/server` is the source of truth for the API shape.**
tsoa generates an OpenAPI spec + Express routes from the controllers in
`apps/server/src/controllers`, and `apps/web` imports the generated
`openapi.d.ts` types directly (see the `generate` task below) to get a fully
typed API client with no manual API type definitions on the frontend.

## Tech stack

| Layer | Tech |
|---|---|
| Runtime / package manager | [Deno](https://deno.com/) (workspace of two `deno.json` projects, npm deps via `npm:` specifiers) |
| API server | Express 5, [tsoa](https://tsoa-community.github.io/docs/) (decorators → OpenAPI + routes), Zod |
| Database | PostgreSQL + [pgvector](https://github.com/pgvector/pgvector) (semantic memory search), [Drizzle ORM](https://orm.drizzle.team/) + drizzle-kit |
| Auth | OIDC (Andrew ID SSO) via `openid-client`/`jwks-rsa`, plus lightweight server-side sessions (better-auth-shaped tables) |
| Frontend | React 19, Vite, [TanStack Router](https://tanstack.com/router) + [TanStack Query](https://tanstack.com/query), Tailwind CSS v4 |
| API contract | Auto-generated OpenAPI spec, consumed via `openapi-fetch` + `openapi-react-query` |
| Testing | Vitest (unit, web), Playwright (e2e, `apps/web/e2e`) |
| Dev environment | [devenv](https://devenv.sh/) + Nix, via ScottyLabs' internal `kennel` devenv modules |
| Secrets | [secretspec](https://secretspec.dev/) — local `.env` or ScottyLabs' OpenBao vault |
| CI/CD | Forgejo Actions, reusing `ScottyLabs/kennel`'s shared CI workflow |

## Prerequisites

**Recommended: Nix + devenv.** This repo is designed to be run through
[devenv](https://devenv.sh/), which provisions Deno, PostgreSQL (with
pgvector), secrets, and an OAuth relay for you. Install:

- [Nix](https://nixos.org/download) (with flakes enabled)
- [devenv](https://devenv.sh/getting-started/)

**Manual/without devenv**, you'll need:

- [Deno](https://deno.com/) (a recent stable release)
- PostgreSQL with the `pgvector` extension available
- A running instance of, or network access to, [`cmugpt-agent`](../cmugpt-agent)
- Values for the environment variables below (see [Environment variables](#environment-variables))

## Running it

### With devenv (recommended)

```sh
devenv shell   # or `direnv allow` if you use direnv
```

This starts a Postgres instance (with pgvector) and resolves secrets via
secretspec automatically. Two `devenv` processes are defined
([devenv.nix](./devenv.nix)):

```sh
devenv up      # runs both `api` (port 3001) and `web` processes
```

Or run everything through Deno directly once you're in the shell:

```sh
deno install
deno task dev
```

`deno task dev` runs the server and web dev servers concurrently (server on
`:3001`, web/Vite on `:4173`).

### Without devenv

1. Create and migrate a Postgres database with pgvector:

   ```sh
   createdb cmugpt_surface
   psql -d cmugpt_surface -c 'CREATE EXTENSION IF NOT EXISTS vector;'
   ```

2. Create a `.env` file at the repo root with the variables in
   [secretspec.toml](./secretspec.toml) (see below) — `secretspec`'s `local`
   provider reads from `.env` directly, or you can just export the vars.

3. Install deps and run:

   ```sh
   deno install
   deno task dev
   ```

Migrations run automatically on server startup (`apps/server/src/server.ts`
calls `drizzle-orm`'s `migrate()` against `apps/server/drizzle` before the
Express app starts listening).

## Environment variables

Declared in [secretspec.toml](./secretspec.toml) and validated at runtime by
[`apps/server/src/env.ts`](./apps/server/src/env.ts):

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string |
| `OIDC_ISSUER_URL` | yes | OIDC issuer for Andrew ID SSO |
| `OIDC_CLIENT_ID` | yes (default `sl-ai-local`) | OIDC client ID |
| `OIDC_CLIENT_SECRET` | yes | OIDC client secret |
| `ALLOWED_ORIGINS_REGEX` | yes | Regex of allowed CORS origins |
| `AGENT_API_URL` | yes (default `https://api.cmugpt-agent.scottylabs.org`) | Base URL of the `cmugpt-agent` service |
| `AGENT_SHARED_SECRET` | prod only, but strongly recommended locally | App-to-app bearer secret shared with `cmugpt-agent`; **must not** use a `VITE_`-prefixed name or otherwise reach the browser. Generate with `openssl rand -hex 32`. Required to be ≥32 chars with no leading/trailing whitespace in production. |
| `OAUTH_RELAY_URL` | no | Shared "ricochet" OAuth relay callback, used so preview deployments can authenticate without registering their own redirect URI |
| `SERVER_PORT` | no (default `80`, `3001` in devenv) | API server port |
| `APP_URL` | no (default `http://localhost:4173`) | Public URL of the web app, used for OIDC callback construction |
| `ADMIN_GROUP` | no | Admin group name (stopgap until real governance wiring exists) |

See [apps/server/README.md](./apps/server/README.md) for more on the
agent-connection secret.

## Common tasks

Run from the repo root (these fan out to the two workspace apps):

| Command | Description |
|---|---|
| `deno task dev` | Run server + web dev servers concurrently |
| `deno task generate` | Regenerate the OpenAPI spec/routes from server controllers (also runs automatically before `build`/`dev`) |
| `deno task build` | Build both apps for production |
| `deno task check` | Type-check both apps (`deno check`) |
| `deno task test:e2e` | Run Playwright e2e tests against the web app |
| `deno task db:generate` | Generate a new Drizzle migration from schema changes |
| `deno task db:migrate` | Apply pending migrations |

Per-app tasks (run with `deno task --cwd apps/<app> <task>`, or `cd` into the
app first):

- `apps/server`: `server` (no regen), `tsoa:watch`, `openapi:watch`, `start`, `check`
- `apps/web`: `dev`, `build`, `preview`, `test` (Vitest unit tests), `check`

## Testing

- **Unit tests** (`apps/web`): `deno task --cwd apps/web test` (Vitest + Testing Library)
- **E2E tests**: `deno task test:e2e` from the repo root, powered by
  [playwright.config.ts](./playwright.config.ts). It boots the web dev server
  automatically and runs specs in `apps/web/e2e/`.
- **Type checking**: `deno task check`

## Deployment

Deployed via ScottyLabs' internal `kennel` platform (see the `kennel` block
in [devenv.nix](./devenv.nix)):

- Web (SPA) → `bark.scottylabs.org`
- API service → `api.cmugpt.com`

[flake.nix](./flake.nix) defines Nix packages (`web`, `api`) used to build
production artifacts — the API compiles to a standalone Deno binary via
`deno compile`.

## Related repos

- [`cmugpt-agent`](../cmugpt-agent) — the actual chat agent/LLM service this
  server proxies to (OpenRouter for chat, OpenAI embeddings for memory
  search, pgvector-backed long-term memory).

## License

Dual-licensed under [Apache-2.0](./LICENSE-APACHE-2.0) or
[MIT](./LICENSE-MIT), at your option.
