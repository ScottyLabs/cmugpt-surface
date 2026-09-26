# Bark Surface (cmugpt-surface)

Bark Surface is the user-facing web app and BFF (backend-for-frontend) API for
**Bark**, ScottyLabs' CMU-focused AI chat assistant. It handles authentication,
chat history, memory management, and streams chat responses from the
[`cmugpt-agent`](../cmugpt-agent) service, which does the actual agent/LLM
work.

This repo is built on
[ScottyStack](https://github.com/ScottyLabs/ScottyStack/wiki), ScottyLabs'
[full-stack typesafe](https://github.com/ScottyLabs/ScottyStack/wiki/Full%E2%80%90Stack-Type%E2%80%90Safety)
template, so the general ScottyStack docs also apply here. This README covers
what's specific to this project.

## Repo structure

This is a [Deno workspace](./deno.json) with two apps and no separate agent
code - the actual chat/LLM logic lives in the sibling `cmugpt-agent` repo.

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
|-- nix/, devenv.nix, flake.nix    # Nix/devenv dev environment + build packages
|-- scripts/secrets/               # git submodule: secrets-sync-scripts
`-- secretspec.toml                # declares required env vars / secrets
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
| API server | Express 5, [tsoa](https://tsoa-community.github.io/docs/) (decorators to OpenAPI + routes), Zod |
| Database | PostgreSQL + [pgvector](https://github.com/pgvector/pgvector) (semantic memory search), [Drizzle ORM](https://orm.drizzle.team/) + drizzle-kit |
| Auth | OIDC (Andrew ID SSO) via `openid-client`/`jwks-rsa`, plus lightweight server-side sessions (better-auth-shaped tables) |
| Frontend | React 19, Vite, [TanStack Router](https://tanstack.com/router) + [TanStack Query](https://tanstack.com/query), Tailwind CSS v4 |
| API contract | Auto-generated OpenAPI spec, consumed via `openapi-fetch` + `openapi-react-query` |
| Testing | Vitest (unit, web), Playwright (e2e, `apps/web/e2e`) |
| Dev environment | [devenv](https://devenv.sh/) + Nix, via ScottyLabs' internal `kennel` devenv modules |
| Secrets | [secretspec](https://secretspec.dev/) - local `.env` or ScottyLabs' OpenBao vault |
| CI/CD | Forgejo Actions, reusing `ScottyLabs/kennel`'s shared CI workflow |

## Before you start

Complete the ScottyLabs setup on
[docs.scottylabs.org](https://docs.scottylabs.org/getting-started.html) first:

1. **A git.cmu.dev account with SSH set up.** See
   [Forgejo Setup](https://docs.scottylabs.org/scottylabs/onboarding/forgejo-setup.html).
2. **Membership in the `slai` team.** [Contributing](https://docs.scottylabs.org/scottylabs/onboarding/contributing.html)
   explains how to join a team through
   [governance](https://git.cmu.dev/ScottyLabs/governance): add your
   git.cmu.dev username to `members` in `data/teams/slai.toml` and open a PR.
   This membership is what grants read access to the project's dev secrets
   (OIDC client, agent secret, and so on) in OpenBao. Without it you can log
   in, but secrets fail to load. [Credentials](https://docs.scottylabs.org/scottylabs/platform/credentials.html)
   and Kennel's [Secrets guide](https://docs.kennel.scottylabs.org/guides/secrets.html)
   describe how these secrets are stored and loaded.
3. **Nix and devenv** (below). The shell provides Deno, Postgres with pgvector,
   the local login relay, `bao`, and `secretspec`, so you don't need to
   install those yourself. You only need [Git](https://git-scm.com/downloads).

### Installing Nix and devenv

1. [Nix](https://install.determinate.systems), with the Determinate Systems
   installer on macOS, Linux, or WSL:

   ```sh
   curl -fsSL https://install.determinate.systems/nix | sh -s -- install
   ```

2. [devenv](https://devenv.sh/getting-started/), from a new terminal:

   ```sh
   nix profile install nixpkgs#devenv
   ```

3. Optionally, [direnv](https://github.com/direnv/direnv/blob/master/docs/installation.md)
   with its [shell hook](https://github.com/direnv/direnv/blob/master/docs/hook.md),
   so the environment loads when you `cd` into the repo.

### Logging in to OpenBao (once per machine)

The devenv shell loads secrets from ScottyLabs' OpenBao as it starts, so it
**won't build until you're logged in**. Log in once with the standalone
command (it runs before you have `bao` installed):

```sh
nix run git+https://git.cmu.dev/ScottyLabs/kennel#login
```

A browser window opens for ScottyLabs SSO. The token renews each time you enter
the shell, so you only need to log in again on a new machine or after 90 days
without using it.

## Running it

### With devenv (recommended)

```sh
git clone ssh://forgejo@git.cmu.dev/ScottyLabs/cmugpt-surface.git
cd cmugpt-surface
devenv shell   # or `direnv allow` if you use direnv
devenv up
```

Don't clone with `--recurse-submodules`. `scripts/secrets` is a legacy
submodule from the old Vault setup that points at a GitHub SSH URL, and you
don't need it.

`devenv shell` only builds the environment and loads secrets. `devenv up`
starts every process defined in [devenv.nix](./devenv.nix) and the shared
ScottyLabs module:

- `postgres`: Postgres with pgvector (devenv exports `DATABASE_URL`)
- `ricochet`: the local OAuth relay on `127.0.0.1:8090`. Andrew ID login
  won't work locally without it.
- `api`: the server on `:3001`
- `web`: Vite on [http://localhost:4173](http://localhost:4173)

To run the apps yourself (for example, to see their output in your own
terminal), start only the supporting services and run Deno in another devenv
shell:

```sh
devenv up postgres ricochet            # terminal 1
deno install && PORT=3001 deno task dev # terminal 2
```

`PORT=3001` matters: devenv only sets it for its own `api` process, and without
it the server falls back to port 80, which the Vite dev proxy doesn't target.

By default the server talks to the deployed agent at
`https://api.cmugpt-agent.scottylabs.org`. To use a local agent, run
[`cmugpt-agent`](https://git.cmu.dev/ScottyLabs/cmugpt-agent) with `devenv up`
and set `AGENT_API_URL=http://localhost:5055` before starting the server. The
agent's README covers its own setup.

### Troubleshooting

- **Shell fails with an OpenBao, secretspec, or permission error.** Your
  OpenBao token is missing or expired: re-run the `nix run ...#login` command
  above. If login works but secrets still fail, you're probably not in the
  `slai` team yet (see [Before you start](#before-you-start)).
- **Check which secrets resolve** (reports whether each is present, never the
  values): `secretspec check -P dev`
- **Server crashes on startup with a zod error.** A required variable is
  missing. Usually `DATABASE_URL` is unset because Postgres wasn't started
  through `devenv up`.
- **See full startup logs:** `devenv --no-tui shell`

### Without devenv (not recommended)

Nix is the supported path. Without it, **Andrew ID login won't work locally**,
because the `ricochet` relay it depends on is provided by Nix. You can still
work on the parts that don't need login.

1. Install:

   - [Git](https://git-scm.com/downloads)
   - [Deno](https://docs.deno.com/runtime/getting_started/installation/)
   - [PostgreSQL](https://www.postgresql.org/download/) and the
     [pgvector extension](https://github.com/pgvector/pgvector#installation)
     (`brew install postgresql@17 pgvector` on macOS)
   - [OpenBao](https://openbao.org/docs/install/) (`brew install openbao` on
     macOS)
   - [secretspec](https://secretspec.dev/)
     (`curl -sSL https://install.secretspec.dev | sh`)

2. Create a database with pgvector:

   ```sh
   createdb cmugpt_surface
   psql -d cmugpt_surface -c 'CREATE EXTENSION IF NOT EXISTS vector;'
   export DATABASE_URL='postgresql:///cmugpt_surface?host=/tmp'
   export PORT=3001
   ```

3. Log in to OpenBao (needs `slai` team membership) and run with the dev
   secrets injected:

   ```sh
   BAO_ADDR=https://secrets.scottylabs.org bao login -method=oidc
   deno install
   secretspec run -P dev -- deno task dev
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
| `AGENT_SHARED_SECRET` | prod only, but strongly recommended locally | App-to-app bearer secret shared with `cmugpt-agent`; **must not** use a `VITE_`-prefixed name or otherwise reach the browser. Generate with `openssl rand -hex 32`. Required to be >=32 chars with no leading/trailing whitespace in production. |
| `OAUTH_RELAY_URL` | no | Shared "ricochet" OAuth relay callback, used so preview deployments can authenticate without registering their own redirect URI |
| `PORT` / `SERVER_PORT` | no (default `80`; devenv sets `PORT=3001`) | API server port. `PORT` takes precedence. |
| `APP_URL` | no (default `http://localhost:4173`) | Public URL of the web app, used for OIDC callback construction |
| `ADMIN_GROUP` | no | Admin group name (stopgap until real governance wiring exists) |

See [apps/server/README.md](./apps/server/README.md) for more on the
agent-connection secret.

## Common tasks

Run from the repo root (these fan out to the two workspace apps):

| Command | Description |
|---|---|
| `deno task dev` | Run server + web dev servers concurrently (outside `devenv up`, prefix with `PORT=3001`) |
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

- Web (SPA) -> `bark.scottylabs.org`
- API service -> `api.cmugpt.com`

[flake.nix](./flake.nix) defines Nix packages (`web`, `api`) used to build
production artifacts - the API compiles to a standalone Deno binary via
`deno compile`.

## Related repos

- [`cmugpt-agent`](../cmugpt-agent) - the actual chat agent/LLM service this
  server proxies to (OpenRouter for chat, OpenAI embeddings for memory
  search, pgvector-backed long-term memory).

## License

Dual-licensed under [Apache-2.0](./LICENSE-APACHE-2.0) or
[MIT](./LICENSE-MIT), at your option.
