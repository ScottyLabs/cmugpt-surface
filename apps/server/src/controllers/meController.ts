import type { Request as ExpressRequest } from "express";
import { Get, Request, Route, Security, SuccessResponse } from "tsoa";
import { OIDC_OR_BEARER_AUTH } from "../lib/authentication.ts";
import { userIsOidcAdmin } from "../lib/oidcAdmin.ts";

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
}
