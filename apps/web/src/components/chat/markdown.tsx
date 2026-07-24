import type { ComponentProps } from "react";
import type ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { cmuMapsSuccessText, MAP_FAILURE_CLAIM_RE } from "./cmuMaps.tsx";
import type { CmuMapsPayload } from "./types.ts";

/**
 * Map LLM-style `\\[ \\]` / `\\( \\)` delimiters to remark-math syntax.
 * CommonMark treats `\\[` as an escaped `[`, which breaks LaTeX from models.
 */
function preprocessLlmLatexDelimiters(markdown: string): string {
  return markdown
    .replaceAll(/\\\[([\s\S]*?)\\\]/gu, (_, body: string) => `$$${body}$$`)
    .replaceAll(/\\\(([\s\S]*?)\\\)/gu, (_, body: string) => `$${body}$`);
}

/** Odd `$$` count means block math is still open, which breaks the mdast-to-hast conversion (`children in undefined`). */
function closeOpenBlockMathFence(streamingMarkdown: string): string {
  const fences = streamingMarkdown.match(/\$\$/gu);
  const n = fences?.length ?? 0;
  return n % 2 === 1 ? `${streamingMarkdown}$$` : streamingMarkdown;
}

/**
 * Odd ``` count means a code fence is still open, which swallows the rest of
 * the streaming text into a single dark `<pre>` block until the model emits
 * the closing fence. Close it early so mid-stream text renders as prose.
 */
function closeOpenCodeFence(streamingMarkdown: string): string {
  const fences = streamingMarkdown.match(/```/gu);
  const n = fences?.length ?? 0;
  return n % 2 === 1 ? `${streamingMarkdown}\n\`\`\`` : streamingMarkdown;
}

/** Safe string input + LaTeX delimiters; optional streaming fence balance for partial SSE text. */
export function markdownForReactComponent(raw: unknown, options?: { streaming?: boolean }): string {
  let base: string;
  if (typeof raw === "string") {
    base = raw;
  } else if (typeof raw === "number" || typeof raw === "boolean") {
    base = String(raw);
  } else {
    base = "";
  }
  let md = preprocessLlmLatexDelimiters(base);
  if (options?.streaming === true) {
    md = closeOpenBlockMathFence(md);
    md = closeOpenCodeFence(md);
  }
  return md;
}

export function assistantDisplayContent(content: string, cmuMaps?: CmuMapsPayload | null): string {
  const trimmed = content.trim();
  let text = content;
  if (trimmed.startsWith("{")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (typeof parsed === "object" && parsed !== null && "response_text" in parsed) {
        const responseText = parsed.response_text;
        text = typeof responseText === "string" ? responseText : content;
      }
    } catch {
      text = content;
    }
  }
  if (typeof cmuMaps?.url === "string" && cmuMaps.url !== "" && MAP_FAILURE_CLAIM_RE.test(text)) {
    return cmuMapsSuccessText(cmuMaps);
  }
  return text;
}

/**
 * `unist-util-visit-parents` (used by rehype-katex) does `"children" in node` for
 * each child, and null/undefined entries in `children[]` throw. Strip them recursively.
 */
function stripInvalidHastChildren(node: unknown): void {
  if (typeof node !== "object" || node === null) {
    return;
  }
  if (!("children" in node)) {
    return;
  }
  if (!Array.isArray(node.children)) {
    return;
  }
  const filtered = node.children.filter((c): c is object => c !== null && typeof c === "object");
  node.children = filtered;
  for (const child of filtered) {
    stripInvalidHastChildren(child);
  }
}

/** Unified attacher: must be registered as `[rehypeKatexWithGuards, opts]`, not `rehypeKatexWithGuards(opts)`. */
function rehypeKatexWithGuards(options?: Parameters<typeof rehypeKatex>[0]) {
  const run = rehypeKatex(options);
  return (tree: Parameters<typeof run>[0], file: Parameters<typeof run>[1]) => {
    stripInvalidHastChildren(tree);
    try {
      run(tree, file);
    } catch (err) {
      console.warn("[markdown] rehype-katex failed; math may render as plain text", err);
    }
    stripInvalidHastChildren(tree);
  };
}

// Math before GFM: otherwise tables/`$` parsing can yield an invalid tree and
// mdast-util-to-hast hits `'children' in undefined` during applyData.
export const remarkMarkdownPlugins = [remarkMath, remarkGfm];

// Tuple form: unified calls `attacher.call(processor, options)` and uses the
// *returned* function as the transformer. A pre-invoked `fn({...})` would be
// mistaken for an attacher and invoked with no tree/file (both undefined).
export const rehypeMarkdownPlugins = [
  [
    rehypeKatexWithGuards,
    {
      strict: "ignore",
    },
  ],
] as NonNullable<ComponentProps<typeof ReactMarkdown>["rehypePlugins"]>;

function MarkdownLink({ href, children, ...props }: ComponentProps<"a"> & { href?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
      {children}
      <span className="text-xs" aria-hidden>
        ↗
      </span>
    </a>
  );
}

function UserMarkdownImg({ alt, ...props }: ComponentProps<"img">) {
  return (
    <img
      alt={alt ?? ""}
      {...props}
      className="my-1 max-h-48 max-w-full rounded-lg object-contain"
    />
  );
}

function UserMarkdownLink({ href, children, ...props }: ComponentProps<"a"> & { href?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
      {children}
    </a>
  );
}

function UserMarkdownParagraph({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      {...props}
      className={["my-1.5 first:mt-0 last:mb-0", className].filter(Boolean).join(" ")}
    />
  );
}

export const markdownComponents = {
  a: MarkdownLink,
} satisfies ComponentProps<typeof ReactMarkdown>["components"];

export const userMarkdownComponents = {
  img: UserMarkdownImg,
  a: UserMarkdownLink,
  p: UserMarkdownParagraph,
} satisfies ComponentProps<typeof ReactMarkdown>["components"];

export const markdownClass = [
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

export const userBubbleMarkdownClass =
  "max-w-none [&_.katex-display]:my-2 [&_.katex-display]:block [&_.katex-display]:overflow-x-auto [&_.katex]:text-[0.95em] [&_pre]:my-2 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-black/5 [&_pre]:p-2 [&_pre]:text-xs [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-4 [&_strong]:font-semibold";
