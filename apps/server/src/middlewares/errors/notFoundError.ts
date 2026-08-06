import { HttpError } from "./httpError.ts";

export class NotFoundError extends HttpError {
  constructor(message = "Not found") {
    super(404, message);
  }
}
