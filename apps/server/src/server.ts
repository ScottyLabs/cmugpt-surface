import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { YAML } from "bun";
import cors, { type CorsOptions } from "cors";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { ErrorRequestHandler } from "express";
import express from "express";
import swaggerUi, { type JsonObject } from "swagger-ui-express";
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

const defaultAllowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];
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
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Debug-Middleware",
    "X-Debug-Token-Length",
  ],
};
app.use(cors(corsOptions));

// Create HTTP server with Express app attached
const server = http.createServer(app);

// Swagger and OpenAPI JSON
const swaggerYaml = fs.readFileSync("./build/swagger.yaml", "utf8");
const swaggerJson = YAML.parse(swaggerYaml) as JsonObject;
app.use(
  "/swagger",
  // https://github.com/scottie1984/swagger-ui-express/issues/114#issuecomment-566022730
  express.static(path.join(__dirname, "../node_modules/swagger-ui-dist"), {
    index: false,
  }),
  swaggerUi.serve,
  swaggerUi.setup(swaggerJson),
);
app.get("/openapi.json", (_req, res) => {
  res.status(200).send(swaggerJson);
});

// Routes
RegisterRoutes(app);
registerChatMessageStreamRoute(app);
app.get("/", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

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
