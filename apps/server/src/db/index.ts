import process from "node:process";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { env } from "../env.ts";
import * as schema from "./schema.ts";

// Kennel and devenv expose Postgres over a unix socket, and devenv's
// DATABASE_URL (postgresql:///db?host=/run/.../postgres) omits the port. Handing
// that straight to pg makes it default to 5432 and miss devenv's actual socket
// (e.g. .s.PGSQL.5433). So prefer the discrete PG* env vars — which carry the
// real PGPORT — then the socket URL (letting pg read PGPORT), then a plain
// connection string. Mirrors ScottyLabs/dalmatian src/db/client.ts.
const UNIX_SOCKET_URL = /^postgresql:\/\/(?:[^@/]*@)?\/([^?]+)\?host=(.+)$/;

function createPool(): pg.Pool {
  const pgHost = process.env.PGHOST;
  const pgDatabase = process.env.PGDATABASE;
  if (pgHost && pgDatabase) {
    // Omitting the port lets pg pick it up from PGPORT (or default 5432).
    return new pg.Pool({ host: pgHost, database: pgDatabase });
  }

  const match = env.DATABASE_URL.match(UNIX_SOCKET_URL);
  if (match) {
    const [, database, host] = match;
    return new pg.Pool({ host, database });
  }

  return new pg.Pool({ connectionString: env.DATABASE_URL });
}

const pool = createPool();

export const db = drizzle(pool, { schema });

export { pool };
