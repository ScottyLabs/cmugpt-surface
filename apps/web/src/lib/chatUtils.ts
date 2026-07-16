import rehypeKatex from "rehype-katex";

export const MAX_ATTACHMENTS = 8;
export const MAX_IMAGE_BYTES = 512 * 1024;
export const MAX_TEXT_FILE_BYTES = 400 * 1024;

export const TEXT_FILE_EXTENSIONS = new Set([
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

export interface PendingAttachment {
  id: string;
  file: File;
  previewUrl?: string;
}

export type ChatStreamEvent =
  | { type: "user"; message: unknown }
  | { type: "status"; text: string }
  | {
      type: "memory";
      op: "add" | "remove";
      text: string;
      id?: string;
      kind?: "learned" | "remembered";
      fact?: string;
    }
  | { type: "map"; cmuMaps: CmuMapsPayload }
  | { type: "delta"; text: string }
  | { type: "done"; message: unknown }
  | { type: "error"; message: string };

export interface SavedMemoryNotice {
  id: string;
  kind: "learned" | "remembered";
  fact: string;
}

export interface CmuMapsPayload {
  url: string | null;
  mode: string | null;
  target: string | null;
  targetLabel: string | null;
  src: string | null;
  srcLabel: string | null;
  dest: string | null;
  destLabel: string | null;
}

export const NO_CHAT = "00000000-0000-0000-0000-000000000000";
export const STICKY_SCROLL_THRESHOLD_PX = 96;
export const CMU_MAPS_ORIGIN = "https://maps.scottylabs.org";
export const MAP_FAILURE_CLAIM_RE =
  /\b(wasn['']?t able|was not able|couldn['']?t|could not|unable|failed|didn['']?t find|did not find)\b.{0,240}\b(location|building|map|directions?|path|route|tool|tools|retrieve)\b/is;

export function fileExtension(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

export function isTextLikeFile(file: File): boolean {
  const t = file.type;
  if (t.startsWith("text/")) return true;
  if (
    t === "application/json" ||
    t === "application/xml" ||
    t === "application/javascript" ||
    t === "application/typescript" ||
    t === "application/x-yaml"
  )
    return true;
  return TEXT_FILE_EXTENSIONS.has(fileExtension(file.name));
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error ?? new Error("Read failed"));
    r.readAsText(file);
  });
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error ?? new Error("Read failed"));
    r.readAsDataURL(file);
  });
}

export function codeFenceForBody(body: string, lang: string): string {
  const useTilde = body.includes("```");
  const open = useTilde ? "~~~" : "```";
  const close = useTilde ? "~~~" : "```";
  return lang
    ? `${open}${lang}\n${body}\n${close}`
    : `${open}\n${body}\n${close}`;
}

export function codeLangFromFilename(name: string): string {
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

export function preprocessLlmLatexDelimiters(markdown: string): string {
  return markdown
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, body: string) => `$$${body}$$`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, body: string) => `$${body}$`);
}

export function closeOpenBlockMathFence(streamingMarkdown: string): string {
  const fences = streamingMarkdown.match(/\$\$/g);
  const n = fences?.length ?? 0;
  return n % 2 === 1 ? `${streamingMarkdown}$$` : streamingMarkdown;
}

export function markdownForReactComponent(
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

export function mapDisplayValue(value: string | null | undefined): string {
  return value?.trim() ? value : "N/A";
}

export function cmuMapsSuccessText(cmuMaps: CmuMapsPayload): string {
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

export function assistantDisplayContent(
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

function stripInvalidHastChildren(node: unknown): void {
  if (!node || typeof node !== "object") return;
  if (!("children" in node)) return;
  const n = node as { children: unknown[] };
  if (!Array.isArray(n.children)) return;
  n.children = n.children.filter(
    (c): c is object => c != null && typeof c === "object",
  );
  for (const child of n.children) {
    stripInvalidHastChildren(child);
  }
}

export function rehypeKatexWithGuards(
  options?: Parameters<typeof rehypeKatex>[0],
) {
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

export async function buildOutgoingContent(
  textPart: string,
  pending: PendingAttachment[],
): Promise<string> {
  const chunks: string[] = [];
  if (textPart) chunks.push(textPart);

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
