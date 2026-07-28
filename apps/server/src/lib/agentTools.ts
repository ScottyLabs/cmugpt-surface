/**
 * CMU tool groups the Surface lets a user switch off. Each id matches the
 * prefix on the agent's MCP tool names (`maps_get_path`, `eats_get_all_...`),
 * and the agent drops every tool in a disabled group before binding its
 * toolset, so the model cannot call one at all.
 */
export const AGENT_TOOL_IDS = ["maps", "courses", "eats", "guide"] as const;

export type AgentToolId = (typeof AGENT_TOOL_IDS)[number];

function isAgentToolId(value: unknown): value is AgentToolId {
  return typeof value === "string" && AGENT_TOOL_IDS.some((id) => id === value);
}

/**
 * Normalize a client-supplied disabled-tool list: keep only known ids, drop
 * duplicates. Unknown entries are ignored rather than rejected — a stale client
 * naming a tool this server hasn't heard of should still get an answer.
 */
export function sanitizeDisabledToolIds(value: unknown): AgentToolId[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<AgentToolId>();
  for (const entry of value) {
    if (isAgentToolId(entry)) {
      seen.add(entry);
    }
  }
  return [...seen];
}
