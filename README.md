# Bark Surface (cmugpt-surface)

Bark Surface is the user-facing web app and BFF (backend-for-frontend) API for **Bark**, ScottyLabs' CMU-focused AI chat assistant. It handles authentication, chat history, memory management, and streams chat responses from the [`cmugpt-agent`](https://git.cmu.dev/ScottyLabs/cmugpt-agent) service, which does the actual agent/LLM work.

## Repo structure

This is a [Deno workspace](./deno.json) with two apps and no separate agent code - the actual chat/LLM logic lives in the sibling `cmugpt-agent` repo.

```
cmugpt-surface/
|-- apps/
|   |-- server/            # Express API (BFF) - auth, chat, memory
|   |   |-- src/
|   |   |   |-- server.ts        # entrypoint: migrations, middleware, routes
|   |   |   |-- env.ts           # zod-validated environment schema
|   |   |   |-- controllers/     # tsoa controllers (source of truth for the API)
|   |   |   |-- routes/          # hand-written routes (SSE streaming, auth)
|   |   |   |-- services/        # business logic (chat, memory, preferences)
|   |   |   |-- middlewares/     # error handling, 404s
|   |   |   |-- lib/             # OIDC client, agent HTTP client, auth helpers
|   |   |   `-- db/              # drizzle schema + client
|   |   |-- drizzle/             # SQL migrations (drizzle-kit)
|   |   `-- build/               # generated: OpenAPI spec, routes, types
|   `-- web/                # React SPA
|       |-- src/
|       |   |-- routes/          # TanStack Router file-based routes
|       |   |-- components/      # chat UI, memory manager, icons
|       |   |-- integrations/    # auth + TanStack Query wiring
|       |   `-- lib/api/         # typed API client (generated from server OpenAPI)
|       `-- e2e/                 # Playwright end-to-end tests
|-- flake.nix                    # Nix dev environment + build packages
`-- secretspec.toml                # declares required env vars / secrets
```

Key thing to know: **`apps/server` is the source of truth for the API shape.** tsoa generates an OpenAPI spec + Express routes from the controllers in `apps/server/src/controllers`, and `apps/web` imports the generated `openapi.d.ts` types directly (see the `generate` task below) to get a fully typed API client with no manual API type definitions on the frontend.

## Tech stack

| Layer | Tech |
| -- | -- |
| Runtime / package manager | [Deno](https://deno.com/) (workspace of two `deno.json` projects, npm deps via `npm:` specifiers) |
| API server | Express 5, [tsoa](https://tsoa-community.github.io/docs/) (decorators to OpenAPI + routes), Zod |
| Database | PostgreSQL + [pgvector](https://github.com/pgvector/pgvector) (semantic memory search), [Drizzle ORM](https://orm.drizzle.team/) + drizzle-kit |
| Auth | OIDC (Andrew ID SSO) via `openid-client`/`jwks-rsa`, plus lightweight server-side sessions (better-auth-shaped tables) |
| Frontend | React 19, Vite, [TanStack Router](https://tanstack.com/router) + [TanStack Query](https://tanstack.com/query), Tailwind CSS v4 |
| API contract | Auto-generated OpenAPI spec, consumed via `openapi-fetch` + `openapi-react-query` |
| Testing | Vitest (unit, web), Playwright (e2e, `apps/web/e2e`) |
| Dev environment | Nix flake, via ScottyLabs' `kennel` flake-parts module |
| Secrets | [secretspec](https://secretspec.dev/), resolving from ScottyLabs' OpenBao vault |
| CI/CD | Forgejo Actions, reusing `ScottyLabs/kennel`'s shared CI workflow |

## Before you start

1. [Join the `slai` team through governance](https://git.cmu.dev/ScottyLabs/governance#joining-a-team). This membership is what grants read access to the project's dev secrets (OIDC client, agent secret, and so on) in OpenBao.
1. Install Lix and log in to OpenBao by following kennel's [local development](https://docs.kennel.scottylabs.org/guides/local-development/#installing-nix) and [secrets](https://docs.kennel.scottylabs.org/guides/secrets/#local-development) guides. The dev shell provides Deno, Postgres with pgvector, the local login relay, `bao`, and `secretspec`, so you don't need to install those yourself. You only need [Git](https://git-scm.com/downloads).

## Running it

### With Nix (recommended)

```sh
git clone ssh://forgejo@git.cmu.dev/ScottyLabs/cmugpt-surface.git
cd cmugpt-surface
nix develop
pitchfork start --local
```

`nix develop` builds the environment and loads secrets. `pitchfork start --local` starts every process defined in [flake.nix](./flake.nix) and the shared ScottyLabs module:

- `postgres`: Postgres with pgvector (the dev shell exports `DATABASE_URL`)
- `ricochet`: the local [OAuth relay](https://docs.kennel.scottylabs.org/guides/local-development/#oauth-relay) on `127.0.0.1:8090`. Andrew ID login won't work locally without it.
- `api`: the server on `:3001`
- `web`: Vite on [http://localhost:4173](http://localhost:4173)

Kennel's [local development guide](https://docs.kennel.scottylabs.org/guides/local-development/#local-services) covers following and stopping these processes.

By default the server talks to the deployed agent at `https://api.cmugpt-agent.scottylabs.org`. To use a local agent, run [`cmugpt-agent`](https://git.cmu.dev/ScottyLabs/cmugpt-agent) with `pitchfork start --local` and set `AGENT_API_URL=http://localhost:5055` before starting the server. The agent's README covers its own setup.

### Troubleshooting

- **Secrets fail to load after logging in.** You're probably not in the `slai` team yet (see [Before you start](#before-you-start)).
- **Server crashes on startup with a zod error.** A required variable is missing. Usually `DATABASE_URL` is unset because Postgres wasn't started through `pitchfork start --local`.

### Without Nix (not recommended)

Nix is the supported path. Without it, **Andrew ID login won't work locally**, because the `ricochet` relay it depends on is provided by Nix. You can still work on the parts that don't need login.

1. Install:

   - [Git](https://git-scm.com/downloads)
   - [Deno](https://docs.deno.com/runtime/getting_started/installation/)
   - [PostgreSQL](https://www.postgresql.org/download/) and the [pgvector extension](https://github.com/pgvector/pgvector#installation) (`brew install postgresql@17 pgvector` on macOS)
   - [OpenBao](https://openbao.org/docs/install/) (`brew install openbao` on macOS)
   - [secretspec](https://secretspec.dev/) (`curl -sSL https://install.secretspec.dev | sh`)

1. Create a database with pgvector:

   ```sh
   createdb cmugpt_surface
   psql -d cmugpt_surface -c 'CREATE EXTENSION IF NOT EXISTS vector;'
   export DATABASE_URL='postgresql:///cmugpt_surface?host=/tmp'
   export PORT=3001
   ```

1. Log in to OpenBao (needs `slai` team membership) and run with the dev secrets injected:

   ```sh
   BAO_ADDR=https://secrets.scottylabs.org bao login -method=oidc
   deno install
   secretspec run -P dev -- deno task dev
   ```

Migrations run automatically on server startup (`apps/server/src/server.ts` calls `drizzle-orm`'s `migrate()` against `apps/server/drizzle` before the Express app starts listening).

## Environment variables

Declared in [secretspec.toml](./secretspec.toml) and validated at runtime by [`apps/server/src/env.ts`](./apps/server/src/env.ts):

| Variable | Required | Description |
| -- | -- | -- |
| `DATABASE_URL` | yes | Postgres connection string |
| `OIDC_ISSUER_URL` | yes | OIDC issuer for Andrew ID SSO |
| `OIDC_CLIENT_ID` | yes (default `sl-ai-local`) | OIDC client ID |
| `OIDC_CLIENT_SECRET` | yes | OIDC client secret |
| `ALLOWED_ORIGINS_REGEX` | yes | Regex of allowed CORS origins |
| `AGENT_API_URL` | yes (default `https://api.cmugpt-agent.scottylabs.org`) | Base URL of the `cmugpt-agent` service |
| `AGENT_SHARED_SECRET` | prod only, but strongly recommended locally | App-to-app bearer secret shared with `cmugpt-agent`; **must not** use a `VITE_`-prefixed name or otherwise reach the browser. Generate with `openssl rand -hex 32`. Required to be >=32 chars with no leading/trailing whitespace in production. |
| `OAUTH_RELAY_URL` | no | Shared "ricochet" OAuth relay callback, used so preview deployments can authenticate without registering their own redirect URI |
| `PORT` / `SERVER_PORT` | no (default `80`; the `api` process sets `PORT=3001`) | API server port. `PORT` takes precedence. |
| `APP_URL` | no (default `http://localhost:4173`) | Public URL of the web app, used for OIDC callback construction |
| `ADMIN_GROUP` | no | Admin group name (stopgap until real governance wiring exists) |

See [apps/server/README.md](./apps/server/README.md) for more on the agent-connection secret.

## Common tasks

Run from the repo root (these fan out to the two workspace apps):

| Command | Description |
| -- | -- |
| `deno task dev` | Run server + web dev servers concurrently (outside pitchfork, prefix with `PORT=3001`) |
| `deno task generate` | Regenerate the OpenAPI spec/routes from server controllers (also runs automatically before `build`/`dev`) |
| `deno task build` | Build both apps for production |
| `deno task check` | Type-check both apps (`deno check`) |
| `deno task test:e2e` | Run Playwright e2e tests against the web app |
| `deno task db:generate` | Generate a new Drizzle migration from schema changes |
| `deno task db:migrate` | Apply pending migrations |

Per-app tasks (run with `deno task --cwd apps/<app> <task>`, or `cd` into the app first):

- `apps/server`: `server` (no regen), `tsoa:watch`, `openapi:watch`, `start`, `check`
- `apps/web`: `dev`, `build`, `preview`, `test` (Vitest unit tests), `check`

## Testing

- **Unit tests** (`apps/web`): `deno task --cwd apps/web test` (Vitest + Testing Library)
- **E2E tests**: `deno task test:e2e` from the repo root, powered by [playwright.config.ts](./playwright.config.ts). It boots the web dev server automatically and runs specs in `apps/web/e2e/`.
- **Type checking**: `deno task check`

## Deployment

Deployed via ScottyLabs' internal `kennel` platform (see `sites` and `services` in [flake.nix](./flake.nix)):

- Web (SPA) -> `bark.scottylabs.org`
- API service -> `api.cmugpt.com`

The API compiles to a standalone Deno binary via `deno compile`. The web app reads the API URL at runtime from `PUBLIC_API_URL`, which kennel serves as a [public value](https://docs.kennel.scottylabs.org/guides/deploying/#public-values).

## Related repos

- [`cmugpt-agent`](https://git.cmu.dev/ScottyLabs/cmugpt-agent) - the actual chat agent/LLM service this server proxies to (OpenRouter for chat, OpenAI embeddings for memory search, pgvector-backed long-term memory).

## License

Dual-licensed under [Apache-2.0](./LICENSE-APACHE-2.0) or [MIT](./LICENSE-MIT), at your option.
