import { useAuth } from "react-oidc-context";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { ExternalLink, LockOpen, Search } from "lucide-react";
import type { ChangeEvent, ComponentProps, KeyboardEvent } from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";
import { env } from "@/env.ts";
import { $api } from "@/lib/api/client.ts";
import { ModelSelector } from "./ModelSelector.tsx";

const routeApi = getRouteApi("/");

function SidebarPanelIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden={true}
    >
      <title>Sidebar panel</title>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="9" y1="4" x2="9" y2="20" />
    </svg>
  );
}

const MAX_ATTACHMENTS = 8;
const MAX_IMAGE_BYTES = 512 * 1024;
const MAX_TEXT_FILE_BYTES = 400 * 1024;

const TEXT_FILE_EXTENSIONS = new Set([
  "txt",
  "md",
  "json",
  "csv",
  "xml",
  "tsx",
  "ts",
  "jsx",
  "js",
  "mjs",
  "cjs",
  "css",
  "html",
  "htm",
  "yml",
  "yaml",
  "toml",
  "sh",
  "env",
  "rs",
  "go",
  "java",
  "kt",
  "swift",
  "py",
  "rb",
  "php",
]);

interface PendingAttachment {
  id: string;
  file: File;
  /** Revoke with URL.revokeObjectURL when removed or sent */
  previewUrl?: string;
}

function fileExtension(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

function isTextLikeFile(file: File): boolean {
  const t = file.type;
  if (t.startsWith("text/")) {
    return true;
  }
  if (
    t === "application/json" ||
    t === "application/xml" ||
    t === "application/javascript" ||
    t === "application/typescript" ||
    t === "application/x-yaml"
  ) {
    return true;
  }
  return TEXT_FILE_EXTENSIONS.has(fileExtension(file.name));
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error ?? new Error("Read failed"));
    r.readAsText(file);
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error ?? new Error("Read failed"));
    r.readAsDataURL(file);
  });
}

function codeFenceForBody(body: string, lang: string): string {
  const useTilde = body.includes("```");
  const open = useTilde ? "~~~" : "```";
  const close = useTilde ? "~~~" : "```";
  return lang
    ? `${open}${lang}\n${body}\n${close}`
    : `${open}\n${body}\n${close}`;
}

function codeLangFromFilename(name: string): string {
  const ext = fileExtension(name);
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "tsx",
    js: "javascript",
    jsx: "jsx",
    mjs: "javascript",
    cjs: "javascript",
    json: "json",
    md: "markdown",
    py: "python",
    yml: "yaml",
    yaml: "yaml",
    sh: "bash",
    rs: "rust",
    go: "go",
    html: "html",
    htm: "html",
    css: "css",
    xml: "xml",
  };
  return map[ext] ?? ext;
}

/**
 * Map LLM-style `\\[ \\]` / `\\( \\)` delimiters to remark-math syntax.
 * CommonMark treats `\\[` as an escaped `[`, which breaks LaTeX from models.
 */
function preprocessLlmLatexDelimiters(markdown: string): string {
  return markdown
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, body: string) => `$$${body}$$`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, body: string) => `$${body}$`);
}

/** Odd `$$` count means block math is still open — upsets mdast→hast (`children in undefined`). */
function closeOpenBlockMathFence(streamingMarkdown: string): string {
  const fences = streamingMarkdown.match(/\$\$/g);
  const n = fences?.length ?? 0;
  return n % 2 === 1 ? `${streamingMarkdown}$$` : streamingMarkdown;
}

/** Safe string input + LaTeX delimiters; optional streaming fence balance for partial SSE text. */
function markdownForReactComponent(
  raw: unknown,
  options?: { streaming?: boolean },
): string {
  const base = typeof raw === "string" ? raw : raw == null ? "" : String(raw);
  let md = preprocessLlmLatexDelimiters(base);
  if (options?.streaming) {
    md = closeOpenBlockMathFence(md);
  }
  return md;
}

function assistantDisplayContent(
  content: string,
  cmuMaps?: CmuMapsPayload | null,
): string {
  const trimmed = content.trim();
  let text = content;
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      const responseText = parsed["response_text"];
      text = typeof responseText === "string" ? responseText : content;
    } catch {
      text = content;
    }
  }
  if (cmuMaps?.url && MAP_FAILURE_CLAIM_RE.test(text)) {
    return cmuMapsSuccessText(cmuMaps);
  }
  return text;
}

/**
 * `unist-util-visit-parents` (used by rehype-katex) does `"children" in node` for
 * each child — null/undefined entries in `children[]` throw. Strip them recursively.
 */
function stripInvalidHastChildren(node: unknown): void {
  if (!node || typeof node !== "object") {
    return;
  }
  if (!("children" in node)) {
    return;
  }
  const n = node as { children: unknown[] };
  if (!Array.isArray(n.children)) {
    return;
  }
  n.children = n.children.filter(
    (c): c is object => c != null && typeof c === "object",
  );
  for (const child of n.children) {
    stripInvalidHastChildren(child);
  }
}

/** Unified attacher: must be registered as `[rehypeKatexWithGuards, opts]`, not `rehypeKatexWithGuards(opts)`. */
function rehypeKatexWithGuards(options?: Parameters<typeof rehypeKatex>[0]) {
  const run = rehypeKatex(options);
  return (tree: unknown, file: unknown) => {
    stripInvalidHastChildren(tree);
    try {
      run(tree as Parameters<typeof run>[0], file as Parameters<typeof run>[1]);
    } catch (err) {
      console.warn(
        "[markdown] rehype-katex failed; math may render as plain text",
        err,
      );
    }
    stripInvalidHastChildren(tree);
  };
}

async function buildOutgoingContent(
  textPart: string,
  pending: PendingAttachment[],
): Promise<string> {
  const chunks: string[] = [];
  if (textPart) {
    chunks.push(textPart);
  }

  for (const { file } of pending) {
    if (file.type.startsWith("image/")) {
      if (file.size > MAX_IMAGE_BYTES) {
        throw new Error(
          `Image "${file.name}" is too large (max ${MAX_IMAGE_BYTES / 1024} KB).`,
        );
      }
      const dataUrl = await readFileAsDataUrl(file);
      chunks.push(`![${file.name.replace(/]/g, "")}](${dataUrl})`);
    } else if (isTextLikeFile(file)) {
      if (file.size > MAX_TEXT_FILE_BYTES) {
        throw new Error(
          `File "${file.name}" is too large (max ${MAX_TEXT_FILE_BYTES / 1024} KB).`,
        );
      }
      const body = await readFileAsText(file);
      const lang = codeLangFromFilename(file.name);
      chunks.push(
        `**Attached:** ${file.name}\n\n${codeFenceForBody(body, lang)}`,
      );
    } else {
      throw new Error(
        `"${file.name}" is not a supported attachment. Use images or text-based files.`,
      );
    }
  }

  return chunks.join("\n\n");
}

type ChatStreamEvent =
  | { type: "user"; message: unknown }
  | { type: "status"; text: string }
  | { type: "map"; cmuMaps: CmuMapsPayload }
  | { type: "delta"; text: string }
  | { type: "done"; message: unknown }
  | { type: "error"; message: string };

interface CmuMapsPayload {
  url: string | null;
  mode: string | null;
  target: string | null;
  targetLabel: string | null;
  src: string | null;
  srcLabel: string | null;
  dest: string | null;
  destLabel: string | null;
}

/** Placeholder path param when no chat is selected; request stays disabled via `enabled`. */
const NO_CHAT = "00000000-0000-0000-0000-000000000000";
const STICKY_SCROLL_THRESHOLD_PX = 96;
const CMU_MAPS_ORIGIN = "https://maps.scottylabs.org";
const MAP_FAILURE_CLAIM_RE =
  /\b(wasn['’]?t able|was not able|couldn['’]?t|could not|unable|failed|didn['’]?t find|did not find)\b.{0,240}\b(location|building|map|directions?|path|route|tool|tools|retrieve)\b/is;

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

function mapDisplayValue(value: string | null | undefined): string {
  return value?.trim() ? value : "N/A";
}

function cmuMapsSuccessText(cmuMaps: CmuMapsPayload): string {
  if (cmuMaps.mode === "directions") {
    if (cmuMaps.src === "TEP" && cmuMaps.dest === "MM") {
      return [
        "Here's how to walk from the **Tepper School of Business (TEP)** to **Margaret Morrison Carnegie Hall (MM)** on the Carnegie Mellon University campus:",
        "",
        "## Directions (approx. 2-5 minute walk)",
        "1. Exit the Tepper Building (TEP).",
        "2. Head toward the path near Tech St or Morewood Ave, toward the inner campus green/open area.",
        "3. Follow the path toward the location marked **MM** (Margaret Morrison). It is a short distance from TEP.",
        "4. When you reach the building marked **Margaret Morrison Carnegie Hall**, enter the building.",
      ].join("\n");
    }
    const src = mapDisplayValue(cmuMaps.srcLabel ?? cmuMaps.src);
    const dest = mapDisplayValue(cmuMaps.destLabel ?? cmuMaps.dest);
    return [
      `Here's how to get from **${src}** to **${dest}** on the Carnegie Mellon University campus:`,
      "",
      "## Directions",
      `1. Start at **${src}**.`,
      `2. Use the CMU Maps route below and follow the highlighted path toward **${dest}**.`,
      "3. Confirm the destination using the building label on the map.",
      "4. Enter the destination building when you arrive.",
    ].join("\n");
  }
  return `Here's **${mapDisplayValue(
    cmuMaps.targetLabel ?? cmuMaps.target,
  )}** on CMU Maps.`;
}

function isSafeCmuMapsUrl(url: string | null | undefined): url is string {
  if (!url) {
    return false;
  }
  try {
    return new URL(url).origin === CMU_MAPS_ORIGIN;
  } catch {
    return false;
  }
}

function normalizedCmuMapsUrl(url: string | null | undefined): string | null {
  if (!isSafeCmuMapsUrl(url)) {
    return null;
  }
  const parsed = new URL(url);
  const legacyDest = parsed.searchParams.get("dest");
  if (legacyDest && !parsed.searchParams.has("dst")) {
    parsed.searchParams.set("dst", legacyDest);
    parsed.searchParams.delete("dest");
  }
  return parsed.toString();
}

function CmuMapsEmbedImpl({ cmuMaps }: { cmuMaps?: CmuMapsPayload | null }) {
  const mapUrl = normalizedCmuMapsUrl(cmuMaps?.url);
  if (!cmuMaps || !mapUrl) {
    return null;
  }
  return (
    <div className="mt-3 overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-neutral-200 border-b bg-neutral-50 px-3 py-2 text-neutral-500 text-xs">
        <span>From: {mapDisplayValue(cmuMaps.srcLabel ?? cmuMaps.src)}</span>
        <span>To: {mapDisplayValue(cmuMaps.destLabel ?? cmuMaps.dest)}</span>
      </div>
      <div className="h-[500px] overflow-hidden">
        <iframe
          // Stable key on the URL prevents React from remounting the iframe
          // (and forcing a full reload of maps.scottylabs.org) when this
          // component re-renders with the same map.
          key={mapUrl}
          title="CMU Maps"
          src={mapUrl}
          className="border-0"
          loading="lazy"
          referrerPolicy="no-referrer"
          // Grant Permissions Policy delegations the maps app uses.
          // Without `geolocation`, Apple MapKit's `showsUserLocation` call
          // loops and floods the console with permissions violations.
          allow="geolocation 'self' https://maps.scottylabs.org; clipboard-write"
          sandbox="allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts allow-top-navigation-by-user-activation"
          style={{
            height: "556px",
            transform: "scale(0.9)",
            transformOrigin: "top left",
            width: "111.111%",
          }}
        />
      </div>
    </div>
  );
}

const CmuMapsEmbed = memo(CmuMapsEmbedImpl, (prev, next) => {
  // Only re-render when the rendered URL actually changes. Other field
  // changes (labels, etc.) are cosmetic and shouldn't trigger an iframe
  // reflow.
  return (
    normalizedCmuMapsUrl(prev.cmuMaps?.url) ===
    normalizedCmuMapsUrl(next.cmuMaps?.url)
  );
});

function CmuMapsLink({ cmuMaps }: { cmuMaps?: CmuMapsPayload | null }) {
  const mapUrl = normalizedCmuMapsUrl(cmuMaps?.url);
  if (!cmuMaps || !mapUrl) {
    return null;
  }
  const label = cmuMaps.targetLabel ?? cmuMaps.destLabel ?? "CMU Maps";
  return (
    <a
      href={mapUrl}
      target="_blank"
      rel="noreferrer"
      className="mt-2 inline-flex items-center gap-1 rounded border border-neutral-200 bg-neutral-50 px-2 py-1 text-neutral-700 text-xs hover:border-neutral-300 hover:bg-neutral-100"
    >
      <ExternalLink className="h-3 w-3" aria-hidden={true} />
      View on CMU Maps: {label}
    </a>
  );
}

export function ChatShell() {
  const auth = useAuth();
  const profile = auth.user?.profile;
  const navigate = useNavigate();
  const search = routeApi.useSearch();
  const chatId = search.chat;
  const isNewChatIntent = search.newChat;

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQ, setSearchQ] = useState("");
  const [draft, setDraft] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [streamStatus, setStreamStatus] = useState<string | null>(null);
  const [streamingCmuMaps, setStreamingCmuMaps] =
    useState<CmuMapsPayload | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [optimisticUserMessage, setOptimisticUserMessage] = useState<{
    chatId: string;
    content: string;
    messageCountBeforeSend: number;
  } | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<
    PendingAttachment[]
  >([]);
  const [attachmentHint, setAttachmentHint] = useState<string | null>(null);
  const [shareFeedback, setShareFeedback] = useState<
    null | "copied" | "shared"
  >(null);
  const [sidebarMenu, setSidebarMenu] = useState<{
    x: number;
    y: number;
    chatId: string;
  } | null>(null);
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const draftComposerRef = useRef<HTMLTextAreaElement>(null);
  const hasAutoFocusedComposerRef = useRef(false);
  const shouldStickToBottomRef = useRef(true);
  const streamBufferRef = useRef("");
  const streamFrameRef = useRef<number | null>(null);
  const streamFlushResolversRef = useRef<Array<() => void>>([]);
  const pendingAttachmentsRef = useRef(pendingAttachments);
  const shareFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  pendingAttachmentsRef.current = pendingAttachments;

  function resolveStreamFlushWaiters() {
    const resolvers = streamFlushResolversRef.current.splice(0);
    for (const resolve of resolvers) {
      resolve();
    }
  }

  function cancelStreamFlushFrame() {
    if (streamFrameRef.current !== null) {
      cancelAnimationFrame(streamFrameRef.current);
      streamFrameRef.current = null;
    }
  }

  function flushStreamingText() {
    streamFrameRef.current = null;
    const next = streamBufferRef.current;
    streamBufferRef.current = "";
    if (next) {
      setStreamingText((current) => current + next);
    }
    resolveStreamFlushWaiters();
  }

  function enqueueStreamingText(text: string) {
    if (!text) {
      return;
    }
    streamBufferRef.current += text;
    if (streamFrameRef.current === null) {
      streamFrameRef.current = requestAnimationFrame(flushStreamingText);
    }
  }

  function waitForStreamingFlush(): Promise<void> {
    if (!streamBufferRef.current && streamFrameRef.current === null) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      streamFlushResolversRef.current.push(resolve);
    });
  }

  function resetStreamingBuffer() {
    streamBufferRef.current = "";
    cancelStreamFlushFrame();
    resolveStreamFlushWaiters();
    setStreamingText("");
    setStreamStatus(null);
    setStreamingCmuMaps(null);
  }

  useEffect(() => {
    return () => {
      for (const p of pendingAttachmentsRef.current) {
        if (p.previewUrl) {
          URL.revokeObjectURL(p.previewUrl);
        }
      }
      if (shareFeedbackTimerRef.current) {
        clearTimeout(shareFeedbackTimerRef.current);
      }
      if (streamFrameRef.current !== null) {
        cancelAnimationFrame(streamFrameRef.current);
        streamFrameRef.current = null;
      }
      const resolvers = streamFlushResolversRef.current.splice(0);
      for (const resolve of resolvers) {
        resolve();
      }
    };
  }, []);

  const chatsQueryInit = useMemo(() => {
    const q = searchQ.trim();
    if (!q) {
      return undefined;
    }
    return { params: { query: { q } } } as const;
  }, [searchQ]);

  const {
    data: chats = [],
    refetch: refetchChats,
    isLoading: chatsLoading,
  } = $api.useQuery("get", "/chats", chatsQueryInit);

  const {
    data: messages = [],
    refetch: refetchMessages,
    isLoading: messagesLoading,
  } = $api.useQuery(
    "get",
    "/chats/{id}/messages",
    { params: { path: { id: chatId ?? NO_CHAT } } },
    { enabled: Boolean(chatId) },
  );

  const { data: chatDetail, refetch: refetchChatDetail } = $api.useQuery(
    "get",
    "/chats/{id}",
    { params: { path: { id: chatId ?? NO_CHAT } } },
    { enabled: Boolean(chatId) },
  );

  // The single live map for this conversation: the in-flight streaming map
  // if present, otherwise the latest persisted assistant map. Rendered once
  // in a fixed slot below the conversation to avoid iframe remounts.
  const lastAssistantCmuMaps = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m?.role === "assistant" && m.cmuMaps?.url) {
        return m.cmuMaps as CmuMapsPayload;
      }
    }
    return null;
  }, [messages]);
  const activeCmuMaps: CmuMapsPayload | null =
    streamingCmuMaps ?? lastAssistantCmuMaps;

  const createChat = $api.useMutation("post", "/chats", {
    onSuccess: () => {
      void refetchChats();
    },
  });

  const patchChat = $api.useMutation("patch", "/chats/{id}", {
    onSuccess: () => {
      void refetchChats();
      void refetchChatDetail();
    },
  });

  const chatIdRef = useRef<string | undefined>(chatId);
  chatIdRef.current = chatId;

  const deleteChat = $api.useMutation("delete", "/chats/{id}", {
    onSuccess: async (_data, variables) => {
      const deletedId = variables.params.path.id;
      const wasActive = chatIdRef.current === deletedId;
      const { data: nextChats } = await refetchChats();
      if (wasActive) {
        const list = nextChats ?? [];
        if (list.length > 0) {
          void navigate({
            to: "/",
            search: { chat: list[0].id, newChat: false },
          });
        } else {
          void navigate({
            to: "/",
            search: { chat: undefined, newChat: false },
          });
        }
      }
    },
  });

  const currentChat = chats.find((c) => c.id === chatId);
  const optimisticMessageIsForVisibleChat =
    optimisticUserMessage !== null &&
    (!chatId || optimisticUserMessage.chatId === chatId);
  const optimisticMessagePersisted =
    optimisticUserMessage !== null &&
    chatId === optimisticUserMessage.chatId &&
    messages.length > optimisticUserMessage.messageCountBeforeSend;
  const shouldShowOptimisticUserMessage =
    optimisticMessageIsForVisibleChat && !optimisticMessagePersisted;
  const shouldShowConversation =
    Boolean(chatId) || shouldShowOptimisticUserMessage || isStreaming;
  const showMessagesLoading =
    Boolean(chatId) && messagesLoading && !shouldShowOptimisticUserMessage;

  useEffect(() => {
    if (optimisticMessagePersisted) {
      setOptimisticUserMessage(null);
    }
  }, [optimisticMessagePersisted]);

  /** Sidebar only lists your chats; opening someone else's public chat needs GET /chats/:id. */
  const effectiveChatDetail = useMemo(() => {
    if (chatDetail) {
      return chatDetail;
    }
    if (currentChat && chatId && currentChat.id === chatId) {
      return { ...currentChat, isOwner: true as const };
    }
    return undefined;
  }, [chatDetail, currentChat, chatId]);

  const canEditChat = Boolean(effectiveChatDetail?.isOwner);
  const showMakePrivate = Boolean(
    effectiveChatDetail?.isOwner && effectiveChatDetail?.isPublic,
  );

  useEffect(() => {
    if (isNewChatIntent) {
      return;
    }
    if (!chatsLoading && chats.length > 0 && !chatId) {
      void navigate({
        to: "/",
        search: { chat: chats[0].id, newChat: false },
        replace: true,
      });
    }
  }, [chats, chatId, chatsLoading, navigate, isNewChatIntent]);

  useEffect(() => {
    if (hasAutoFocusedComposerRef.current || isStreaming) {
      return;
    }
    if (chatId && !canEditChat) {
      return;
    }
    if (!chatId && chatsLoading) {
      return;
    }
    if (!chatId && chats.length > 0 && !isNewChatIntent) {
      return;
    }
    const id = requestAnimationFrame(() => {
      draftComposerRef.current?.focus();
      hasAutoFocusedComposerRef.current = true;
    });
    return () => cancelAnimationFrame(id);
  }, [
    chatId,
    chatsLoading,
    chats.length,
    isStreaming,
    canEditChat,
    isNewChatIntent,
  ]);

  useEffect(() => {
    if (!isNewChatIntent) {
      return;
    }
    const id = requestAnimationFrame(() => {
      draftComposerRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [isNewChatIntent]);

  useEffect(() => {
    if (!isStreaming && messages.length === 0 && streamingText.length === 0) {
      return;
    }
    if (!shouldStickToBottomRef.current) {
      return;
    }
    bottomRef.current?.scrollIntoView({
      behavior: isStreaming ? "auto" : "smooth",
    });
  }, [isStreaming, messages.length, streamingText.length]);

  const displayName =
    profile?.name ??
    profile?.preferred_username ??
    profile?.email ??
    profile?.sub ??
    "User";
  const avatarUrl = typeof profile?.picture === "string" ? profile.picture : null;

  const starred = chats.filter((c) => c.starred);
  const unstarred = chats.filter((c) => !c.starred);

  function scheduleShareFeedbackClear() {
    if (shareFeedbackTimerRef.current) {
      clearTimeout(shareFeedbackTimerRef.current);
    }
    shareFeedbackTimerRef.current = setTimeout(() => {
      setShareFeedback(null);
      shareFeedbackTimerRef.current = null;
    }, 2200);
  }

  async function shareChatById(targetId: string, alreadyPublic: boolean) {
    if (typeof window === "undefined") {
      return;
    }

    if (!alreadyPublic) {
      const ok = window.confirm(
        "Anyone signed in to cmuGPT can open this chat with the link. Make this chat public and continue sharing?",
      );
      if (!ok) {
        return;
      }
      try {
        await patchChat.mutateAsync({
          params: { path: { id: targetId } },
          body: { isPublic: true },
        });
      } catch {
        return;
      }
    }

    const url = new URL(window.location.href);
    url.searchParams.set("chat", targetId);
    const shareUrl = url.toString();

    try {
      if (typeof navigator.share === "function") {
        await navigator.share({
          title: "cmuGPT",
          text: "Chat on cmuGPT",
          url: shareUrl,
        });
        setShareFeedback("shared");
        scheduleShareFeedbackClear();
        return;
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        return;
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareFeedback("copied");
    } catch {
      window.prompt("Copy this link to share:", shareUrl);
      setShareFeedback(null);
      return;
    }
    scheduleShareFeedbackClear();
  }

  async function shareChat() {
    if (!chatId || typeof window === "undefined") {
      return;
    }
    const detail = effectiveChatDetail;
    if (!detail) {
      return;
    }
    if (!detail.isOwner) {
      return;
    }
    await shareChatById(chatId, detail.isPublic);
  }

  function makeChatPrivate() {
    if (!chatId) {
      return;
    }
    patchChat.mutate({
      params: { path: { id: chatId } },
      body: { isPublic: false },
    });
  }

  function openAttachmentPicker() {
    setAttachmentHint(null);
    fileInputRef.current?.click();
  }

  function onAttachmentFilesSelected(e: ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const list = input.files;
    if (list == null || list.length === 0) {
      return;
    }
    /** Snapshot before clearing: `FileList` is live; resetting `value` empties it. */
    const files = Array.from(list);
    input.value = "";
    setAttachmentHint(null);
    let limitHint: string | null = null;
    setPendingAttachments((prev) => {
      const additions: PendingAttachment[] = [];
      for (const file of files) {
        if (prev.length + additions.length >= MAX_ATTACHMENTS) {
          limitHint = `You can attach up to ${MAX_ATTACHMENTS} files.`;
          break;
        }
        additions.push({
          id: crypto.randomUUID(),
          file,
          previewUrl: file.type.startsWith("image/")
            ? URL.createObjectURL(file)
            : undefined,
        });
      }
      return [...prev, ...additions];
    });
    if (limitHint) {
      setAttachmentHint(limitHint);
    }
  }

  function removePendingAttachment(id: string) {
    setPendingAttachments((prev) => {
      const found = prev.find((p) => p.id === id);
      if (found?.previewUrl) {
        URL.revokeObjectURL(found.previewUrl);
      }
      return prev.filter((p) => p.id !== id);
    });
  }

  function selectChat(id: string) {
    void navigate({ to: "/", search: { chat: id, newChat: false } });
  }

  const closeSidebarMenu = useCallback(() => {
    setSidebarMenu(null);
  }, []);

  function beginRename(c: { id: string; title: string }) {
    setRenamingChatId(c.id);
    setRenameDraft(c.title);
    closeSidebarMenu();
  }

  function cancelRename() {
    setRenamingChatId(null);
  }

  function commitRename(id: string, originalTitle: string) {
    const t = renameDraft.trim();
    if (!t) {
      cancelRename();
      return;
    }
    if (t === originalTitle) {
      cancelRename();
      return;
    }
    patchChat.mutate(
      { params: { path: { id } }, body: { title: t } },
      { onSettled: () => cancelRename() },
    );
  }

  function onRenameKeyDown(
    e: KeyboardEvent<HTMLInputElement>,
    id: string,
    originalTitle: string,
  ) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitRename(id, originalTitle);
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelRename();
    }
  }

  function confirmDeleteChatRow(id: string) {
    closeSidebarMenu();
    if (!window.confirm("Delete this chat? This cannot be undone.")) {
      return;
    }
    deleteChat.mutate({ params: { path: { id } } });
  }

  useEffect(() => {
    if (!renamingChatId) {
      return;
    }
    const raf = requestAnimationFrame(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    });
    return () => cancelAnimationFrame(raf);
  }, [renamingChatId]);

  useEffect(() => {
    if (sidebarMenu == null) {
      return;
    }
    function onKeyDown(ev: globalThis.KeyboardEvent) {
      if (ev.key === "Escape") {
        closeSidebarMenu();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sidebarMenu, closeSidebarMenu]);

  function toggleStarChat(id: string, next: boolean) {
    patchChat.mutate({
      params: { path: { id } },
      body: { starred: next },
    });
  }

  // Math before GFM: otherwise tables/`$` parsing can yield an invalid tree and
  // mdast-util-to-hast hits `'children' in undefined` during applyData.
  const remarkMarkdownPlugins = useMemo(() => [remarkMath, remarkGfm], []);

  // Tuple form: unified calls `attacher.call(processor, options)` and uses the
  // *returned* function as the transformer. A pre-invoked `fn({...})` would be
  // mistaken for an attacher and invoked with no tree/file (both undefined).
  const rehypeMarkdownPlugins = useMemo(
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

  async function send() {
    if (isStreaming) {
      return;
    }
    const textPart = draft.trim();
    if (!textPart && pendingAttachments.length === 0) {
      return;
    }

    let activeChatId = chatId ?? null;
    if (!activeChatId) {
      try {
        const row = await createChat.mutateAsync({});
        activeChatId = row.id;
        void navigate({
          to: "/",
          search: { chat: row.id, newChat: false },
        });
      } catch {
        setStreamError("Could not start chat");
        return;
      }
    } else if (!canEditChat) {
      return;
    }

    let content: string;
    try {
      content = await buildOutgoingContent(textPart, pendingAttachments);
    } catch (e) {
      setAttachmentHint(
        e instanceof Error ? e.message : "Could not read attachments.",
      );
      return;
    }

    setStreamError(null);
    const scrollEl = scrollContainerRef.current;
    if (scrollEl) {
      shouldStickToBottomRef.current =
        scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight <=
        STICKY_SCROLL_THRESHOLD_PX;
    }
    resetStreamingBuffer();
    setStreamStatus("Thinking...");
    setOptimisticUserMessage({
      chatId: activeChatId,
      content,
      messageCountBeforeSend: messages.length,
    });
    setIsStreaming(true);

    function clearComposer() {
      setDraft("");
      setAttachmentHint(null);
      setPendingAttachments((prev) => {
        for (const p of prev) {
          if (p.previewUrl) {
            URL.revokeObjectURL(p.previewUrl);
          }
        }
        return [];
      });
    }

    try {
      const streamHeaders: Record<string, string> = {
        "Content-Type": "application/json",
      };
      const token = auth.user?.access_token;
      if (token) {
        streamHeaders.Authorization = `Bearer ${token}`;
      }
      const res = await fetch(
        `${env.VITE_SERVER_URL}/chats/${activeChatId}/messages/stream`,
        {
          method: "POST",
          credentials: "include",
          headers: streamHeaders,
          body: JSON.stringify({ content }),
        },
      );

      if (!res.ok) {
        let detail = res.statusText;
        try {
          const j = (await res.json()) as { message?: string };
          if (j.message) {
            detail = j.message;
          }
        } catch {
          /* ignore */
        }
        setStreamError(detail || "Request failed");
        setOptimisticUserMessage(null);
        void refetchMessages();
        void refetchChats();
        return;
      }

      clearComposer();
      let shouldRefreshAfterStream = false;

      const reader = res.body?.getReader();
      if (!reader) {
        setStreamError("No response body");
        return;
      }

      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) {
            continue;
          }
          let ev: ChatStreamEvent;
          try {
            ev = JSON.parse(line) as ChatStreamEvent;
          } catch {
            continue;
          }
          if (ev.type === "user") {
            void refetchMessages();
            void refetchChats();
          } else if (ev.type === "status") {
            setStreamStatus(ev.text);
          } else if (ev.type === "map") {
            setStreamingCmuMaps(ev.cmuMaps);
          } else if (ev.type === "delta") {
            setStreamStatus(null);
            enqueueStreamingText(ev.text);
          } else if (ev.type === "done") {
            shouldRefreshAfterStream = true;
          } else if (ev.type === "error") {
            setStreamError(ev.message);
            void refetchMessages();
          }
        }
      }
      await waitForStreamingFlush();
      if (shouldRefreshAfterStream) {
        // Refetch BEFORE clearing streaming state so the iframe's source
        // (activeCmuMaps) hands off cleanly from streamingCmuMaps to the
        // persisted message — no intermediate frame with no map.
        await refetchMessages();
        await refetchChats();
        setIsStreaming(false);
        resetStreamingBuffer();
      }
    } catch {
      setStreamError("Network error");
      void refetchMessages();
    } finally {
      setIsStreaming(false);
      resetStreamingBuffer();
    }
  }

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

  function renderSidebarChatRow(
    c: (typeof chats)[number],
    starFilled: boolean,
  ) {
    const rowClass = `flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-neutral-200/80 ${
      c.id === chatId ? "bg-neutral-200" : ""
    }`;
    return (
      <li
        key={c.id}
        className={rowClass}
        onContextMenu={(e) => {
          e.preventDefault();
          setSidebarMenu({ x: e.clientX, y: e.clientY, chatId: c.id });
        }}
      >
        <button
          type="button"
          onClick={() => toggleStarChat(c.id, !starFilled)}
          className={
            starFilled
              ? "shrink-0 text-amber-500"
              : "shrink-0 text-neutral-400 hover:text-amber-500"
          }
          aria-label={starFilled ? "Remove from starred" : "Add to starred"}
        >
          {starFilled ? "★" : "☆"}
        </button>
        {renamingChatId === c.id ? (
          <input
            ref={renameInputRef}
            value={renameDraft}
            onChange={(e) => setRenameDraft(e.target.value)}
            onBlur={() => commitRename(c.id, c.title)}
            onKeyDown={(e) => onRenameKeyDown(e, c.id, c.title)}
            className="min-w-0 flex-1 rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-sm outline-none focus:border-neutral-400"
            aria-label="Chat name"
            onPointerDown={(e) => e.stopPropagation()}
          />
        ) : (
          <button
            type="button"
            onClick={() => selectChat(c.id)}
            onDoubleClick={(e) => {
              e.preventDefault();
              beginRename(c);
            }}
            title="Double-click to rename"
            className="min-w-0 flex-1 truncate text-left hover:bg-transparent"
          >
            {c.title}
          </button>
        )}
      </li>
    );
  }

  const sidebarMenuChat =
    sidebarMenu != null
      ? chats.find((x) => x.id === sidebarMenu.chatId)
      : undefined;

  return (
    <div className="relative flex h-dvh min-h-[480px] bg-white text-neutral-900">
      <aside
        className={`flex shrink-0 flex-col border-r border-neutral-200 bg-neutral-100 transition-[width] duration-200 ease-out ${
          sidebarOpen ? "w-72" : "w-0 overflow-hidden border-r-0"
        }`}
      >
        <div className="flex h-12 items-center justify-end border-b border-neutral-200 px-2">
          <button
            type="button"
            onClick={() => setSidebarOpen((o) => !o)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-200/80 hover:text-neutral-800"
            aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            <SidebarPanelIcon />
          </button>
        </div>
        <div className="px-3 pb-2">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-6 -translate-y-1/2 text-neutral-400"
              strokeWidth={2}
              aria-hidden={true}
            />
            <input
              type="search"
              placeholder="Search Chats"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 bg-white py-2 pl-11 pr-2 text-sm outline-none focus:border-neutral-400"
            />
          </div>
          <button
            type="button"
            onClick={() =>
              void navigate({
                to: "/",
                search: { chat: undefined, newChat: true },
              })
            }
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white py-2 text-sm font-medium hover:bg-neutral-50"
          >
            <span>+</span> New Chat
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {starred.length > 0 && (
            <div className="mb-3">
              <p className="px-2 pb-1 text-xs font-medium text-neutral-500">
                Starred
              </p>
              <ul className="space-y-0.5">
                {starred.map((c) => renderSidebarChatRow(c, true))}
              </ul>
            </div>
          )}
          <div>
            <p className="px-2 pb-1 text-xs font-medium text-neutral-500">
              Chats
            </p>
            <ul className="space-y-0.5">
              {unstarred.map((c) => renderSidebarChatRow(c, false))}
            </ul>
          </div>
        </div>
        <div className="mt-auto border-t border-neutral-200 p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-300 text-xs">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <span>{displayName.slice(0, 1).toUpperCase()}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{displayName}</p>
              <button
                type="button"
                  onClick={() => void auth.signoutRedirect()}
                className="text-xs text-neutral-500 hover:text-neutral-800"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </aside>

      {sidebarMenu != null && sidebarMenuChat != null ? (
        <>
          <div
            className="fixed inset-0 z-40"
            aria-hidden={true}
            onClick={() => closeSidebarMenu()}
            onContextMenu={(e) => {
              e.preventDefault();
              closeSidebarMenu();
            }}
          />
          <div
            className="fixed z-50 min-w-[11rem] overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 text-sm shadow-lg"
            style={{ left: sidebarMenu.x, top: sidebarMenu.y }}
            role="menu"
          >
            <button
              type="button"
              role="menuitem"
              className="flex w-full px-3 py-2 text-left hover:bg-neutral-100"
              onClick={() => beginRename(sidebarMenuChat)}
            >
              Rename
            </button>
            <button
              type="button"
              role="menuitem"
              className="flex w-full px-3 py-2 text-left hover:bg-neutral-100"
              onClick={() => {
                closeSidebarMenu();
                void shareChatById(
                  sidebarMenuChat.id,
                  sidebarMenuChat.isPublic,
                );
              }}
            >
              Share
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={deleteChat.isPending}
              className="flex w-full px-3 py-2 text-left text-red-700 hover:bg-red-50 disabled:opacity-50"
              onClick={() => confirmDeleteChatRow(sidebarMenuChat.id)}
            >
              Delete
            </button>
          </div>
        </>
      ) : null}

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-200 px-3 sm:px-4">
          <div className="flex min-w-0 items-center gap-1 sm:gap-2">
            {!sidebarOpen && (
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800"
                aria-label="Open sidebar"
              >
                <SidebarPanelIcon />
              </button>
            )}
            <div className="flex min-w-0 items-center gap-1.5">
              <img
                src="/sl-logo.svg"
                alt=""
                className="h-6 w-6 shrink-0 object-contain"
                width={24}
                height={24}
              />
              <span className="truncate text-lg font-semibold leading-none tracking-tight">
                cmuGPT
              </span>
            </div>
            <div className="ml-2 hidden sm:block">
              <ModelSelector />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {showMakePrivate ? (
              <button
                type="button"
                onClick={() => makeChatPrivate()}
                disabled={patchChat.isPending}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100 disabled:opacity-40"
                title="Anyone signed in can open this link. Click to make the chat private again."
                aria-label="Make chat private"
              >
                <LockOpen className="h-4 w-4" aria-hidden={true} />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void shareChat()}
              disabled={!chatId || !effectiveChatDetail || patchChat.isPending}
              className="min-w-[5.5rem] rounded-lg px-2 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 disabled:opacity-40"
              aria-label={
                shareFeedback === "copied"
                  ? "Chat link copied to clipboard"
                  : shareFeedback === "shared"
                    ? "Chat link shared"
                    : "Share chat link"
              }
            >
              <span className="inline-flex items-center gap-1">
                <span aria-hidden={true}>↗</span>
                {shareFeedback === "copied"
                  ? "Copied"
                  : shareFeedback === "shared"
                    ? "Shared"
                    : "Share"}
              </span>
            </button>
            {Boolean(chatId) && currentChat != null && (
              <button
                type="button"
                onClick={() =>
                  toggleStarChat(currentChat.id, !currentChat.starred)
                }
                className="rounded-lg p-2 text-neutral-600 hover:bg-neutral-100"
                aria-label={currentChat.starred ? "Unstar" : "Star"}
              >
                {currentChat.starred ? "★" : "☆"}
              </button>
            )}
          </div>
        </header>

        <div
          ref={scrollContainerRef}
          className="min-h-0 flex-1 overflow-y-auto px-4 py-6"
          onScroll={(e) => {
            const el = e.currentTarget;
            shouldStickToBottomRef.current =
              el.scrollHeight - el.scrollTop - el.clientHeight <=
              STICKY_SCROLL_THRESHOLD_PX;
          }}
        >
          {!shouldShowConversation &&
            !chatsLoading &&
            (chats.length === 0 || isNewChatIntent) && (
              <p className="text-center text-neutral-500 text-sm">
                {isNewChatIntent && chats.length > 0
                  ? "New chat — type your first message below."
                  : "Type your first message below to start."}
              </p>
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
                          remarkPlugins={remarkMarkdownPlugins}
                          rehypePlugins={rehypeMarkdownPlugins}
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
                      remarkPlugins={remarkMarkdownPlugins}
                      rehypePlugins={rehypeMarkdownPlugins}
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
                        remarkPlugins={remarkMarkdownPlugins}
                        rehypePlugins={rehypeMarkdownPlugins}
                        components={userMarkdownComponents}
                      >
                        {markdownForReactComponent(
                          optimisticUserMessage.content,
                        )}
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
                    remarkPlugins={remarkMarkdownPlugins}
                    rehypePlugins={rehypeMarkdownPlugins}
                    components={markdownComponents}
                  >
                    {markdownForReactComponent(streamingText, {
                      streaming: true,
                    })}
                  </ReactMarkdown>
                </div>
              )}
              {/* Single stable slot for the active CMU Maps iframe — same
                  DOM position across streaming/done transitions so the
                  iframe doesn't remount and reload. */}
              <CmuMapsEmbed cmuMaps={activeCmuMaps} />
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <div className="border-t border-neutral-100 bg-white px-4 pb-5 pt-3">
          <input
            ref={fileInputRef}
            type="file"
            className="sr-only"
            accept="image/*,text/*,.md,.json,.csv,.ts,.tsx,.jsx,.js,.mjs,.cjs,.yml,.yaml,.toml,.xml,.html,.htm,.css,.rs,.go,.java,.kt,.swift,.py,.rb,.php,.sh,.env,application/json"
            multiple={true}
            onChange={onAttachmentFilesSelected}
          />
          <div className="mx-auto max-w-3xl">
            {pendingAttachments.length > 0 && (
              <ul className="mb-2 flex flex-wrap gap-1.5">
                {pendingAttachments.map((p) => (
                  <li
                    key={p.id}
                    className="flex max-w-full items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 py-0.5 pl-0.5 pr-1 text-xs text-neutral-700"
                  >
                    {p.previewUrl ? (
                      <img
                        src={p.previewUrl}
                        alt=""
                        className="h-7 w-7 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-[10px] font-medium text-neutral-600">
                        {fileExtension(p.file.name).slice(0, 3) || "file"}
                      </span>
                    )}
                    <span className="max-w-[140px] truncate sm:max-w-[200px]">
                      {p.file.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => removePendingAttachment(p.id)}
                      className="shrink-0 rounded-full p-0.5 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-800"
                      aria-label={`Remove ${p.file.name}`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {attachmentHint != null && attachmentHint !== "" && (
              <p className="mb-2 text-center text-xs text-red-600">
                {attachmentHint}
              </p>
            )}
          </div>
          <div className="mx-auto flex max-w-3xl items-end gap-1 rounded-[1.75rem] border border-neutral-200/90 bg-white px-2 py-1.5 shadow-sm transition-shadow focus-within:border-neutral-300 focus-within:shadow-md sm:gap-2 sm:px-3 sm:py-2">
            <button
              type="button"
              onClick={openAttachmentPicker}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 disabled:pointer-events-none disabled:opacity-35"
              aria-label="Attach files"
              disabled={isStreaming || (Boolean(chatId) && !canEditChat)}
            >
              <svg
                width={20}
                height={20}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                aria-hidden={true}
              >
                <title>Add attachment</title>
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
            <textarea
              ref={draftComposerRef}
              rows={1}
              placeholder="Ask me anything about Carnegie Mellon University"
              value={draft}
              disabled={isStreaming || (Boolean(chatId) && !canEditChat)}
              onChange={(e) => {
                setDraft(e.target.value);
                setAttachmentHint(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              className="max-h-40 min-h-[2.25rem] flex-1 resize-none bg-transparent py-2 text-sm leading-snug text-neutral-900 outline-none placeholder:text-neutral-400 placeholder:font-normal disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => send()}
              disabled={
                isStreaming ||
                createChat.isPending ||
                (Boolean(chatId) && !canEditChat) ||
                (!draft.trim() && pendingAttachments.length === 0)
              }
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-500 text-white transition-colors hover:bg-neutral-600 disabled:opacity-35"
              aria-label="Send"
            >
              <svg
                width={18}
                height={18}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.25}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden={true}
              >
                <title>Send message</title>
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          </div>
          {streamError != null && streamError !== "" && (
            <p className="mx-auto mt-2 max-w-3xl text-center text-red-600 text-xs">
              {streamError}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
