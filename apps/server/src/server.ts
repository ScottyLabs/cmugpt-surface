import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import cors, { type CorsOptions } from "cors";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { ErrorRequestHandler } from "express";
import express from "express";
import swaggerUi, { type JsonObject } from "swagger-ui-express";
import { parse as parseYaml } from "yaml";
import { RegisterRoutes } from "../build/routes.ts";
import { db, pool } from "./db/index.ts";
import { env } from "./env.ts";
import { errorHandler } from "./middlewares/errorHandler.ts";
import { attachBearerFromSession, authRouter } from "./routes/authRoutes.ts";
import { notFoundHandler } from "./middlewares/notFoundHandler.ts";
import { registerChatMessageStreamRoute } from "./routes/chatMessageStreamRoute.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.join(__dirname, "../drizzle");

await migrate(db, { migrationsFolder });

// Idempotent: fixes DBs where migrations journal and actual schema diverged.
await pool.query(
  `ALTER TABLE "chats" ADD COLUMN IF NOT EXISTS "is_public" boolean DEFAULT false NOT NULL`,
);

// Server-side auth tables (BFF). Created idempotently rather than via a
// migration so the auth layer is self-contained.
await pool.query(`
  CREATE TABLE IF NOT EXISTS "auth_sessions" (
    "id" text PRIMARY KEY,
    "sub" text NOT NULL,
    "email" text,
    "given_name" text,
    "groups" jsonb,
    "access_token" text NOT NULL,
    "refresh_token" text,
    "id_token" text,
    "access_token_expires_at" timestamp,
    "expires_at" timestamp NOT NULL,
    "created_at" timestamp NOT NULL DEFAULT now(),
    "updated_at" timestamp NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS "oidc_login_states" (
    "state" text PRIMARY KEY,
    "code_verifier" text NOT NULL,
    "nonce" text NOT NULL,
    "redirect_uri" text NOT NULL,
    "return_to" text NOT NULL,
    "created_at" timestamp NOT NULL DEFAULT now(),
    "expires_at" timestamp NOT NULL
  );
`);

const app = express();
/** Chat messages may embed base64 images (markdown data URLs) in JSON `content`. */
app.use(express.json({ limit: "12mb" }));

// Parse cookies for auth flows that rely on cookies
app.use(express.urlencoded({ extended: true }));

const defaultAllowedOrigins = ["http://localhost:3000", "http://127.0.0.1:3000"];
// Define CORS options - accept from configured origins
const allowedOrigins = [
  ...defaultAllowedOrigins,
  ...env.ALLOWED_ORIGINS_REGEX.split(",").map((s) => s.trim()),
].filter(Boolean);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesAllowedOrigin(origin: string, allowedOrigin: string): boolean {
  try {
    if (origin === new URL(allowedOrigin).origin) {
      return true;
    }
  } catch {
    // Not a URL; fall through to pattern matching.
  }

  try {
    return new RegExp(allowedOrigin).test(origin);
  } catch {
    return origin === allowedOrigin || origin === `^${escapeRegExp(allowedOrigin)}$`;
  }
}

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);

    // Check if origin matches any allowed origin or regex
    const isAllowed = allowedOrigins.some((allowedOrigin) => {
      return matchesAllowedOrigin(origin, allowedOrigin);
    });

    if (isAllowed || process.env.NODE_ENV === "development") {
      callback(null, true);
    } else {
      callback(new Error(`CORS policy: origin ${origin} not allowed`));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Debug-Middleware", "X-Debug-Token-Length"],
};
app.use(cors(corsOptions));

// Server-side auth (BFF). authRouter serves /api/auth/login|callback|logout|me
// (openid-client + ricochet); attachBearerFromSession relays the session's
// access token downstream as a Bearer so the existing tsoa verifier is unchanged.
app.use(authRouter);
app.use(attachBearerFromSession);

// Create HTTP server with Express app attached
const server = http.createServer(app);

// Swagger and OpenAPI JSON. Resolve relative to this module (not cwd) so the
// path also works inside a `deno compile` binary with `--include build`.
const swaggerYaml = fs.readFileSync(path.join(__dirname, "../build/swagger.yaml"), "utf8");
const swaggerJson = parseYaml(swaggerYaml) as JsonObject;
// Serve Swagger UI only when its static assets are present on disk. They live
// in node_modules, which doesn't exist inside a `deno compile` binary, so this
// is skipped in compiled/production builds rather than crashing.
const swaggerUiDist = path.join(__dirname, "../node_modules/swagger-ui-dist");
if (fs.existsSync(swaggerUiDist)) {
  app.use(
    "/api/swagger",
    // https://github.com/scottie1984/swagger-ui-express/issues/114#issuecomment-566022730
    express.static(swaggerUiDist, { index: false }),
    swaggerUi.serve,
    swaggerUi.setup(swaggerJson),
  );
}
app.get("/api/openapi.json", (_req, res) => {
  res.status(200).send(swaggerJson);
});

// Routes
RegisterRoutes(app);
registerChatMessageStreamRoute(app);
app.get("/api", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// Serve the built frontend (SPA) when STATIC_DIR is configured. API routes are
// registered above, so they take precedence; anything unmatched falls back to
// index.html for client-side routing.
if (env.STATIC_DIR) {
  const staticDir = path.resolve(env.STATIC_DIR);
  app.use(express.static(staticDir));
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(staticDir, "index.html"));
  });
}

// Error Handling and Not Found Handlers
app.use(errorHandler as ErrorRequestHandler);
app.use(notFoundHandler);

const envPort = (process.env as { readonly PORT?: string }).PORT ?? undefined;
const port = Number(envPort) ?? env.SERVER_PORT;

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

process.on("SIGINT", () => {
  void pool.end().finally(() => process.exit());
});
