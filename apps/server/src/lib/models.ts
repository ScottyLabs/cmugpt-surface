/**
 * Curated list of LLM models the user can pick from. The `id` is the
 * OpenRouter model slug forwarded to the agent's `/agent/respond` endpoint.
 * Surface UX assumes 4-6 options.
 *
 * Every entry is the current best price-to-performance pick of its provider,
 * and every entry must support tool calling: the agent binds the CMU MCP
 * tools, so a model without tool support cannot answer campus questions. The
 * first entry is the default for new users.
 */
export interface AgentModelOption {
  id: string;
  label: string;
}

export const AGENT_MODELS: readonly AgentModelOption[] = [
  { id: "openai/gpt-5.6-luna", label: "GPT-5.6 Luna" },
  { id: "deepseek/deepseek-v4-flash", label: "DeepSeek V4 Flash" },
  { id: "z-ai/glm-5.2", label: "GLM 5.2" },
  { id: "minimax/minimax-m3", label: "MiniMax M3" },
  { id: "anthropic/claude-haiku-4.5", label: "Claude Haiku 4.5" },
  { id: "google/gemini-3.5-flash-lite", label: "Gemini 3.5 Flash Lite" },
] as const;

export const DEFAULT_MODEL_ID = AGENT_MODELS[0]?.id ?? "openai/gpt-5.6-luna";

export function isValidModelId(value: string): boolean {
  return AGENT_MODELS.some((m) => m.id === value);
}
