import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import process from "node:process";
import cors, { type CorsOptions } from "cors";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { ErrorRequestHandler } from "express";
import express from "express";
import { apiReference } from "@scalar/express-api-reference";
import { parse as parseYaml } from "yaml";
import { RegisterRoutes } from "../build/routes.ts";
import { db, pool } from "./db/index.ts";
import { env } from "./env.ts";
import { errorHandler } from "./middlewares/errorHandler.ts";
import { attachBearerFromSession, authRouter } from "./routes/authRoutes.ts";
import { isAllowedOrigin } from "./lib/allowedOrigins.ts";
import { maintenanceGate } from "./maintenance.ts";
import { notFoundHandler } from "./middlewares/notFoundHandler.ts";
import { registerChatMessageStreamRoute } from "./routes/chatMessageStreamRoute.ts";

const moduleDir = import.meta.dirname;
if (moduleDir === undefined) {
  throw new Error("import.meta.dirname is unavailable");
}
const migrationsFolder = path.join(moduleDir, "../drizzle");

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
    "web_origin" text NOT NULL DEFAULT '',
    "created_at" timestamp NOT NULL DEFAULT now(),
    "expires_at" timestamp NOT NULL
  );
`);
await pool.query(
  `ALTER TABLE "oidc_login_states" ADD COLUMN IF NOT EXISTS "web_origin" text NOT NULL DEFAULT ''`,
);

const app = express();
/** Chat messages may embed base64 images (markdown data URLs) in JSON `content`. */
app.use(express.json({ limit: "12mb" }));

// Parse cookies for auth flows that rely on cookies
app.use(express.urlencoded({ extended: true }));

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or Postman)
    if (origin === undefined || origin === "") {
      callback(null, true);
      return;
    }

    if (isAllowedOrigin(origin) || process.env.NODE_ENV === "development") {
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

// Maintenance gate
app.use(maintenanceGate);

// Server-side auth (BFF). authRouter serves /api/auth/login|callback|logout|me
// (openid-client + ricochet); attachBearerFromSession relays the session's
// access token downstream as a Bearer so the existing tsoa verifier is unchanged.
app.use(authRouter);
app.use(attachBearerFromSession);

// Create HTTP server with Express app attached
const server = http.createServer((req, res) => {
  app(req, res);
});

// OpenAPI spec. Resolve relative to this module (not cwd) so the path also
// works inside a `deno compile` binary with `--include build`.
const openApiYaml = fs.readFileSync(path.join(moduleDir, "../build/swagger.yaml"), "utf8");
const openApiSpec: unknown = parseYaml(openApiYaml);
app.get("/api/openapi.json", (_req, res) => {
  res.status(200).send(openApiSpec);
});
// Scalar API reference UI, rendered from the spec at /api/openapi.json. Needs
// no on-disk assets, so it also works inside a `deno compile` binary.
app.use("/api/scalar", apiReference({ url: "/api/openapi.json" }));

// Routes
RegisterRoutes(app);
registerChatMessageStreamRoute(app);
app.get("/api", (_req, res) => {
  res.status(200).json({ status: "ok" });
});
app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});
// Error Handling and Not Found Handlers
app.use(errorHandler as ErrorRequestHandler);
app.use(notFoundHandler);

const envPort = (process.env as { readonly PORT?: string }).PORT;
const port = envPort === undefined || envPort === "" ? env.SERVER_PORT : Number(envPort);

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

process.on("SIGINT", () => {
  void pool.end().finally(() => process.exit());
});
