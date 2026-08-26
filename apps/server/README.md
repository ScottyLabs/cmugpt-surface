# Server

See [Backend Documentation](https://github.com/ScottyLabs/ScottyStack/wiki/Backend).

## Bark agent connection

Set `AGENT_API_URL` to the agent service and set `AGENT_SHARED_SECRET` to the
same random 32+ character value configured on that service. The secret is an
application-to-application bearer token: it belongs only in this server's
environment and must never use a `VITE_` prefix or be sent to the browser.

Generate a local value with:

```sh
openssl rand -hex 32
```

Production startup fails when this secret is missing or too short. Authenticated
Clerk subjects are deterministically hashed before being sent to the agent, so
the browser cannot select or enumerate another user's memory namespace.

The memory manager exposes only durable learned facts and facts the user
explicitly asked Bark to remember. It never returns raw chat turns.
