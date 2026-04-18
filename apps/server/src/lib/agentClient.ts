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
}

export async function callAgent(
  request: AgentRequest,
  signal?: AbortSignal,
): Promise<string> {
  const url = `${env.AGENT_API_URL.replace(/\/$/, "")}/agent/respond`;

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

  const init: RequestInit = {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  };
  if (signal !== undefined) {
    init.signal = signal;
  }

  const res = await fetch(url, init);

  if (!res.ok) {
    let msg = `Agent request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) {
        msg = body.error;
      }
    } catch {
      /* ignore */
    }
    throw new InternalServerError(msg);
  }

  const body = (await res.json()) as AgentResponseBody;
  const text = body.response_text;
  if (typeof text !== "string" || !text.trim()) {
    throw new InternalServerError("Empty agent response");
  }
  return text;
}
