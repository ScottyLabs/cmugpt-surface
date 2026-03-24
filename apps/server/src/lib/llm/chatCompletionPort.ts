export type ChatMessageRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatMessageRole;
  content: string;
}

export interface ChatCompletionPort {
  complete(input: {
    messages: ChatMessage[];
    signal?: AbortSignal;
  }): Promise<string>;

  /** Text deltas from an OpenAI-compatible streaming chat completion. */
  completeStream(input: {
    messages: ChatMessage[];
    signal?: AbortSignal;
  }): AsyncGenerator<string, void, undefined>;
}
