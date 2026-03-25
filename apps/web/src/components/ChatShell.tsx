import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { LockOpen } from "lucide-react";
import type { ChangeEvent, ComponentProps } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";
import { env } from "@/env.ts";
import { $api } from "@/lib/api/client.ts";
import {
  getKeycloakAccessTokenForApi,
  signOut,
  useSession,
} from "@/lib/auth/client.ts";

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
  | { type: "delta"; text: string }
  | { type: "done"; message: unknown }
  | { type: "error"; message: string };

/** Placeholder path param when no chat is selected; request stays disabled via `enabled`. */
const NO_CHAT = "00000000-0000-0000-0000-000000000000";

export function ChatShell() {
  const { data: auth } = useSession();
  const navigate = useNavigate();
  const search = routeApi.useSearch();
  const chatId = search.chat;

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQ, setSearchQ] = useState("");
  const [draft, setDraft] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [streamError, setStreamError] = useState<string | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<
    PendingAttachment[]
  >([]);
  const [attachmentHint, setAttachmentHint] = useState<string | null>(null);
  const [shareFeedback, setShareFeedback] = useState<
    null | "copied" | "shared"
  >(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingAttachmentsRef = useRef(pendingAttachments);
  const shareFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  pendingAttachmentsRef.current = pendingAttachments;

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

  const createChat = $api.useMutation("post", "/chats", {
    onSuccess: (row) => {
      void refetchChats();
      void navigate({ to: "/", search: { chat: row.id } });
    },
  });

  const patchChat = $api.useMutation("patch", "/chats/{id}", {
    onSuccess: () => {
      void refetchChats();
      void refetchChatDetail();
    },
  });

  const currentChat = chats.find((c) => c.id === chatId);

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
    if (!chatsLoading && chats.length > 0 && !chatId) {
      void navigate({
        to: "/",
        search: { chat: chats[0].id },
        replace: true,
      });
    }
  }, [chats, chatId, chatsLoading, navigate]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const displayName =
    auth?.user?.name ??
    auth?.user?.email ??
    (typeof auth?.user === "object" && auth.user && "id" in auth.user
      ? String(auth.user.id)
      : "User");

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

  async function shareChat() {
    if (!chatId || typeof window === "undefined") {
      return;
    }
    const detail = effectiveChatDetail;
    if (!detail) {
      return;
    }

    if (detail.isOwner && !detail.isPublic) {
      const ok = window.confirm(
        "Anyone signed in to cmuGPT can open this chat with the link. Make this chat public and continue sharing?",
      );
      if (!ok) {
        return;
      }
      try {
        await patchChat.mutateAsync({
          params: { path: { id: chatId } },
          body: { isPublic: true },
        });
      } catch {
        return;
      }
    }

    const url = new URL(window.location.href);
    url.searchParams.set("chat", chatId);
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
    const list = e.target.files;
    e.target.value = "";
    if (list == null || list.length === 0) {
      return;
    }
    setAttachmentHint(null);
    let limitHint: string | null = null;
    setPendingAttachments((prev) => {
      const additions: PendingAttachment[] = [];
      for (const file of Array.from(list)) {
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
    void navigate({ to: "/", search: { chat: id } });
  }

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
    if (!chatId || isStreaming) {
      return;
    }
    const textPart = draft.trim();
    if (!textPart && pendingAttachments.length === 0) {
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
    setStreamingText("");
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
      const bearer = await getKeycloakAccessTokenForApi();
      if (bearer) {
        streamHeaders.Authorization = `Bearer ${bearer}`;
      }
      const res = await fetch(
        `${env.VITE_SERVER_URL}/chats/${chatId}/messages/stream`,
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
        void refetchMessages();
        void refetchChats();
        return;
      }

      clearComposer();

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
            await refetchMessages();
            await refetchChats();
          } else if (ev.type === "delta") {
            setStreamingText((t) => t + ev.text);
          } else if (ev.type === "done") {
            await refetchMessages();
            await refetchChats();
          } else if (ev.type === "error") {
            setStreamError(ev.message);
            void refetchMessages();
          }
        }
      }
    } catch {
      setStreamError("Network error");
      void refetchMessages();
    } finally {
      setIsStreaming(false);
      setStreamingText("");
    }
  }

  const markdownClass =
    "max-w-none text-sm leading-relaxed text-neutral-800 [&_.katex-display]:my-3 [&_.katex-display]:block [&_.katex-display]:overflow-x-auto [&_.katex]:text-[1em] [&_a]:inline-flex [&_a]:items-center [&_a]:gap-0.5 [&_a]:font-medium [&_a]:text-red-800 [&_a]:underline [&_a]:decoration-red-800/40 [&_a]:underline-offset-2 [&_a:hover]:decoration-red-800 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_strong]:font-semibold [&_p]:my-2 [&_p:first-child]:mt-0";

  const userBubbleMarkdownClass =
    "max-w-none [&_.katex-display]:my-2 [&_.katex-display]:block [&_.katex-display]:overflow-x-auto [&_.katex]:text-[0.95em] [&_pre]:my-2 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-black/5 [&_pre]:p-2 [&_pre]:text-xs [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-4 [&_strong]:font-semibold";

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
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">
              ⌕
            </span>
            <input
              type="search"
              placeholder="Search Chats"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 bg-white py-2 pl-8 pr-2 text-sm outline-none focus:border-neutral-400"
            />
          </div>
          <button
            type="button"
            onClick={() => createChat.mutate({})}
            disabled={createChat.isPending}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white py-2 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50"
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
                {starred.map((c) => (
                  <li key={c.id}>
                    <div
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-neutral-200/80 ${
                        c.id === chatId ? "bg-neutral-200" : ""
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleStarChat(c.id, false)}
                        className="shrink-0 text-amber-500"
                        aria-label="Remove from starred"
                      >
                        ★
                      </button>
                      <button
                        type="button"
                        onClick={() => selectChat(c.id)}
                        className="min-w-0 flex-1 truncate text-left hover:bg-transparent"
                      >
                        {c.title}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <p className="px-2 pb-1 text-xs font-medium text-neutral-500">
              Chats
            </p>
            <ul className="space-y-0.5">
              {unstarred.map((c) => (
                <li key={c.id}>
                  <div
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-neutral-200/80 ${
                      c.id === chatId ? "bg-neutral-200" : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleStarChat(c.id, true)}
                      className="shrink-0 text-neutral-400 hover:text-amber-500"
                      aria-label="Add to starred"
                    >
                      ☆
                    </button>
                    <button
                      type="button"
                      onClick={() => selectChat(c.id)}
                      className="min-w-0 flex-1 truncate text-left hover:bg-transparent"
                    >
                      {c.title}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-auto border-t border-neutral-200 p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-300 text-xs">
              {auth?.user?.image ? (
                <img
                  src={auth.user.image}
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
                onClick={() => signOut()}
                className="text-xs text-neutral-500 hover:text-neutral-800"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </aside>

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
            <div className="flex min-w-0 items-center gap-2">
              <img
                src="/sl-logo.svg"
                alt=""
                className="h-8 w-8 shrink-0"
                width={32}
                height={32}
              />
              <span className="truncate text-lg font-semibold tracking-tight">
                cmuGPT
              </span>
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

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
          {!chatId && !chatsLoading && chats.length === 0 && (
            <p className="text-center text-neutral-500 text-sm">
              No chats yet. Create one with &quot;New Chat&quot;.
            </p>
          )}
          {Boolean(chatId) && messagesLoading && (
            <p className="text-neutral-500 text-sm">Loading messages…</p>
          )}
          {Boolean(chatId) && !messagesLoading && (
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
                      {markdownForReactComponent(m.content)}
                    </ReactMarkdown>
                  </div>
                ),
              )}
              {isStreaming && !streamingText && (
                <p className="text-neutral-400 text-sm">Thinking…</p>
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
              disabled={!chatId || isStreaming}
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
              rows={1}
              placeholder="Ask me anything about Carnegie Mellon University"
              value={draft}
              disabled={!chatId || isStreaming}
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
                !chatId ||
                isStreaming ||
                !canEditChat ||
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
