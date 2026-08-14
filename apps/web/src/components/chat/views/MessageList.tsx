import ReactMarkdown from "react-markdown";
import { MemorySavedNotice } from "@/components/MemorySavedNotice.tsx";
import { CmuMapsEmbed, CmuMapsPrefetch } from "../cmuMaps.tsx";
import {
  assistantDisplayContent,
  markdownClass,
  markdownComponents,
  markdownForReactComponent,
  rehypeMarkdownPlugins,
  remarkMarkdownPlugins,
  userBubbleMarkdownClass,
  userMarkdownComponents,
} from "../markdown.tsx";
import { StreamingStatus } from "../StreamingStatus.tsx";
import type { MessageItem } from "../types.ts";
import type { ChatShellController } from "../useChatShell.ts";

function UserBubble({ content }: { content: string }) {
  // ChatGPT-like rhythm: the largest break sits above a new question, so each
  // exchange reads as its own block.
  return (
    <div className="mt-20 flex justify-end first:mt-0">
      <div className="max-w-[85%] rounded-2xl bg-neutral-200 px-4 py-2.5 text-sm leading-relaxed text-neutral-900">
        <div className={userBubbleMarkdownClass}>
          <ReactMarkdown
            remarkPlugins={remarkMarkdownPlugins}
            rehypePlugins={rehypeMarkdownPlugins}
            components={userMarkdownComponents}
          >
            {markdownForReactComponent(content)}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

function AssistantMessage({ m }: { m: MessageItem }) {
  // Roomy but smaller than the pre-question break, so the answer still reads
  // as attached to the question above it.
  return (
    <div className={`mt-8 first:mt-0 ${markdownClass}`}>
      <ReactMarkdown
        remarkPlugins={remarkMarkdownPlugins}
        rehypePlugins={rehypeMarkdownPlugins}
        components={markdownComponents}
      >
        {markdownForReactComponent(assistantDisplayContent(m.content, m.cmuMaps))}
      </ReactMarkdown>
      {typeof m.confidence === "number" && m.confidence < 0.5 && (
        <p className="mt-2 text-xs text-amber-700">
          Low confidence: verify with an official CMU source.
        </p>
      )}
      <CmuMapsEmbed cmuMaps={m.cmuMaps} />
    </div>
  );
}

// The saved-memory chip is persisted on the message it belongs to, so it
// renders directly above that message and survives later questions, reloads,
// and leaving the chat. Explicit remembers are persisted with the answer and
// self-learned facts are attached a few seconds later.
function MessageTurn({
  m,
  onSavedMemoryDeleted,
}: {
  m: MessageItem;
  onSavedMemoryDeleted: (messageId: string) => void;
}) {
  if (m.role === "user") {
    return <UserBubble content={m.content} />;
  }
  if (m.savedMemory === null || m.savedMemory === undefined) {
    return <AssistantMessage m={m} />;
  }
  return (
    <div className="mt-8 first:mt-0">
      <MemorySavedNotice
        memory={m.savedMemory}
        onDeleted={() => {
          onSavedMemoryDeleted(m.id);
        }}
      />
      <div className="mt-2.5">
        <AssistantMessage m={m} />
      </div>
    </div>
  );
}

function StreamingTail({ stream }: { stream: ChatShellController["stream"] }) {
  return (
    <div className={`mt-8 ${markdownClass}`}>
      {stream.streamingText === "" ? (
        <StreamingStatus text={stream.streamStatus ?? "Thinking..."} />
      ) : (
        <ReactMarkdown
          remarkPlugins={remarkMarkdownPlugins}
          rehypePlugins={rehypeMarkdownPlugins}
          components={markdownComponents}
        >
          {markdownForReactComponent(stream.streamingText, {
            streaming: true,
          })}
        </ReactMarkdown>
      )}
      {/* No map is shown while the answer is still being written. This block
          and the finished message above it are separate places in the
          component tree, so anything put here is thrown away and rebuilt the
          instant the answer completes, making the map load twice. It is
          rendered once, by the finished message. Downloading it, on the other
          hand, can start right now, which is what this does. */}
      <CmuMapsPrefetch cmuMaps={stream.streamingCmuMaps} />
    </div>
  );
}

export function MessageList({ c }: { c: ChatShellController }) {
  const { session, stream, optimistic, scroll, memory } = c;
  const optimisticMessage = optimistic.optimisticUserMessage;
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col">
      {session.messages.map((m) => (
        <MessageTurn key={m.id} m={m} onSavedMemoryDeleted={memory.onSavedMemoryDeleted} />
      ))}
      {optimistic.shouldShowOptimisticUserMessage && optimisticMessage !== null ? (
        <UserBubble key="optimistic-user-message" content={optimisticMessage.content} />
      ) : null}
      {stream.isStreaming && <StreamingTail stream={stream} />}
      {/* Spacer doubles as the auto-scroll anchor: scrolling it into view
          parks the last message above the floating composer, not behind it. */}
      <div ref={scroll.bottomRef} className="h-36 shrink-0" />
    </div>
  );
}
