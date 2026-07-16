import { createHash } from "node:crypto";

/**
 * Convert an authenticated identity into the agent's safe, stable namespace.
 *
 * Clerk subjects commonly contain underscores, which cannot be passed through:
 * PostgreSQL's LangGraph namespace lookup uses LIKE semantics, where `_` is a
 * wildcard. A deterministic hex digest is stable across chats and contains only
 * characters allowed by the agent. The raw identity never reaches the agent.
 */
export function agentUserId(userSub: string): string {
  const digest = createHash("sha256")
    .update(`clerk:${userSub}`, "utf8")
    .digest("hex");
  return `clerk:${digest}`;
}
