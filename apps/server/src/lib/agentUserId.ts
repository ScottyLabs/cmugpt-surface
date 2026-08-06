import { createHash } from "node:crypto";

/**
 * Convert an authenticated identity into the agent's safe, stable namespace.
 *
 * Subjects can contain characters that cannot be passed through verbatim:
 * PostgreSQL's LangGraph namespace lookup uses LIKE semantics, where `_` is a
 * wildcard. A deterministic hex digest is stable across chats and contains only
 * characters allowed by the agent. The raw identity never reaches the agent.
 */
export function agentUserId(userSub: string): string {
  const digest = createHash("sha256")
    .update(`oidc:${userSub}`, "utf8")
    .digest("hex");
  return `oidc:${digest}`;
}
