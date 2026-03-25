# Server (`@cmugpt-frontend/server`)

Bun API for CMU GPT: Express, [TSOA](https://tsoa-community.github.io/docs/) controllers, OpenAPI/Swagger, [Drizzle ORM](https://orm.drizzle.team/) (Postgres), and [Better Auth](https://www.better-auth.com/). Part of the [ScottyStack](https://github.com/ScottyLabs/ScottyStack/wiki/Backend) backend pattern.

## Prerequisites

- Bun
- Postgres reachable via `DATABASE_URL`

## Environment

Load order for scripts that use `dotenv-cli`: `.env` then `.env.local` (local overrides).

Validated variables are defined in [`src/env.ts`](src/env.ts), including:

| Variable | Notes |
| --- | --- |
| `SERVER_URL` | Public base URL of this API |
| `SERVER_PORT` | Listen port (default in schema: `80`) |
| `ALLOWED_ORIGINS_REGEX` | CORS allowlist pattern |
| `AUTH_*` | OIDC / auth client (`AUTH_ISSUER`, `AUTH_CLIENT_ID`, `AUTH_CLIENT_SECRET`, `AUTH_JWKS_URI`) |
| `BETTER_AUTH_URL` | [Better Auth](https://www.better-auth.com/docs/installation#set-environment-variables) URL |
| `DATABASE_URL` | Postgres connection URL |
| `LLM_API_KEY` | LLM provider key |
| `LLM_*` | Optional model/base URL/referrer/app name (see schema defaults) |
| `ADMIN_GROUP` | IdP group claim for admin-capable users (default: `cmugpt-prod`) |

Use repo-root [`scripts/secrets`](../../scripts/secrets) or copy from team docs if you do not manage Vault locally.

## Scripts

| Script | Purpose |
| --- | --- |
| `bun run dev` | Watch server, regenerate TSOA routes + `build/swagger.yaml`, refresh OpenAPI TypeScript types |
| `bun run server` | Server only (`--watch`), with dotenv |
| `bun run generate` | `tsoa spec-and-routes` + `openapi-typescript` → `build/swagger.d.ts` |
| `bun run build` | Generate then bundle `src/server.ts` to `dist/` |
| `bun run start` | Run `dist/server.js` |
| `bun run db:generate` | Drizzle migrations SQL |
| `bun run db:migrate` | Apply migrations (uses `.env` + `.env.local`) |
| `bun run check` / `lint` / `format` | `tsc` + Biome |

## HTTP / docs

- After a successful `bun run generate`, Swagger UI is served at `/swagger` and `GET /openapi.json` returns the spec.
- Align `SERVER_PORT` with what the web app expects in dev: the Vite dev server proxies API routes to `VITE_DEV_API_ORIGIN` (default `http://localhost:8080` in `apps/web`).

## Related

- [Backend wiki](https://github.com/ScottyLabs/ScottyStack/wiki/Backend)
- Monorepo root [README](../../README.md)
