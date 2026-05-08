/** biome-ignore-all lint/style/useNamingConvention: cmugpt-agent uses snake_case JSON */
import { env } from "../env.ts";
import { InternalServerError } from "../middlewares/errorHandler.ts";

interface AgentRequest {
  query: string;
  messageHistory?: { role: string; content: string }[];
  userId?: string;
}

interface AgentResponseBody {
  response_text: string;
  thought?: { reasoning?: string; confidence?: number };
  services_used?: string[];
}

export interface AgentResult {
  text: string;
  confidence?: number;
  servicesUsed?: string[];
}

export type AgentStreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; result: AgentResult }
  | { type: "error"; message: string };

function buildAgentPayload(request: AgentRequest): {
  query: string;
  message_history?: { role: string; content: string }[];
  user_id?: string;
} {
  const payload: {
    query: string;
    message_history?: { role: string; content: string }[];
    user_id?: string;
  } = { query: request.query };
  if (request.messageHistory !== undefined) {
    payload.message_history = request.messageHistory;
  }
  if (request.userId !== undefined) {
    payload.user_id = request.userId;
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
  return result;
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
