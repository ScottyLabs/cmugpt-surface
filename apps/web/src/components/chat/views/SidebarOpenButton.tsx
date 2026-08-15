import { SidebarPanelIcon } from "@/components/icons/index.tsx";
import type { ChatShellController } from "../useChatShell.ts";

/** Opens the sidebar. Shows the ScottyLabs dog logo; on hover the dog slides
 *  up out of the (clipped) button while the menu icon slides in from below.
 *  No fade: both icons stay opaque, the masked slide does the swap. */
export function SidebarOpenButton({
  c,
  className = "",
}: {
  c: ChatShellController;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        c.setSidebarOpen(true);
      }}
      className={`group relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg transition-colors hover:bg-neutral-200/80 ${className}`}
      aria-label="Open sidebar"
    >
      <img
        src="/sl-logo.svg"
        alt=""
        width={24}
        height={24}
        className="h-6 w-6 object-contain transition-transform duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] group-hover:-translate-y-9"
      />
      <SidebarPanelIcon className="absolute translate-y-9 transition-transform duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] group-hover:translate-y-0" />
    </button>
  );
}
