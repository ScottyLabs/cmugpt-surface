import type { ComponentProps, RefObject } from "react";
import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";
import { CmuMapsEmbed, CmuMapsLink } from "@/components/CmuMapsEmbed.tsx";
import { SendIcon } from "@/components/icons/ChatIcons.tsx";
import type { CmuMapsPayload, PendingAttachment } from "@/lib/chatUtils.ts";
import {
  assistantDisplayContent,
  markdownForReactComponent,
  rehypeKatexWithGuards,
  STICKY_SCROLL_THRESHOLD_PX,
} from "@/lib/chatUtils.ts";

interface MessageItem {
  id: string;
  role: string;
  content: string;
  cmuMaps?: CmuMapsPayload | null;
  confidence?: number | null;
}

function StreamingStatus({ text }: { text: string }) {
  const label = text.replace(/\.+$/, "");
  return (
    <output
      aria-live="polite"
      aria-label={text}
      className="-mt-1 block font-normal text-neutral-400 text-sm leading-relaxed motion-safe:animate-pulse"
    >
      {label}
    </output>
  );
}

interface ChatMessagesProps {
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  bottomRef: RefObject<HTMLDivElement | null>;
  shouldStickToBottomRef: RefObject<boolean | null>;
  shouldShowConversation: boolean;
  showMessagesLoading: boolean;
  messages: MessageItem[];
  chatsLoading: boolean;
  chatId: string | undefined;
  isNewChatIntent: boolean;
  shouldShowOptimisticUserMessage: boolean;
  optimisticUserMessage: {
    chatId: string;
    content: string;
    messageCountBeforeSend: number;
  } | null;
  isStreaming: boolean;
  streamingText: string;
  streamStatus: string | null;
  activeCmuMaps: CmuMapsPayload | null;
  draftComposerRef: RefObject<HTMLTextAreaElement | null>;
  draft: string;
  setDraft: (s: string) => void;
  setAttachmentHint: (hint: string | null) => void;
  canEditChat: boolean;
  onSend: () => void;
  createChatIsPending: boolean;
  pendingAttachments: PendingAttachment[];
}

export function ChatMessages({
  scrollContainerRef,
  bottomRef,
  shouldStickToBottomRef,
  shouldShowConversation,
  showMessagesLoading,
  messages,
  chatsLoading,
  chatId,
  isNewChatIntent,
  shouldShowOptimisticUserMessage,
  optimisticUserMessage,
  isStreaming,
  streamingText,
  streamStatus,
  activeCmuMaps,
  draftComposerRef,
  draft,
  setDraft,
  setAttachmentHint,
  canEditChat,
  onSend,
  createChatIsPending,
  pendingAttachments,
}: ChatMessagesProps) {
  const remarkPlugins = useMemo(() => [remarkMath, remarkGfm], []);

  const rehypePlugins = useMemo(
    () =>
      [[rehypeKatexWithGuards, { strict: "ignore" }]] as NonNullable<
        ComponentProps<typeof ReactMarkdown>["rehypePlugins"]
      >,
    [],
  );

  const markdownComponents = useMemo(
    () =>
      ({
        a: ({
          href,
          children,
          ...props
        }: ComponentProps<"a"> & { href?: string }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
            {children}
            <span className="text-xs" aria-hidden={true}>
              ↗
            </span>
          </a>
        ),
      }) satisfies ComponentProps<typeof ReactMarkdown>["components"],
    [],
  );

  const userMarkdownComponents = useMemo(
    () =>
      ({
        img: ({ alt, ...props }: ComponentProps<"img">) => (
          <img
            alt={alt ?? ""}
            {...props}
            className="my-1 max-h-48 max-w-full rounded-lg object-contain"
          />
        ),
        a: ({
          href,
          children,
          ...props
        }: ComponentProps<"a"> & { href?: string }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
            {children}
          </a>
        ),
        p: ({ className, ...props }: ComponentProps<"p">) => (
          <p
            {...props}
            className={["my-1.5 first:mt-0 last:mb-0", className]
              .filter(Boolean)
              .join(" ")}
          />
        ),
      }) satisfies ComponentProps<typeof ReactMarkdown>["components"],
    [],
  );

  const markdownClass = [
    "max-w-none text-sm leading-relaxed text-neutral-800",
    "[&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
    "[&_h2]:mb-2 [&_h2]:mt-5 [&_h2:first-child]:mt-0 [&_h2]:border-b [&_h2]:border-neutral-200 [&_h2]:pb-1 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-neutral-950",
    "[&_h3]:mb-1.5 [&_h3]:mt-4 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-neutral-950",
    "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5",
    "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5",
    "[&_li]:pl-1 [&_li>p]:my-1 [&_li>ol]:mt-1 [&_li>ul]:mt-1",
    "[&_strong]:font-semibold [&_strong]:text-neutral-950",
    "[&_a]:inline-flex [&_a]:items-center [&_a]:gap-0.5 [&_a]:font-medium [&_a]:text-red-800 [&_a]:underline [&_a]:decoration-red-800/40 [&_a]:underline-offset-2 [&_a:hover]:decoration-red-800",
    "[&_:not(pre)>code]:rounded [&_:not(pre)>code]:bg-neutral-100 [&_:not(pre)>code]:px-1 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:text-[0.92em] [&_:not(pre)>code]:font-medium [&_:not(pre)>code]:text-neutral-900",
    "[&_pre]:my-3 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:border [&_pre]:border-neutral-200 [&_pre]:bg-neutral-950 [&_pre]:p-3 [&_pre]:text-[13px] [&_pre]:leading-relaxed [&_pre]:text-neutral-50 [&_pre]:shadow-sm",
    "[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-inherit",
    "[&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm",
    "[&_th]:border-b [&_th]:border-neutral-300 [&_th]:bg-neutral-50 [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-semibold",
    "[&_td]:border-b [&_td]:border-neutral-200 [&_td]:px-2 [&_td]:py-1.5 [&_td]:align-top",
    "[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-neutral-300 [&_blockquote]:pl-3 [&_blockquote]:text-neutral-600",
    "[&_.katex-display]:my-3 [&_.katex-display]:block [&_.katex-display]:overflow-x-auto [&_.katex]:text-[1em]",
  ].join(" ");

  const userBubbleMarkdownClass =
    "max-w-none [&_.katex-display]:my-2 [&_.katex-display]:block [&_.katex-display]:overflow-x-auto [&_.katex]:text-[0.95em] [&_pre]:my-2 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-black/5 [&_pre]:p-2 [&_pre]:text-xs [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-4 [&_strong]:font-semibold";

  return (
    <div
      ref={scrollContainerRef}
      className="min-h-0 flex-1 overflow-y-auto px-4 py-6 flex flex-col justify-center"
      onScroll={(e) => {
        const el = e.currentTarget;
        shouldStickToBottomRef.current =
          el.scrollHeight - el.scrollTop - el.clientHeight <=
          STICKY_SCROLL_THRESHOLD_PX;
      }}
    >
      {!shouldShowConversation &&
        !chatsLoading &&
        !chatId &&
        !isNewChatIntent && (
          <div className="flex flex-col gap-6 max-w-3xl mx-auto w-full">
            <div className="flex flex-col items-start gap-2">
              <h1 className="text-left text-[2.81rem] font-medium text-black leading-8">
                Hi there!
              </h1>
              <p className="text-left text-2xl font-medium text-black">
                Welcome to CMUGPT...
              </p>
            </div>

            <div className="flex flex-col max-w-3xl gap-[0.625rem] rounded-[1.875rem] bg-white px-6 py-4 shadow-[0_0_24px_0_var(--color-brandneutral-secondary-enabled),0_0_6px_0_rgba(158,177,194,0.55)]">
              <div className="flex items-end gap-2">
                <textarea
                  ref={draftComposerRef}
                  rows={1}
                  placeholder="How can I help you today?"
                  value={draft}
                  disabled={isStreaming || (Boolean(chatId) && !canEditChat)}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    setAttachmentHint(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void onSend();
                    }
                  }}
                  className="min-h-[7.625rem] max-h-40 flex-1 resize-none bg-transparent py-2 text-sm font-normal leading-snug text-neutral-900 outline-none placeholder:text-fg-neutral-secondary placeholder:font-normal disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => onSend()}
                  disabled={
                    isStreaming ||
                    createChatIsPending ||
                    (Boolean(chatId) && !canEditChat) ||
                    (!draft.trim() && pendingAttachments.length === 0)
                  }
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-neutral-200 disabled:opacity-35"
                  aria-label="Send"
                >
                  <SendIcon />
                </button>
              </div>
            </div>

            <div className="flex justify-center items-center gap-3">
              {[
                "What time does Hunan close today?",
                "Plan my Fall 26 schedule",
                "Navigate me from Tepper to Rotunda Hall",
              ].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setDraft(s);
                    draftComposerRef.current?.focus();
                  }}
                  className="whitespace-nowrap flex items-center justify-center gap-2 rounded-[6.25rem] bg-neutral-secondary-enabled px-4 py-[0.5625rem] text-sm font-semibold text-fg-neutral-primary hover:bg-neutral-200 shadow-sm"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      {showMessagesLoading ? (
        <p className="text-neutral-500 text-sm">Loading messages…</p>
      ) : null}
      {shouldShowConversation && !showMessagesLoading && (
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl bg-neutral-200 px-4 py-2.5 text-sm leading-relaxed text-neutral-900">
                  <div className={userBubbleMarkdownClass}>
                    <ReactMarkdown
                      remarkPlugins={remarkPlugins}
                      rehypePlugins={rehypePlugins}
                      components={userMarkdownComponents}
                    >
                      {markdownForReactComponent(m.content)}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            ) : (
              <div key={m.id} className={markdownClass}>
                <ReactMarkdown
                  remarkPlugins={remarkPlugins}
                  rehypePlugins={rehypePlugins}
                  components={markdownComponents}
                >
                  {markdownForReactComponent(
                    assistantDisplayContent(m.content, m.cmuMaps),
                  )}
                </ReactMarkdown>
                {typeof m.confidence === "number" && m.confidence < 0.5 && (
                  <p className="mt-2 text-xs text-amber-700">
                    Low confidence — verify with an official CMU source.
                  </p>
                )}
                <CmuMapsLink cmuMaps={m.cmuMaps} />
              </div>
            ),
          )}
          {shouldShowOptimisticUserMessage && optimisticUserMessage ? (
            <div key="optimistic-user-message" className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl bg-neutral-200 px-4 py-2.5 text-sm leading-relaxed text-neutral-900">
                <div className={userBubbleMarkdownClass}>
                  <ReactMarkdown
                    remarkPlugins={remarkPlugins}
                    rehypePlugins={rehypePlugins}
                    components={userMarkdownComponents}
                  >
                    {markdownForReactComponent(optimisticUserMessage.content)}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          ) : null}
          {isStreaming && !streamingText && (
            <StreamingStatus text={streamStatus ?? "Thinking..."} />
          )}
          {isStreaming && streamingText.length > 0 && (
            <div className={markdownClass}>
              <ReactMarkdown
                remarkPlugins={remarkPlugins}
                rehypePlugins={rehypePlugins}
                components={markdownComponents}
              >
                {markdownForReactComponent(streamingText, { streaming: true })}
              </ReactMarkdown>
            </div>
          )}
          {/* Single stable slot for the active CMU Maps iframe */}
          <CmuMapsEmbed cmuMaps={activeCmuMaps} />
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}
