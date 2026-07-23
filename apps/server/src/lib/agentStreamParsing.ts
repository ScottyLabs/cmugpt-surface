import { InternalServerError } from "../middlewares/errorHandler.ts";
import type {
  AgentCmuMapsBody,
  AgentResponseBody,
  AgentResult,
  AgentStreamEvent,
  CmuMapsPayload,
} from "./agentClient.ts";

export function isAgentResponseBody(value: unknown): value is AgentResponseBody {
  return (
    typeof value === "object" &&
    value !== null &&
    "response_text" in value &&
    typeof value.response_text === "string"
  );
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export function normalizeCmuMaps(raw: unknown): CmuMapsPayload | null {
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
  return Object.values(payload).some((value) => value !== null) ? payload : null;
}

export function agentBodyToResult(body: AgentResponseBody): AgentResult {
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

function parseSseBlock(block: string): { event: string; data: unknown } | null {
  let event = "message";
  const dataLines: string[] = [];

  for (const rawLine of block.split(/\r?\n/u)) {
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

function extractTextField(data: unknown): string | null {
  if (
    typeof data === "object" &&
    data !== null &&
    "text" in data &&
    typeof data.text === "string"
  ) {
    return data.text;
  }
  return null;
}

function normalizeAgentStreamEvent(parsed: {
  event: string;
  data: unknown;
}): AgentStreamEvent | null {
  if (parsed.event === "status") {
    const text = extractTextField(parsed.data);
    return text === null ? null : { type: "status", text };
  }

  if (parsed.event === "map") {
    const cmuMaps = normalizeCmuMaps(parsed.data);
    return cmuMaps ? { type: "map", cmuMaps } : null;
  }

  if (parsed.event === "delta") {
    const text = extractTextField(parsed.data);
    return text === null ? null : { type: "delta", text };
  }

  if (parsed.event === "done" && typeof parsed.data === "object" && parsed.data !== null) {
    const body = isAgentResponseBody(parsed.data) ? parsed.data : { response_text: "" };
    return { type: "done", result: agentBodyToResult(body) };
  }

  if (parsed.event === "error" && typeof parsed.data === "object" && parsed.data !== null) {
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

export async function* readAgentStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): AsyncGenerator<AgentStreamEvent, void, undefined> {
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    // oxlint-disable-next-line no-await-in-loop -- each read depends on stream position from the previous one
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split(/\r?\n\r?\n/u);
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
