/** biome-ignore-all lint/style/useNamingConvention: cmugpt-agent uses snake_case JSON */
import { env } from "../env.ts";
import { InternalServerError } from "../middlewares/errorHandler.ts";
import { agentBodyToResult, isAgentResponseBody, readAgentStream } from "./agentStreamParsing.ts";

interface AgentRequest {
  query: string;
  messageHistory?: { role: string; content: string }[];
  userId?: string;
  /** OpenRouter model slug forwarded to the agent. Falls back to the
   *  agent's own default when omitted. */
  model?: string;
  /** CMU tool groups the user switched off. The agent removes their tools
   *  before binding its toolset, so the model cannot call them. */
  disabledTools?: string[];
}

export interface AgentResponseBody {
  response_text: string;
  thought?: { reasoning?: string; confidence?: number };
  services_used?: string[];
  cmu_maps?: AgentCmuMapsBody | null;
}

export interface AgentCmuMapsBody {
  url?: string | null;
  mode?: string | null;
  target?: string | null;
  target_label?: string | null;
  src?: string | null;
  src_label?: string | null;
  dest?: string | null;
  dest_label?: string | null;
}

export interface CmuMapsPayload {
  url: string | null;
  mode: string | null;
  target: string | null;
  targetLabel: string | null;
  src: string | null;
  srcLabel: string | null;
  dest: string | null;
  destLabel: string | null;
}

export interface AgentResult {
  text: string;
  confidence?: number;
  servicesUsed?: string[];
  cmuMaps?: CmuMapsPayload | null;
}

export type AgentMemoryType = "learned" | "remembered";

export interface AgentMemoryItem {
  id: string;
  type: AgentMemoryType;
  text: string;
  createdAt: string;
}

export interface AgentMemoryPage {
  items: AgentMemoryItem[];
  total: number;
  limit: number;
  offset: number;
}

export type AgentStreamEvent =
  | { type: "status"; text: string }
  | {
      type: "memory";
      op: "add" | "remove";
      text: string;
      id?: string;
      kind?: AgentMemoryType;
      fact?: string;
    }
  | { type: "map"; cmuMaps: CmuMapsPayload }
  | { type: "delta"; text: string }
  | { type: "done"; result: AgentResult }
  | { type: "error"; message: string };

interface AgentPayload {
  query: string;
  message_history?: { role: string; content: string }[];
  user_id?: string;
  model?: string;
  disabled_tools?: string[];
}

function buildAgentPayload(request: AgentRequest): AgentPayload {
  const payload: AgentPayload = { query: request.query };
  if (request.messageHistory !== undefined) {
    payload.message_history = request.messageHistory;
  }
  if (request.userId !== undefined) {
    payload.user_id = request.userId;
  }
  if (request.model !== undefined) {
    payload.model = request.model;
  }
  if (request.disabledTools !== undefined && request.disabledTools.length > 0) {
    payload.disabled_tools = request.disabledTools;
  }
  return payload;
}

function buildAgentHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (env.AGENT_SHARED_SECRET !== undefined && env.AGENT_SHARED_SECRET !== "") {
    headers["authorization"] = `Bearer ${env.AGENT_SHARED_SECRET}`;
  }
  return headers;
}

async function readAgentError(res: Response): Promise<string> {
  let msg = `Agent request failed (${res.status})`;
  try {
    // The agent emits {error, detail}. Older versions emitted only {error},
    // and FastAPI defaults emit only {detail}. Try all of them.
    const raw: unknown = await res.json();
    if (typeof raw === "object" && raw !== null) {
      const error = "error" in raw && typeof raw.error === "string" ? raw.error : undefined;
      const detail = "detail" in raw && typeof raw.detail === "string" ? raw.detail : undefined;
      msg = error ?? detail ?? msg;
    }
  } catch {
    /* ignore */
  }
  return msg;
}

async function postToAgent(
  path: string,
  request: AgentRequest,
  signal?: AbortSignal,
): Promise<Response> {
  const url = `${env.AGENT_API_URL.replace(/\/$/u, "")}${path}`;
  const init: RequestInit = {
    method: "POST",
    headers: buildAgentHeaders(),
    body: JSON.stringify(buildAgentPayload(request)),
  };
  if (signal !== undefined) {
    init.signal = signal;
  }
  const res = await fetch(url, init);
  if (!res.ok) {
    throw new InternalServerError(await readAgentError(res));
  }
  return res;
}

/** Fetch an agent path with shared-secret headers, throwing on non-2xx. */
async function agentFetch(path: string, method: "GET" | "DELETE" = "GET"): Promise<Response> {
  const url = `${env.AGENT_API_URL.replace(/\/$/u, "")}${path}`;
  const res = await fetch(url, { method, headers: buildAgentHeaders() });
  if (!res.ok) {
    throw new InternalServerError(await readAgentError(res));
  }
  return res;
}

function normalizeMemoryItem(value: unknown): AgentMemoryItem | null {
  if (typeof value !== "object" || value === null) return null;
  const item = value as Record<string, unknown>;
  if (
    typeof item["id"] !== "string" ||
    (item["type"] !== "learned" && item["type"] !== "remembered") ||
    typeof item["text"] !== "string" ||
    typeof item["created_at"] !== "string"
  ) {
    return null;
  }
  return {
    id: item["id"],
    type: item["type"],
    text: item["text"],
    createdAt: item["created_at"],
  };
}

export async function listAgentMemories(
  userId: string,
  options: {
    q?: string;
    kind?: AgentMemoryType;
    limit?: number;
    offset?: number;
  } = {},
): Promise<AgentMemoryPage> {
  const params = new URLSearchParams();
  if (options.q) params.set("q", options.q);
  if (options.kind) params.set("kind", options.kind);
  params.set("limit", String(options.limit ?? 200));
  params.set("offset", String(options.offset ?? 0));
  const res = await agentFetch(`/memory/${encodeURIComponent(userId)}?${params.toString()}`);
  const body = (await res.json()) as Record<string, unknown>;
  const rawItems = Array.isArray(body.items) ? body.items : [];
  return {
    items: rawItems
      .map((item) => normalizeMemoryItem(item))
      .filter((item): item is AgentMemoryItem => item !== null),
    total: typeof body.total === "number" ? body.total : 0,
    limit: typeof body.limit === "number" ? body.limit : (options.limit ?? 200),
    offset: typeof body.offset === "number" ? body.offset : (options.offset ?? 0),
  };
}

export async function deleteAgentMemory(
  userId: string,
  kind: AgentMemoryType,
  itemId: string,
): Promise<void> {
  await agentFetch(
    `/memory/${encodeURIComponent(userId)}/items/${kind}/${encodeURIComponent(itemId)}`,
    "DELETE",
  );
}

export async function clearAgentMemory(userId: string): Promise<number> {
  const res = await agentFetch(`/memory/${encodeURIComponent(userId)}`, "DELETE");
  const body = (await res.json()) as { removed?: unknown };
  return typeof body.removed === "number" ? body.removed : 0;
}

export async function callAgent(request: AgentRequest, signal?: AbortSignal): Promise<AgentResult> {
  const res = await postToAgent("/agent/respond", request, signal);
  const raw: unknown = await res.json();
  return agentBodyToResult(isAgentResponseBody(raw) ? raw : { response_text: "" });
}

export async function* streamAgent(
  request: AgentRequest,
  signal?: AbortSignal,
): AsyncGenerator<AgentStreamEvent, void, undefined> {
  const res = await postToAgent("/agent/respond/stream", request, signal);
  if (!res.body) {
    throw new InternalServerError("Agent stream response had no body");
  }
  yield* readAgentStream(res.body.getReader());
}

/** Ask the agent for a short chat title from the chat's first user message.
 *  Returns null on any failure so the caller keeps its placeholder title. */
export async function fetchChatTitle(firstMessage: string): Promise<string | null> {
  try {
    const url = `${env.AGENT_API_URL.replace(/\/$/u, "")}/agent/title`;
    const res = await fetch(url, {
      method: "POST",
      headers: buildAgentHeaders(),
      body: JSON.stringify({ query: firstMessage }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.warn(`title: agent returned ${res.status}, keeping placeholder`);
      return null;
    }
    const data: unknown = await res.json();
    const title =
      typeof data === "object" && data !== null ? (data as { title?: unknown }).title : undefined;
    return typeof title === "string" && title.trim() !== "" ? title.trim() : null;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`title: request failed (${msg}), keeping placeholder`);
    return null;
  }
}
