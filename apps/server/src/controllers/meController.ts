import type { Request as ExpressRequest } from "express";
import {
  Body,
  Get,
  Patch,
  Request,
  Route,
  Security,
  SuccessResponse,
} from "tsoa";
import { OIDC_OR_BEARER_AUTH } from "../lib/authentication.ts";
import { assertOidcAdmin, userIsOidcAdmin } from "../lib/oidcAdmin.ts";
import { AuthenticationError } from "../middlewares/errorHandler.ts";
import type {
  CustomLlmSettingsDto,
  PatchCustomLlmBody,
} from "../services/userCustomLlmService.ts";
import { userCustomLlmService } from "../services/userCustomLlmService.ts";

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
  @Security(OIDC_OR_BEARER_AUTH)
  @Get("oidc-admin")
  @SuccessResponse(200)
  public getOidcAdminStatus(@Request() req: ExpressRequest): {
    isOidcAdmin: boolean;
  } {
    return { isOidcAdmin: userIsOidcAdmin(req.user) };
  }

  @Security(OIDC_OR_BEARER_AUTH)
  @Get("custom-llm")
  @SuccessResponse(200)
  public getCustomLlmSettings(
    @Request() req: ExpressRequest,
  ): Promise<CustomLlmSettingsDto> {
    assertOidcAdmin(req.user);
    return userCustomLlmService.getSettings(authenticatedSub(req));
  }

  @Security(OIDC_OR_BEARER_AUTH)
  @Patch("custom-llm")
  @SuccessResponse(200)
  public patchCustomLlmSettings(
    @Request() req: ExpressRequest,
    @Body() body: PatchCustomLlmBody,
  ): Promise<CustomLlmSettingsDto> {
    assertOidcAdmin(req.user);
    return userCustomLlmService.patchSettings(authenticatedSub(req), body);
  }
}
