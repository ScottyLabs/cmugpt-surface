import type { NextFunction, Request, Response, Router } from "express";
import { requireOidcAuth } from "../lib/authentication.ts";
import { asyncHandler } from "../lib/asyncHandler.ts";
import { AuthenticationError, BadRequestError } from "../middlewares/errorHandler.ts";
import { chatService } from "../services/chatService.ts";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function resolveChatId(req: Request): string | undefined {
  const rawChatId = req.params["id"];
  if (typeof rawChatId === "string") return rawChatId;
  return Array.isArray(rawChatId) ? rawChatId[0] : undefined;
}

function resolveMessageContent(req: Request): string {
  const body: unknown = req.body;
  return isRecord(body) && typeof body["content"] === "string" ? body["content"] : "";
}

async function streamChatResponse(
  chatId: string,
  userSub: string,
  content: string,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const ac = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) {
      ac.abort();
    }
  });

  let wrote = false;
  try {
    for await (const ev of chatService.postMessageStream(chatId, userSub, content, {
      signal: ac.signal,
    })) {
      if (!wrote) {
        res.status(200);
        res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders();
        wrote = true;
      }
      res.write(`${JSON.stringify(ev)}\n`);
    }
  } catch (e) {
    if (!wrote) {
      next(e);
      return;
    }
    const msg = e instanceof Error ? e.message : "Stream failed";
    res.write(`${JSON.stringify({ type: "error", message: msg })}\n`);
  }

  if (wrote) {
    res.end();
  }
}

async function handleChatMessageStream(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const chatId = resolveChatId(req);
  if (chatId === undefined || chatId === "") {
    next(new BadRequestError("Chat id is required"));
    return;
  }
  const userSub = req.user?.sub;
  if (userSub === undefined || userSub === "") {
    next(
      new AuthenticationError("stream: req.user.sub missing after requireOidcAuth (unexpected)"),
    );
    return;
  }

  const content = resolveMessageContent(req);
  if (!content.trim()) {
    next(new BadRequestError("Message content is required"));
    return;
  }

  await streamChatResponse(chatId, userSub, content, res, next);
}

export function registerChatMessageStreamRoute(router: Router): void {
  router.post("/chats/:id/messages/stream", requireOidcAuth, asyncHandler(handleChatMessageStream));
}
