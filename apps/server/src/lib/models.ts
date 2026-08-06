/**
 * Curated list of LLM models the user can pick from. The `id` is the
 * OpenRouter model slug forwarded to the agent's `/agent/respond` endpoint.
 * Surface UX assumes 4-6 options.
 *
 * Every entry is the current mini / low-cost tier of its provider, and every
 * entry must support tool calling: the agent binds the CMU MCP tools, so a
 * model without tool support cannot answer campus questions. The first entry
 * is the default for new users.
 */
export interface AgentModelOption {
  id: string;
  label: string;
}

export const AGENT_MODELS: readonly AgentModelOption[] = [
  { id: "openai/gpt-5.4-mini", label: "GPT-5.4 Mini" },
  { id: "openai/gpt-5.4-nano", label: "GPT-5.4 Nano" },
  { id: "anthropic/claude-haiku-4.5", label: "Claude Haiku 4.5" },
  { id: "google/gemini-3.5-flash-lite", label: "Gemini 3.5 Flash Lite" },
  { id: "qwen/qwen3.7-flash", label: "Qwen3.7 Flash" },
  { id: "mistralai/mistral-small-2603", label: "Mistral Small 4" },
] as const;

export const DEFAULT_MODEL_ID = AGENT_MODELS[0]?.id ?? "openai/gpt-5.4-mini";

export function isValidModelId(value: string): boolean {
  return AGENT_MODELS.some((m) => m.id === value);
}
