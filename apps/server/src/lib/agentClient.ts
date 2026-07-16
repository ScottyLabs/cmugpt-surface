/** biome-ignore-all lint/style/useNamingConvention: cmugpt-agent uses snake_case JSON */
import { env } from "../env.ts";
import { InternalServerError } from "../middlewares/errorHandler.ts";

interface AgentRequest {
  query: string;
  messageHistory?: { role: string; content: string }[];
  userId?: string;
  /** OpenRouter model slug forwarded to the agent. Falls back to the
   *  agent's own default when omitted. */
  model?: string;
}

interface AgentResponseBody {
  response_text: string;
  thought?: { reasoning?: string; confidence?: number };
  services_used?: string[];
  cmu_maps?: AgentCmuMapsBody | null;
}

interface AgentCmuMapsBody {
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

interface AgentMemoryBody {
  items?: unknown;
  total?: unknown;
  limit?: unknown;
  offset?: unknown;
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

function buildAgentPayload(request: AgentRequest): {
  query: string;
  message_history?: { role: string; content: string }[];
  user_id?: string;
  model?: string;
} {
  const payload: {
    query: string;
    message_history?: { role: string; content: string }[];
    user_id?: string;
    model?: string;
  } = { query: request.query };
  if (request.messageHistory !== undefined) {
    payload.message_history = request.messageHistory;
  }
  if (request.userId !== undefined) {
    payload.user_id = request.userId;
  }
  if (request.model !== undefined) {
    payload.model = request.model;
  }
  return payload;
}

function buildAgentHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (env.AGENT_SHARED_SECRET) {
    headers["authorization"] = `Bearer ${env.AGENT_SHARED_SECRET}`;
  }
  return headers;
}

async function readAgentError(res: Response): Promise<string> {
  let msg = `Agent request failed (${res.status})`;
  try {
    // Agent emits {error, detail}; older versions emitted only {error};
    // FastAPI defaults emit only {detail}. Try all of them.
    const body = (await res.json()) as { error?: string; detail?: string };
    msg = body.error ?? body.detail ?? msg;
  } catch {
    /* ignore */
  }
  return msg;
}

function agentBodyToResult(body: AgentResponseBody): AgentResult {
  const text = body.response_text;
  if (typeof text !== "string" || !text.trim()) {
    throw new InternalServerError("Empty agent response");
  }
  const result: AgentResult = { text };
  if (typeof body.thought?.confidence === "number") {
    result.confidence = body.thought.confidence;
  }
  if (Array.isArray(body.services_used)) {
    result.servicesUsed = body.services_used;
  }
  result.cmuMaps = normalizeCmuMaps(body.cmu_maps);
  return result;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function normalizeCmuMaps(raw: unknown): CmuMapsPayload | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }
  const body = raw as AgentCmuMapsBody;
  const url = nullableString(body.url);
  const payload: CmuMapsPayload = {
    url,
    mode: nullableString(body.mode),
    target: nullableString(body.target),
    targetLabel: nullableString(body.target_label),
    src: nullableString(body.src),
    srcLabel: nullableString(body.src_label),
    dest: nullableString(body.dest),
    destLabel: nullableString(body.dest_label),
  };
  return Object.values(payload).some((value) => value !== null)
    ? payload
    : null;
}

export async function callAgent(
  request: AgentRequest,
  signal?: AbortSignal,
): Promise<AgentResult> {
  const url = `${env.AGENT_API_URL.replace(/\/$/, "")}/agent/respond`;

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

  const body = (await res.json()) as AgentResponseBody;
  return agentBodyToResult(body);
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
  const base = env.AGENT_API_URL.replace(/\/$/, "");
  const res = await fetch(
    `${base}/memory/${encodeURIComponent(userId)}?${params.toString()}`,
    { headers: buildAgentHeaders() },
  );
  if (!res.ok) {
    throw new InternalServerError(await readAgentError(res));
  }
  const body = (await res.json()) as AgentMemoryBody;
  const rawItems = Array.isArray(body.items) ? body.items : [];
  return {
    items: rawItems
      .map((item) => normalizeMemoryItem(item))
      .filter((item): item is AgentMemoryItem => item !== null),
    total: typeof body.total === "number" ? body.total : 0,
    limit: typeof body.limit === "number" ? body.limit : (options.limit ?? 200),
    offset:
      typeof body.offset === "number" ? body.offset : (options.offset ?? 0),
  };
}

export async function deleteAgentMemory(
  userId: string,
  kind: AgentMemoryType,
  itemId: string,
): Promise<void> {
  const base = env.AGENT_API_URL.replace(/\/$/, "");
  const res = await fetch(
    `${base}/memory/${encodeURIComponent(userId)}/items/${kind}/${encodeURIComponent(itemId)}`,
    { method: "DELETE", headers: buildAgentHeaders() },
  );
  if (!res.ok) {
    throw new InternalServerError(await readAgentError(res));
  }
}

export async function clearAgentMemory(userId: string): Promise<number> {
  const base = env.AGENT_API_URL.replace(/\/$/, "");
  const res = await fetch(`${base}/memory/${encodeURIComponent(userId)}`, {
    method: "DELETE",
    headers: buildAgentHeaders(),
  });
  if (!res.ok) {
    throw new InternalServerError(await readAgentError(res));
  }
  const body = (await res.json()) as { removed?: unknown };
  return typeof body.removed === "number" ? body.removed : 0;
}

function parseSseBlock(block: string): { event: string; data: unknown } | null {
  let event = "message";
  const dataLines: string[] = [];

  for (const rawLine of block.split(/\r?\n/)) {
    if (!rawLine || rawLine.startsWith(":")) {
      continue;
    }
    const sep = rawLine.indexOf(":");
    const field = sep === -1 ? rawLine : rawLine.slice(0, sep);
    const rawValue = sep === -1 ? "" : rawLine.slice(sep + 1);
    const value = rawValue.startsWith(" ") ? rawValue.slice(1) : rawValue;
    if (field === "event") {
      event = value;
    } else if (field === "data") {
      dataLines.push(value);
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  const rawData = dataLines.join("\n");
  try {
    return { event, data: JSON.parse(rawData) };
  } catch {
    return { event, data: rawData };
  }
}

function normalizeAgentStreamEvent(parsed: {
  event: string;
  data: unknown;
}): AgentStreamEvent | null {
  if (
    parsed.event === "status" &&
    typeof parsed.data === "object" &&
    parsed.data !== null &&
    "text" in parsed.data &&
    typeof parsed.data.text === "string"
  ) {
    return { type: "status", text: parsed.data.text };
  }

  if (parsed.event === "map") {
    const cmuMaps = normalizeCmuMaps(parsed.data);
    if (cmuMaps) {
      return { type: "map", cmuMaps };
    }
    return null;
  }

  if (
    parsed.event === "memory" &&
    typeof parsed.data === "object" &&
    parsed.data !== null
  ) {
    const data = parsed.data as Record<string, unknown>;
    const op = data["op"];
    const text = data["text"];
    if ((op !== "add" && op !== "remove") || typeof text !== "string") {
      return null;
    }
    const event: Extract<AgentStreamEvent, { type: "memory" }> = {
      type: "memory",
      op,
      text,
    };
    if (typeof data["id"] === "string") event.id = data["id"];
    if (data["kind"] === "learned" || data["kind"] === "remembered") {
      event.kind = data["kind"];
    }
    if (typeof data["fact"] === "string") event.fact = data["fact"];
    return event;
  }

  if (
    parsed.event === "delta" &&
    typeof parsed.data === "object" &&
    parsed.data !== null &&
    "text" in parsed.data &&
    typeof parsed.data.text === "string"
  ) {
    return { type: "delta", text: parsed.data.text };
  }

  if (
    parsed.event === "done" &&
    typeof parsed.data === "object" &&
    parsed.data !== null
  ) {
    return {
      type: "done",
      result: agentBodyToResult(parsed.data as AgentResponseBody),
    };
  }

  if (
    parsed.event === "error" &&
    typeof parsed.data === "object" &&
    parsed.data !== null
  ) {
    const data = parsed.data as { error?: unknown; detail?: unknown };
    const message =
      typeof data.error === "string"
        ? data.error
        : typeof data.detail === "string"
          ? data.detail
          : "Agent stream failed";
    return { type: "error", message };
  }

  return null;
}

export async function* streamAgent(
  request: AgentRequest,
  signal?: AbortSignal,
): AsyncGenerator<AgentStreamEvent, void, undefined> {
  const url = `${env.AGENT_API_URL.replace(/\/$/, "")}/agent/respond/stream`;

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
  if (!res.body) {
    throw new InternalServerError("Agent stream response had no body");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() ?? "";

    for (const block of blocks) {
      const parsed = parseSseBlock(block);
      const event = parsed ? normalizeAgentStreamEvent(parsed) : null;
      if (event) {
        yield event;
      }
    }
  }

  buffer += decoder.decode();
  const parsed = buffer.trim() ? parseSseBlock(buffer) : null;
  const event = parsed ? normalizeAgentStreamEvent(parsed) : null;
  if (event) {
    yield event;
  }
}
