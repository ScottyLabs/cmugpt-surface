import type { RequestHandler } from "express";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Reject state-changing requests whose Origin is not allowed.
 *
 * The session cookie is SameSite=None because the web app and API are on
 * different sites, so browsers attach it to requests from any page. CORS only
 * hides responses; it does not stop a page from sending a request. Browsers
 * send Origin on every cross-site POST, PUT, PATCH, and DELETE. Non-browser
 * clients send none and carry no ambient cookie, so they pass.
 */
export function rejectCrossSiteWrites(
  isAllowedOrigin: (origin: string) => boolean,
): RequestHandler {
  return (req, res, next) => {
    const origin = req.get("origin");
    if (SAFE_METHODS.has(req.method) || origin === undefined || isAllowedOrigin(origin)) {
      next();
      return;
    }
    res.status(403).json({ message: "Cross-site request rejected." });
  };
}
