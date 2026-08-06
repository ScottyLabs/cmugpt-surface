/**
 * CMU tools the user can switch on and off from Settings.
 *
 * The `id` is what the server forwards to the agent as `disabled_tools`; the
 * agent drops every MCP tool named `<id>_*` before binding the toolset, so a
 * tool switched off here is genuinely uncallable rather than merely discouraged.
 */
export interface ChatToolOption {
  id: string;
  label: string;
}

export const CHAT_TOOLS: readonly ChatToolOption[] = [
  { id: "maps", label: "CMUMaps" },
  { id: "courses", label: "CMUCourses" },
  { id: "eats", label: "CMUEats" },
  { id: "guide", label: "CMUGuide" },
] as const;
