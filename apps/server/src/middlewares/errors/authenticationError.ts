import { HttpError } from "./httpError.ts";

export class AuthenticationError extends HttpError {
  /** Set for server logs only; never included in JSON responses. */
  readonly authDebugReason?: string;

  constructor(authDebugReason?: string) {
    super(401, "Unauthenticated");
    if (authDebugReason !== undefined) {
      this.authDebugReason = authDebugReason;
    }
  }
}
