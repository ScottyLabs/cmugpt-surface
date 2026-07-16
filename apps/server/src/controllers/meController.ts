import type { Request as ExpressRequest } from "express";
import {
  Body,
  Delete,
  Get,
  Patch,
  Path,
  Query,
  Request,
  Route,
  Security,
  SuccessResponse,
} from "tsoa";
import { CLERK_AUTH } from "../lib/authentication.ts";
import type { AgentModelOption } from "../lib/models.ts";
import { AGENT_MODELS } from "../lib/models.ts";
import { userIsOidcAdmin } from "../lib/oidcAdmin.ts";
import { AuthenticationError } from "../middlewares/errorHandler.ts";
import type {
  MemoryPageDto,
  MemoryTypeDto,
} from "../services/memoryService.ts";
import { memoryService } from "../services/memoryService.ts";
import type { UserPreferencesDto } from "../services/userPreferencesService.ts";
import { userPreferencesService } from "../services/userPreferencesService.ts";

export interface PatchUserPreferencesBody {
  preferredModel?: string;
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

@Route("me")
export class MeController {
  @Security(CLERK_AUTH)
  @Get("oidc-admin")
  @SuccessResponse(200)
  public getOidcAdminStatus(@Request() req: ExpressRequest): {
    isOidcAdmin: boolean;
  } {
    return { isOidcAdmin: userIsOidcAdmin(req.user) };
  }

  /** Curated list of LLM models the user can pick from. */
  @Security(CLERK_AUTH)
  @Get("models")
  @SuccessResponse(200)
  public listModels(): {
    models: AgentModelOption[];
  } {
    return { models: AGENT_MODELS.map((m) => ({ ...m })) };
  }

  /** Read the user's preferences (preferred model, etc.). */
  @Security(CLERK_AUTH)
  @Get("preferences")
  @SuccessResponse(200)
  public getPreferences(
    @Request() req: ExpressRequest,
  ): Promise<UserPreferencesDto> {
    return userPreferencesService.get(authenticatedSub(req));
  }

  /** Update the user's preferences. Only fields present in the body are changed. */
  @Security(CLERK_AUTH)
  @Patch("preferences")
  @SuccessResponse(200)
  public updatePreferences(
    @Request() req: ExpressRequest,
    @Body() body: PatchUserPreferencesBody,
  ): Promise<UserPreferencesDto> {
    return userPreferencesService.update(authenticatedSub(req), body);
  }

  /** Search the authenticated user's learned and explicitly remembered facts. */
  @Security(CLERK_AUTH)
  @Get("memories")
  @SuccessResponse(200)
  public listMemories(
    @Request() req: ExpressRequest,
    @Query() q?: string,
    @Query() kind?: MemoryTypeDto,
    @Query() limit = 200,
    @Query() offset = 0,
  ): Promise<MemoryPageDto> {
    return memoryService.list(authenticatedSub(req), {
      ...(q?.trim() && { q: q.trim() }),
      ...(kind && { kind }),
      limit: Math.min(Math.max(limit, 1), 200),
      offset: Math.max(offset, 0),
    });
  }

  /** Delete one learned or explicitly remembered fact. */
  @Security(CLERK_AUTH)
  @Delete("memories/{kind}/{id}")
  @SuccessResponse(200)
  public deleteMemory(
    @Request() req: ExpressRequest,
    @Path() kind: MemoryTypeDto,
    @Path() id: string,
  ): Promise<{ status: "deleted" }> {
    return memoryService.delete(authenticatedSub(req), kind, id);
  }

  /** Delete every learned and explicitly remembered fact for the user. */
  @Security(CLERK_AUTH)
  @Delete("memories")
  @SuccessResponse(200)
  public clearMemories(
    @Request() req: ExpressRequest,
  ): Promise<{ status: "cleared"; removed: number }> {
    return memoryService.clear(authenticatedSub(req));
  }
}
