import type { RefObject } from "react";
import type { ChatMutations } from "./useChatMutations.ts";
import type { ChatDetail } from "./types.ts";

export type ShareFeedback = null | "copied" | "shared";

export interface ShareCtx {
  patchChat: ChatMutations["patchChat"];
  chatId: string | undefined;
  effectiveChatDetail: ChatDetail | undefined;
  setShareFeedback: (value: ShareFeedback) => void;
  timerRef: RefObject<ReturnType<typeof setTimeout> | null>;
}

function buildShareUrl(chatId: string): string {
  const url = new URL(globalThis.location.href);
  url.searchParams.set("chat", chatId);
  return url.toString();
}

async function tryNativeShare(shareUrl: string): Promise<"shared" | "aborted" | "unsupported"> {
  if (typeof navigator.share !== "function") {
    return "unsupported";
  }
  try {
    await navigator.share({
      title: "cmuGPT",
      text: "Chat on cmuGPT",
      url: shareUrl,
    });
    return "shared";
  } catch (e) {
    return e instanceof Error && e.name === "AbortError" ? "aborted" : "unsupported";
  }
}

export function scheduleShareFeedbackClear(ctx: ShareCtx): void {
  if (ctx.timerRef.current !== null) {
    clearTimeout(ctx.timerRef.current);
  }
  ctx.timerRef.current = setTimeout(() => {
    ctx.setShareFeedback(null);
    ctx.timerRef.current = null;
  }, 2200);
}

async function ensureChatPublic(ctx: ShareCtx, targetId: string, alreadyPublic: boolean) {
  if (alreadyPublic) {
    return true;
  }
  const ok = globalThis.confirm(
    "Anyone signed in to cmuGPT can open this chat with the link. Make this chat public and continue sharing?",
  );
  if (!ok) {
    return false;
  }
  try {
    await ctx.patchChat.mutateAsync({
      params: { path: { id: targetId } },
      body: { isPublic: true },
    });
    return true;
  } catch {
    return false;
  }
}

async function copyShareLink(ctx: ShareCtx, shareUrl: string) {
  try {
    await navigator.clipboard.writeText(shareUrl);
    ctx.setShareFeedback("copied");
  } catch {
    globalThis.prompt("Copy this link to share:", shareUrl);
    ctx.setShareFeedback(null);
    return;
  }
  scheduleShareFeedbackClear(ctx);
}

export async function shareChatById(ctx: ShareCtx, targetId: string, alreadyPublic: boolean) {
  if (typeof window === "undefined") {
    return;
  }
  if (!(await ensureChatPublic(ctx, targetId, alreadyPublic))) {
    return;
  }
  const shareUrl = buildShareUrl(targetId);
  const result = await tryNativeShare(shareUrl);
  if (result === "shared") {
    ctx.setShareFeedback("shared");
    scheduleShareFeedbackClear(ctx);
    return;
  }
  if (result === "aborted") {
    return;
  }
  await copyShareLink(ctx, shareUrl);
}

export async function shareCurrentChat(ctx: ShareCtx) {
  if (ctx.chatId === undefined || typeof window === "undefined") {
    return;
  }
  const detail = ctx.effectiveChatDetail;
  if (detail === undefined || !detail.isOwner) {
    return;
  }
  await shareChatById(ctx, ctx.chatId, detail.isPublic);
}

export function makeChatPrivate(ctx: ShareCtx) {
  if (ctx.chatId === undefined) {
    return;
  }
  ctx.patchChat.mutate({
    params: { path: { id: ctx.chatId } },
    body: { isPublic: false },
  });
}
