import type { Request as ExpressRequest } from "express";
import { Get, Request, Route, Security, SuccessResponse } from "tsoa";
import { ADMIN_SCOPE, BEARER_AUTH, OIDC_AUTH } from "../lib/authentication.ts";
import { helloService } from "../services/helloService.ts";

@Route("hello")
export class HelloController {
  @Get("/")
  @SuccessResponse(200)
  getHello(@Request() _req: ExpressRequest) {
    return helloService.hello();
  }

  @Security(OIDC_AUTH)
  @Security(BEARER_AUTH)
  @Get("/authenticated")
  @SuccessResponse(200)
  getHelloAuthenticated(@Request() req: ExpressRequest) {
    return helloService.helloAuthenticated(req.user as Express.User);
  }

  @Security(OIDC_AUTH, [ADMIN_SCOPE])
  @Security(BEARER_AUTH, [ADMIN_SCOPE])
  @Get("/admin")
  @SuccessResponse(200)
  getHelloAdmin(@Request() req: ExpressRequest) {
    return helloService.helloAdmin(req.user as Express.User);
  }
}
