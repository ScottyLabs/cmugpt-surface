import { HttpError } from "./httpError.ts";

export class InternalServerError extends HttpError {
  constructor(message: string) {
    super(500, message);
  }
}
