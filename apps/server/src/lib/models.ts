/**
 * Curated list of LLM models the user can pick from. The `id` is the
 * OpenRouter model slug forwarded to the agent's `/agent/respond` endpoint.
 * Surface UX assumes 4-6 options.
 */
export interface AgentModelOption {
  id: string;
  label: string;
  description: string;
}

export const AGENT_MODELS: readonly AgentModelOption[] = [
  {
    id: "openai/gpt-4o",
    label: "GPT-4o",
    description: "OpenAI flagship.",
  },
  {
    id: "openai/gpt-4o-mini",
    label: "GPT-4o Mini",
    description: "Fast and inexpensive OpenAI model.",
  },
  {
    id: "anthropic/claude-3.7-sonnet",
    label: "Claude 3.7 Sonnet",
    description: "Anthropic's flagship.",
  },
  {
    id: "anthropic/claude-3.5-haiku",
    label: "Claude 3.5 Haiku",
    description: "Fast Anthropic model.",
  },
  {
    id: "meta-llama/llama-3.3-70b-instruct",
    label: "Llama 3.3 70B",
    description: "Open-weight Meta model.",
  },
  {
    id: "google/gemini-2.0-flash-001",
    label: "Gemini 2.0 Flash",
    description: "Google's fast multimodal model.",
  },
] as const;

export const DEFAULT_MODEL_ID = AGENT_MODELS[0]?.id ?? "openai/gpt-4o";

export function isValidModelId(value: unknown): value is string {
  return typeof value === "string" && AGENT_MODELS.some((m) => m.id === value);
}
