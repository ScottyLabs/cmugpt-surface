import ReactMarkdown from "react-markdown";
import { CmuMapsEmbed, CmuMapsLink } from "../cmuMaps.tsx";
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
  return (
    <div className="flex justify-end">
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
  return (
    <div className={markdownClass}>
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
      <CmuMapsLink cmuMaps={m.cmuMaps} />
      <CmuMapsEmbed cmuMaps={m.cmuMaps} />
    </div>
  );
}

export function MessageList({ c }: { c: ChatShellController }) {
  const { session, stream, optimistic, scroll } = c;
  const optimisticMessage = optimistic.optimisticUserMessage;
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      {session.messages.map((m) =>
        m.role === "user" ? (
          <UserBubble key={m.id} content={m.content} />
        ) : (
          <AssistantMessage key={m.id} m={m} />
        ),
      )}
      {optimistic.shouldShowOptimisticUserMessage && optimisticMessage !== null ? (
        <UserBubble key="optimistic-user-message" content={optimisticMessage.content} />
      ) : null}
      {stream.isStreaming && (
        <div className={markdownClass}>
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
          <CmuMapsEmbed cmuMaps={stream.streamingCmuMaps} />
        </div>
      )}
      <div ref={scroll.bottomRef} />
    </div>
  );
}
