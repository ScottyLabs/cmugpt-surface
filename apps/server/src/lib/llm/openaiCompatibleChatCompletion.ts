import { InternalServerError } from "../../middlewares/errorHandler.ts";
import type { ChatCompletionPort, ChatMessage } from "./chatCompletionPort.ts";

interface OpenAiChatCompletionResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string };
}

interface OpenAiChatCompletionStreamChunk {
  choices?: Array<{
    delta?: { content?: string | null };
  }>;
  error?: { message?: string };
}

export class OpenaiCompatibleChatCompletion implements ChatCompletionPort {
  constructor(
    private readonly config: {
      baseUrl: string;
      apiKey: string;
      model: string;
      httpReferer?: string;
      appName?: string;
    },
  ) {}

  async complete(input: {
    messages: ChatMessage[];
    signal?: AbortSignal;
  }): Promise<string> {
    const base = this.config.baseUrl.replace(/\/$/, "");
    const headers: Record<string, string> = {
      authorization: `Bearer ${this.config.apiKey}`,
      "content-type": "application/json",
    };
    if (this.config.httpReferer) {
      headers["http-referer"] = this.config.httpReferer;
    }
    if (this.config.appName) {
      headers["x-title"] = this.config.appName;
    }

    const init: RequestInit = {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: this.config.model,
        messages: input.messages,
        stream: false,
      }),
    };
    if (input.signal !== undefined) {
      init.signal = input.signal;
    }
    const res = await fetch(`${base}/chat/completions`, init);

    const raw = (await res.json()) as OpenAiChatCompletionResponse;
    if (!res.ok) {
      const msg = raw.error?.message ?? `LLM request failed (${res.status})`;
      throw new InternalServerError(msg);
    }

    const text = raw.choices?.[0]?.message?.content;
    if (typeof text !== "string" || text.length === 0) {
      throw new InternalServerError("Empty LLM response");
    }
    return text;
  }

  async *completeStream(input: {
    messages: ChatMessage[];
    signal?: AbortSignal;
  }): AsyncGenerator<string, void, undefined> {
    const base = this.config.baseUrl.replace(/\/$/, "");
    const headers: Record<string, string> = {
      authorization: `Bearer ${this.config.apiKey}`,
      "content-type": "application/json",
    };
    if (this.config.httpReferer) {
      headers["http-referer"] = this.config.httpReferer;
    }
    if (this.config.appName) {
      headers["x-title"] = this.config.appName;
    }

    const init: RequestInit = {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: this.config.model,
        messages: input.messages,
        stream: true,
      }),
    };
    if (input.signal !== undefined) {
      init.signal = input.signal;
    }
    const res = await fetch(`${base}/chat/completions`, init);

    if (!res.ok) {
      let msg = `LLM request failed (${res.status})`;
      try {
        const raw = (await res.json()) as OpenAiChatCompletionResponse;
        if (raw.error?.message) {
          msg = raw.error.message;
        }
      } catch {
        /* ignore */
      }
      throw new InternalServerError(msg);
    }

    const { body } = res;
    if (!body) {
      throw new InternalServerError("Empty LLM stream body");
    }

    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === "data: [DONE]") {
            continue;
          }
          if (!trimmed.startsWith("data: ")) {
            continue;
          }
          const payload = trimmed.slice(6);
          let chunk: OpenAiChatCompletionStreamChunk;
          try {
            chunk = JSON.parse(payload) as OpenAiChatCompletionStreamChunk;
          } catch {
            continue;
          }
          if (chunk.error?.message) {
            throw new InternalServerError(chunk.error.message);
          }
          const piece = chunk.choices?.[0]?.delta?.content;
          if (typeof piece === "string" && piece.length > 0) {
            yield piece;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
