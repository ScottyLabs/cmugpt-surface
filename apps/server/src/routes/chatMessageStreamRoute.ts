import type { NextFunction, Request, Response, Router } from "express";
import { requireOidcOrBearer } from "../lib/authentication.ts";
import {
  AuthenticationError,
  BadRequestError,
} from "../middlewares/errorHandler.ts";
import { chatService } from "../services/chatService.ts";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export function registerChatMessageStreamRoute(router: Router): void {
  router.post(
    "/chats/:id/messages/stream",
    requireOidcOrBearer,
    async (req: Request, res: Response, next: NextFunction) => {
      const rawChatId = req.params["id"];
      const chatId =
        typeof rawChatId === "string"
          ? rawChatId
          : Array.isArray(rawChatId)
            ? rawChatId[0]
            : undefined;
      if (!chatId) {
        next(new BadRequestError("Chat id is required"));
        return;
      }
      const userSub = req.user?.sub;
      if (!userSub) {
        next(
          new AuthenticationError(
            "stream: req.user.sub missing after requireOidcOrBearer (unexpected)",
          ),
        );
        return;
      }

      const { body } = req;
      const content =
        isRecord(body) && typeof body["content"] === "string"
          ? body["content"]
          : "";

      if (!content.trim()) {
        next(new BadRequestError("Message content is required"));
        return;
      }

      const ac = new AbortController();
      req.on("close", () => {
        ac.abort();
      });

      let wrote = false;
      try {
        for await (const ev of chatService.postMessageStream(
          chatId,
          userSub,
          content,
          { signal: ac.signal },
        )) {
          if (!wrote) {
            res.status(200);
            res.setHeader(
              "Content-Type",
              "application/x-ndjson; charset=utf-8",
            );
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
    },
  );
}
