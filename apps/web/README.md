# Web (`@cmugpt-frontend/web`)

CMU GPT client: [Vite](https://vitejs.dev/) + React 19, [TanStack Router](https://tanstack.com/router/latest) and [TanStack Query](https://tanstack.com/query/latest), [Tailwind CSS v4](https://tailwindcss.com/), and types derived from the server’s OpenAPI spec. Auth uses [Better Auth](https://www.better-auth.com/) with the server. Follows the [ScottyStack frontend](https://github.com/ScottyLabs/ScottyStack/wiki/Frontend) layout.

## Prerequisites

- Bun
- API running with a matching OpenAPI build when you change server routes (see `generate:api`)

## Environment

- **`VITE_DEV_API_ORIGIN`** — Where Vite should proxy API traffic in development (default: `http://localhost:8080`). Set this to match the server’s `SERVER_URL` host/port so `/api`, `/me`, `/chats`, etc. reach the backend. The proxy forwards same-origin requests from the browser so session cookies work.

Other `VITE_*` variables may be required for your deployment; check `src` and `.env` examples from your team.

## Scripts

| Script | Purpose |
| --- | --- |
| `bun run dev` | Vite on port **3000**, all interfaces (`--host`) |
| `bun run generate:api` | Runs `bun run generate` in `../server` (TSOA + `openapi-typescript` for the client) |
| `bun run build` | Regenerate API types, Vite production build, `tsc` |
| `bun run preview` | Serve the production build locally |
| `bun run test` | Vitest (`vitest run`) |
| `bun run check` / `lint` / `format` | `tsc` + Biome |

## Development notes

- Open [http://localhost:3000](http://localhost:3000) in dev.
- Proxied paths (see `vite.config.ts`) include `/api`, `/chats`, `/me`, `/hello`, `/swagger`, and `/openapi.json`.
- The workspace depends on `@cmugpt-frontend/server` so route/types generation stays in sync with the API package.

## Related

- [Frontend wiki](https://github.com/ScottyLabs/ScottyStack/wiki/Frontend)
- Monorepo root [README](../../README.md)
