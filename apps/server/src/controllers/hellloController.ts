import type { Request as ExpressRequest } from "express";
import { Get, Request, Route, Security, SuccessResponse } from "tsoa";
import { OIDC_AUTH } from "../lib/authentication.ts";
import { AuthenticationError } from "../middlewares/errorHandler.ts";
import { helloService } from "../services/helloService.ts";

function authenticatedUser(req: ExpressRequest): Express.User {
  if (!req.user) {
    throw new AuthenticationError("req.user missing after security middleware (unexpected)");
  }
  return req.user;
}

@Route("hello")
export class HelloController {
  @Get("/")
  @SuccessResponse(200)
  getHello(@Request() _req: ExpressRequest) {
    return helloService.hello();
  }

  @Security(OIDC_AUTH)
  @Get("/authenticated")
  @SuccessResponse(200)
  getHelloAuthenticated(@Request() req: ExpressRequest) {
    return helloService.helloAuthenticated(authenticatedUser(req));
  }

  @Security(OIDC_AUTH)
  @Get("/admin")
  @SuccessResponse(200)
  getHelloAdmin(@Request() req: ExpressRequest) {
    return helloService.helloAdmin(authenticatedUser(req));
  }
}
