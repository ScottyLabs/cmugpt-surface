import type { NextFunction, Request, Response } from "express";

// Maintenance switch for the API
// Remember to also toggle web maintenance variable

export const MAINTENANCE_MODE = false;

const EXEMPT_PATHS = new Set(["/api/health"]);

// Respond with 503 if maintenance mode is enabled
export function maintenanceGate(req: Request, res: Response, next: NextFunction) {
  if (!MAINTENANCE_MODE || EXEMPT_PATHS.has(req.path)) {
    next();
    return;
  }

  const detail = "Bark is temporarily unavailable for maintenance.";
  res.status(503).set("Cache-Control", "no-store").json({ error: detail, detail });
}
