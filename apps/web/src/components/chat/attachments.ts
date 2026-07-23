export const MAX_ATTACHMENTS = 8;
export const MAX_IMAGE_BYTES = 512 * 1024;
export const MAX_TEXT_FILE_BYTES = 400 * 1024;

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

export interface PendingAttachment {
  id: string;
  file: File;
  /** Revoke with URL.revokeObjectURL when removed or sent */
  previewUrl?: string;
}

export function fileExtension(name: string): string {
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
  return file.text();
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.addEventListener("load", () => {
      resolve(typeof r.result === "string" ? r.result : "");
    });
    r.addEventListener("error", () => {
      reject(r.error ?? new Error("Read failed"));
    });
    r.readAsDataURL(file);
  });
}

function codeFenceForBody(body: string, lang: string): string {
  const useTilde = body.includes("```");
  const open = useTilde ? "~~~" : "```";
  const close = useTilde ? "~~~" : "```";
  return lang ? `${open}${lang}\n${body}\n${close}` : `${open}\n${body}\n${close}`;
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

async function buildAttachmentChunk(file: File): Promise<string> {
  if (file.type.startsWith("image/")) {
    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error(`Image "${file.name}" is too large (max ${MAX_IMAGE_BYTES / 1024} KB).`);
    }
    const dataUrl = await readFileAsDataUrl(file);
    return `![${file.name.replaceAll("]", "")}](${dataUrl})`;
  }
  if (isTextLikeFile(file)) {
    if (file.size > MAX_TEXT_FILE_BYTES) {
      throw new Error(`File "${file.name}" is too large (max ${MAX_TEXT_FILE_BYTES / 1024} KB).`);
    }
    const body = await readFileAsText(file);
    const lang = codeLangFromFilename(file.name);
    return `**Attached:** ${file.name}\n\n${codeFenceForBody(body, lang)}`;
  }
  throw new Error(`"${file.name}" is not a supported attachment. Use images or text-based files.`);
}

export async function buildOutgoingContent(
  textPart: string,
  pending: PendingAttachment[],
): Promise<string> {
  const fileChunks = await Promise.all(pending.map(({ file }) => buildAttachmentChunk(file)));
  const chunks = textPart ? [textPart, ...fileChunks] : fileChunks;
  return chunks.join("\n\n");
}

export function revokeAttachmentPreviews(list: PendingAttachment[]): void {
  for (const p of list) {
    if (p.previewUrl !== undefined && p.previewUrl !== "") {
      URL.revokeObjectURL(p.previewUrl);
    }
  }
}

type SetAttachments = (updater: (prev: PendingAttachment[]) => PendingAttachment[]) => void;

export function applyAttachmentSelection(
  input: HTMLInputElement,
  setAttachmentHint: (value: string | null) => void,
  setPendingAttachments: SetAttachments,
): void {
  const list = input.files;
  if (list === null || list.length === 0) {
    return;
  }
  const files = Array.from(list);
  input.value = "";
  setAttachmentHint(null);
  let limitHint: string | null = null;
  setPendingAttachments((prev) => {
    const result = buildAttachmentAdditions(files, prev.length);
    limitHint = result.limitHint;
    return [...prev, ...result.additions];
  });
  if (limitHint !== null) {
    setAttachmentHint(limitHint);
  }
}

export function removeAttachment(id: string, setPendingAttachments: SetAttachments): void {
  setPendingAttachments((prev) => {
    const found = prev.find((p) => p.id === id);
    if (found?.previewUrl !== undefined && found.previewUrl !== "") {
      URL.revokeObjectURL(found.previewUrl);
    }
    return prev.filter((p) => p.id !== id);
  });
}

export function clearAllAttachments(setPendingAttachments: SetAttachments): void {
  setPendingAttachments((prev) => {
    revokeAttachmentPreviews(prev);
    return [];
  });
}

export function buildAttachmentAdditions(
  files: File[],
  prevLength: number,
): { additions: PendingAttachment[]; limitHint: string | null } {
  const additions: PendingAttachment[] = [];
  let limitHint: string | null = null;
  for (const file of files) {
    if (prevLength + additions.length >= MAX_ATTACHMENTS) {
      limitHint = `You can attach up to ${MAX_ATTACHMENTS} files.`;
      break;
    }
    additions.push({
      id: crypto.randomUUID(),
      file,
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
    });
  }
  return { additions, limitHint };
}
