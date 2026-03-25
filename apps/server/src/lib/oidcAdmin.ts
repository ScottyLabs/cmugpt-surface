import { env } from "../env.ts";
import { AuthorizationError } from "../middlewares/errorHandler.ts";

export function userIsOidcAdmin(user: Express.User | undefined): boolean {
  const required = env.ADMIN_GROUP.trim();
  if (!required) {
    return false;
  }
  const groups = user?.groups;
  console.log("groups", groups);
  if (!groups || groups.length === 0) {
    return false;
  }
  return groups.includes(required);
}

export function assertOidcAdmin(user: Express.User | undefined): void {
  if (!userIsOidcAdmin(user)) {
    throw new AuthorizationError(
      "You do not have permission to manage custom LLM settings.",
    );
  }
}
