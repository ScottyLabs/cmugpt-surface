import type { Request, Response, Router } from "express";
import { requireOidcAuth } from "../lib/authentication.ts";
import { asyncHandler } from "../lib/asyncHandler.ts";
import {
  AuthenticationError,
  BadRequestError,
} from "../middlewares/errorHandler.ts";
import { chatService } from "../services/chatService.ts";
import type { SavedMemoryDto } from "../services/chatService.types.ts";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function pathParam(req: Request, name: string): string | undefined {
  const raw = req.params[name];
  if (typeof raw === "string") return raw;
  return Array.isArray(raw) ? raw[0] : undefined;
}

/** Parse the body into a saved-memory payload, or null to clear the chip. */
function parseSavedMemory(body: unknown): SavedMemoryDto | null {
  if (!isRecord(body)) return null;
  const { id, kind, fact } = body;
  if (
    typeof id === "string" &&
    id !== "" &&
    (kind === "learned" || kind === "remembered") &&
    typeof fact === "string" &&
    fact !== ""
  ) {
    return { id, kind, fact };
  }
  return null;
}

async function handleSetSavedMemory(
  req: Request,
  res: Response,
): Promise<void> {
  const chatId = pathParam(req, "id");
  const messageId = pathParam(req, "messageId");
  if (chatId === undefined || chatId === "" || messageId === undefined || messageId === "") {
    throw new BadRequestError("Chat id and message id are required");
  }
  const userSub = req.user?.sub;
  if (userSub === undefined || userSub === "") {
    throw new AuthenticationError("req.user.sub missing after requireOidcAuth");
  }
  await chatService.setMessageSavedMemory(
    chatId,
    userSub,
    messageId,
    parseSavedMemory(req.body),
  );
  res.status(204).end();
}

export function registerMessageSavedMemoryRoute(router: Router): void {
  router.put(
    "/chats/:id/messages/:messageId/saved-memory",
    requireOidcAuth,
    asyncHandler(handleSetSavedMemory),
  );
}
