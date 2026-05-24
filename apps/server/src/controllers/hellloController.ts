import type { Request as ExpressRequest } from "express";
import { Get, Request, Route, Security, SuccessResponse } from "tsoa";
import { CLERK_AUTH } from "../lib/authentication.ts";
import { helloService } from "../services/helloService.ts";

@Route("hello")
export class HelloController {
  @Get("/")
  @SuccessResponse(200)
  getHello(@Request() _req: ExpressRequest) {
    return helloService.hello();
  }

  @Security(CLERK_AUTH)
  @Get("/authenticated")
  @SuccessResponse(200)
  getHelloAuthenticated(@Request() req: ExpressRequest) {
    return helloService.helloAuthenticated(req.user as Express.User);
  }

  @Security(CLERK_AUTH)
  @Get("/admin")
  @SuccessResponse(200)
  getHelloAdmin(@Request() req: ExpressRequest) {
    return helloService.helloAdmin(req.user as Express.User);
  }
}
