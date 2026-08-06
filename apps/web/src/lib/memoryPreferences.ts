export const SKIP_DELETE_CONFIRMATION_KEY =
  "cmugpt.memory.skip-delete-confirmation";

// Scoped per user so the preference cannot leak between accounts on a
// shared device.
function storageKey(userSub: string | undefined): string {
  return userSub
    ? `${SKIP_DELETE_CONFIRMATION_KEY}.${userSub}`
    : SKIP_DELETE_CONFIRMATION_KEY;
}

export function shouldSkipDeleteConfirmation(userSub?: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(storageKey(userSub)) === "true";
  } catch {
    return false;
  }
}

export function rememberDeleteConfirmationPreference(userSub?: string): void {
  try {
    window.localStorage.setItem(storageKey(userSub), "true");
  } catch {
    // Storage can be unavailable in privacy mode. The deletion still works.
  }
}
