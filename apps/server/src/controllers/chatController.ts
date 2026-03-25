import type { Request as ExpressRequest } from "express";
import {
  Body,
  Delete,
  Get,
  Patch,
  Path,
  Post,
  Query,
  Request,
  Route,
  Security,
  SuccessResponse,
} from "tsoa";
import { BEARER_AUTH, OIDC_AUTH } from "../lib/authentication.ts";
import { AuthenticationError } from "../middlewares/errorHandler.ts";
import type {
  ChatDetailDto,
  ChatListItemDto,
  MessageDto,
  PostMessageResultDto,
} from "../services/chatService.ts";
import { chatService } from "../services/chatService.ts";

export interface PostChatMessageBody {
  content: string;
}

export interface PatchChatBody {
  starred?: boolean;
  title?: string;
  isPublic?: boolean;
}

function authenticatedSub(req: ExpressRequest): string {
  const sub = req.user?.sub;
  if (!sub) {
    throw new AuthenticationError(
      "req.user.sub missing after security middleware (unexpected)",
    );
  }
  return sub;
}

@Route("chats")
export class ChatController {
  @Security(OIDC_AUTH)
  @Security(BEARER_AUTH)
  @Get("/")
  @SuccessResponse(200)
  public listChats(
    @Request() req: ExpressRequest,
    @Query() q?: string,
  ): Promise<ChatListItemDto[]> {
    return chatService.listChats(authenticatedSub(req), q);
  }

  @Security(OIDC_AUTH)
  @Security(BEARER_AUTH)
  @Post("/")
  @SuccessResponse(201)
  public createChat(@Request() req: ExpressRequest): Promise<ChatListItemDto> {
    return chatService.createChat(authenticatedSub(req));
  }

  @Security(OIDC_AUTH)
  @Security(BEARER_AUTH)
  @Get("{id}/messages")
  @SuccessResponse(200)
  public getMessages(
    @Request() req: ExpressRequest,
    @Path() id: string,
  ): Promise<MessageDto[]> {
    return chatService.getMessages(id, authenticatedSub(req));
  }

  @Security(OIDC_AUTH)
  @Security(BEARER_AUTH)
  @Get("{id}")
  @SuccessResponse(200)
  public getChat(
    @Request() req: ExpressRequest,
    @Path() id: string,
  ): Promise<ChatDetailDto> {
    return chatService.getChat(id, authenticatedSub(req));
  }

  @Security(OIDC_AUTH)
  @Security(BEARER_AUTH)
  @Post("{id}/messages")
  @SuccessResponse(200)
  public postMessage(
    @Request() req: ExpressRequest,
    @Path() id: string,
    @Body() body: PostChatMessageBody,
  ): Promise<PostMessageResultDto> {
    return chatService.postMessage(id, authenticatedSub(req), body.content);
  }

  @Security(OIDC_AUTH)
  @Security(BEARER_AUTH)
  @Patch("{id}")
  @SuccessResponse(200)
  public patchChat(
    @Request() req: ExpressRequest,
    @Path() id: string,
    @Body() body: PatchChatBody,
  ): Promise<ChatListItemDto> {
    return chatService.patchChat(id, authenticatedSub(req), body);
  }

  @Security(OIDC_AUTH)
  @Security(BEARER_AUTH)
  @Delete("{id}")
  @SuccessResponse(204)
  public deleteChat(
    @Request() req: ExpressRequest,
    @Path() id: string,
  ): Promise<void> {
    return chatService.deleteChat(id, authenticatedSub(req));
  }
}
