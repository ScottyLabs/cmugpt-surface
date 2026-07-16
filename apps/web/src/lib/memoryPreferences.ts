export const SKIP_DELETE_CONFIRMATION_KEY =
  "cmugpt.memory.skip-delete-confirmation";

export function shouldSkipDeleteConfirmation(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SKIP_DELETE_CONFIRMATION_KEY) === "true";
  } catch {
    return false;
  }
}

export function rememberDeleteConfirmationPreference(): void {
  try {
    window.localStorage.setItem(SKIP_DELETE_CONFIRMATION_KEY, "true");
  } catch {
    // Storage can be unavailable in privacy mode. The deletion still works.
  }
}
