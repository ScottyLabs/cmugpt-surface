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

export type AgentStreamEvent =
  | { type: "status"; text: string }
  | { type: "map"; cmuMaps: CmuMapsPayload }
  | { type: "delta"; text: string }
  | { type: "done"; result: AgentResult }
  | { type: "error"; message: string };

interface AgentPayload {
  query: string;
  message_history?: { role: string; content: string }[];
  user_id?: string;
  model?: string;
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
    // Agent emits {error, detail}; older versions emitted only {error};
    // FastAPI defaults emit only {detail}. Try all of them.
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
