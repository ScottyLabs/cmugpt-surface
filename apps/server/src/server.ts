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
import { notFoundHandler } from "./middlewares/notFoundHandler.ts";
import { registerChatMessageStreamRoute } from "./routes/chatMessageStreamRoute.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.join(__dirname, "../drizzle");

await migrate(db, { migrationsFolder });

// Idempotent: fixes DBs where migrations journal and actual schema diverged.
await pool.query(
  `ALTER TABLE "chats" ADD COLUMN IF NOT EXISTS "is_public" boolean DEFAULT false NOT NULL`,
);

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

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);

    // Check if origin matches any allowed origin or regex
    const isAllowed = allowedOrigins.some((allowedOrigin) => {
      try {
        // Try as regex first
        const regex = new RegExp(allowedOrigin);
        return regex.test(origin);
      } catch {
        // If not valid regex, do exact match
        return origin === allowedOrigin;
      }
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
