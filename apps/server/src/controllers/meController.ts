import type { Request as ExpressRequest } from "express";
import { Body, Get, Patch, Request, Route, Security, SuccessResponse } from "tsoa";
import { OIDC_AUTH } from "../lib/authentication.ts";
import type { AgentModelOption } from "../lib/models.ts";
import { AGENT_MODELS } from "../lib/models.ts";
import { userIsOidcAdmin } from "../lib/oidcAdmin.ts";
import { AuthenticationError } from "../middlewares/errorHandler.ts";
import type { UserPreferencesDto } from "../services/userPreferencesService.ts";
import { userPreferencesService } from "../services/userPreferencesService.ts";

export interface PatchUserPreferencesBody {
  preferredModel?: string;
}

function authenticatedSub(req: ExpressRequest): string {
  const sub = req.user?.sub;
  if (!sub) {
    throw new AuthenticationError("req.user.sub missing after security middleware (unexpected)");
  }
  return sub;
}

@Route("me")
export class MeController {
  @Security(OIDC_AUTH)
  @Get("oidc-admin")
  @SuccessResponse(200)
  public getOidcAdminStatus(@Request() req: ExpressRequest): {
    isOidcAdmin: boolean;
  } {
    return { isOidcAdmin: userIsOidcAdmin(req.user) };
  }

  /** Curated list of LLM models the user can pick from. */
  @Security(OIDC_AUTH)
  @Get("models")
  @SuccessResponse(200)
  public listModels(): {
    models: AgentModelOption[];
  } {
    return { models: AGENT_MODELS.map((m) => ({ ...m })) };
  }

  /** Read the user's preferences (preferred model, etc.). */
  @Security(OIDC_AUTH)
  @Get("preferences")
  @SuccessResponse(200)
  public getPreferences(@Request() req: ExpressRequest): Promise<UserPreferencesDto> {
    return userPreferencesService.get(authenticatedSub(req));
  }

  /** Update the user's preferences. Only fields present in the body are changed. */
  @Security(OIDC_AUTH)
  @Patch("preferences")
  @SuccessResponse(200)
  public updatePreferences(
    @Request() req: ExpressRequest,
    @Body() body: PatchUserPreferencesBody,
  ): Promise<UserPreferencesDto> {
    return userPreferencesService.update(authenticatedSub(req), body);
  }
}
