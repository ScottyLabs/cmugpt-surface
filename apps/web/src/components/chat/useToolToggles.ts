import { useState } from "react";

/** Which CMU tools the assistant may use, held per browser session.
 *
 * The list of switched-off ids rides along with every message send, so the
 * agent applies the current state to the turn the user is asking about.
 */
export function useToolToggles() {
  const [disabledToolIds, setDisabledToolIds] = useState<string[]>([]);

  function isEnabled(id: string): boolean {
    return !disabledToolIds.includes(id);
  }

  function toggle(id: string): void {
    setDisabledToolIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  }

  return { disabledToolIds, isEnabled, toggle };
}

export type ToolToggles = ReturnType<typeof useToolToggles>;
