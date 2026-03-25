# CMU GPT Frontend

Monorepo for the CMU GPT web experience: a React (Vite) client and a Bun/Express API with OpenAPI-backed types. The stack is based on [ScottyStack](https://github.com/ScottyLabs/ScottyStack) ([full-stack type safety](https://github.com/ScottyLabs/ScottyStack/wiki/Full%E2%80%90Stack-Type%E2%80%90Safety)).

## Requirements

- [Bun](https://bun.sh/) `1.3.5` (see `package.json` → `packageManager`; install hooks enforce Bun only)
- Node compatible with the engine range in `package.json` (for tooling)

## Setup

```zsh
bun install
```

Configure environment files under `apps/web` and `apps/server` (for example `.env` and `.env.local`). The server expects variables for the database, auth, and related services—see the app sources and your team’s docs.

### Secrets (Vault)

ScottyLabs projects sync secrets from [Vault](https://github.com/ScottyLabs/wiki/wiki/Credentials#hashicorp-vault). From the repo root:

```zsh
bun run secrets:setup   # first-time Vault login helper
bun run secrets:pull    # pull configured app/env files
```

Details: [`scripts/secrets/README.md`](scripts/secrets/README.md).

## Development

Start all workspaces in dev mode (Turbo):

```zsh
bun run dev
```

- **Web**: [http://localhost:3000](http://localhost:3000) (`apps/web`)
- **Server**: runs with watch + TSOA/OpenAPI regeneration (`apps/server`)

Run a single app from its directory, for example:

```zsh
cd apps/server && bun run dev
cd apps/web && bun run dev
```

### Database (server)

From `apps/server` after env is loaded:

```zsh
bun run db:migrate
```

## Common scripts (root)

| Script | Purpose |
| --- | --- |
| `bun run build` | Production build via Turbo |
| `bun run check` | Typecheck + checks across workspaces |
| `bun run lint` / `format` | Biome via Turbo |
| `bun run generate` | Regenerate TSOA routes + OpenAPI from `apps/server` |

## Packages

| Path | Role |
| --- | --- |
| [`apps/web`](apps/web) | Vite + React + TanStack Router/Query, consumes generated API types |
| [`apps/server`](apps/server) | Express + TSOA + Drizzle + Better Auth |
| [`packages/common`](packages/common) | Shared code |

## Documentation

- [ScottyStack Wiki](https://github.com/ScottyLabs/ScottyStack/wiki) — template conventions, backend/frontend guides
- [Backend (server)](https://github.com/ScottyLabs/ScottyStack/wiki/Backend) · [Frontend (web)](https://github.com/ScottyLabs/ScottyStack/wiki/Frontend)
