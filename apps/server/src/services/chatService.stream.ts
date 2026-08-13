import { eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import { chats, messages } from "../db/schema.ts";
import { type AgentStreamEvent, type callAgent, streamAgent } from "../lib/agentClient.ts";
import { agentUserId } from "../lib/agentUserId.ts";
import type {
  ChatStreamEvent,
  CmuMapsDto,
  MessageDto,
  SavedMemoryDto,
} from "./chatService.types.ts";
import { messageRowToDto } from "./chatService.helpers.ts";

interface StreamCollectResult {
  result: Awaited<ReturnType<typeof callAgent>> | undefined;
  streamedText: string;
  streamedCmuMaps: CmuMapsDto | null;
  streamedSavedMemory: SavedMemoryDto | null;
  errored: boolean;
}

/** Track the chip a turn should carry: an explicit remember supplies the
 *  fact to persist, a forget clears any pending chip. */
function savedMemoryFromEvent(
  ev: Extract<AgentStreamEvent, { type: "memory" }>,
  current: SavedMemoryDto | null,
): SavedMemoryDto | null {
  if (ev.op === "add" && ev.id !== undefined && ev.fact !== undefined) {
    return { id: ev.id, kind: ev.kind ?? "remembered", fact: ev.fact };
  }
  if (ev.op === "remove") {
    return null;
  }
  return current;
}

export async function* runAgentStream(
  content: string,
  messageHistory: { role: string; content: string }[],
  userSub: string,
  preferredModel: string,
  disabledTools: string[],
  signal: AbortSignal | undefined,
): AsyncGenerator<ChatStreamEvent, StreamCollectResult, undefined> {
  let result: Awaited<ReturnType<typeof callAgent>> | undefined;
  let streamedText = "";
  let streamedCmuMaps: CmuMapsDto | null = null;
  let streamedSavedMemory: SavedMemoryDto | null = null;
  const request = {
    query: content,
    ...(messageHistory.length > 0 && { messageHistory }),
    userId: agentUserId(userSub),
    model: preferredModel,
    ...(disabledTools.length > 0 && { disabledTools }),
  };
  try {
    for await (const ev of streamAgent(request, signal)) {
      if (ev.type === "status") {
        yield { type: "status", text: ev.text };
      } else if (ev.type === "memory") {
        streamedSavedMemory = savedMemoryFromEvent(ev, streamedSavedMemory);
        yield ev;
      } else if (ev.type === "map") {
        streamedCmuMaps = ev.cmuMaps;
        yield { type: "map", cmuMaps: ev.cmuMaps };
      } else if (ev.type === "delta") {
        streamedText += ev.text;
        yield { type: "delta", text: ev.text };
      } else if (ev.type === "done") {
        ({ result } = ev);
      } else if (ev.type === "error") {
        yield { type: "error", message: ev.message };
        return { result, streamedText, streamedCmuMaps, streamedSavedMemory, errored: true };
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Agent request failed";
    yield { type: "error", message: msg };
    return { result, streamedText, streamedCmuMaps, streamedSavedMemory, errored: true };
  }
  return { result, streamedText, streamedCmuMaps, streamedSavedMemory, errored: false };
}

/** Persist a streamed answer with its map and chip. Undefined means the
 *  insert returned no row. */
async function persistStreamedReply(
  chatId: string,
  finalResult: Awaited<ReturnType<typeof callAgent>>,
  finalCmuMaps: CmuMapsDto | null,
  streamedSavedMemory: SavedMemoryDto | null,
): Promise<MessageDto | undefined> {
  const [assistantRow] = await db
    .insert(messages)
    .values({
      chatId,
      role: "assistant",
      content: finalResult.text,
      cmuMaps: finalResult.cmuMaps ?? finalCmuMaps,
      savedMemory: streamedSavedMemory,
    })
    .returning();

  await db.update(chats).set({ updatedAt: new Date() }).where(eq(chats.id, chatId));

  if (assistantRow === undefined) {
    return undefined;
  }
  const finalMessage: MessageDto = messageRowToDto(assistantRow);
  if (typeof finalResult.confidence === "number") {
    finalMessage.confidence = finalResult.confidence;
  }
  return finalMessage;
}

export async function* finalizeAssistantMessage(
  chatId: string,
  result: Awaited<ReturnType<typeof callAgent>> | undefined,
  streamedText: string,
  streamedCmuMaps: CmuMapsDto | null,
  streamedSavedMemory: SavedMemoryDto | null,
): AsyncGenerator<ChatStreamEvent, void, undefined> {
  let finalResult = result;
  if (finalResult === undefined) {
    if (!streamedText.trim()) {
      yield {
        type: "error",
        message: "Agent stream ended without a response",
      };
      return;
    }
    // The stream died before the agent's final event. Keep the partial text
    // but mark it, instead of persisting it as a complete answer.
    const truncationNote = "\n\n_(This response was cut off before completing.)_";
    yield { type: "delta", text: truncationNote };
    finalResult = { text: streamedText + truncationNote };
  } else if (!streamedText) {
    yield { type: "delta", text: finalResult.text };
  }

  let finalCmuMaps = streamedCmuMaps;
  if (finalResult.cmuMaps && finalCmuMaps === null) {
    finalCmuMaps = finalResult.cmuMaps;
    yield { type: "map", cmuMaps: finalResult.cmuMaps };
  }

  const finalMessage = await persistStreamedReply(
    chatId,
    finalResult,
    finalCmuMaps,
    streamedSavedMemory,
  );
  if (finalMessage === undefined) {
    yield { type: "error", message: "Failed to persist assistant message" };
    return;
  }
  yield { type: "done", message: finalMessage };
}
