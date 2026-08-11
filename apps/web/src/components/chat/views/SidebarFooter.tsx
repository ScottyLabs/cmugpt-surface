import {
  AboutIcon,
  LogOutIcon,
  ScottyLabsIcon,
  SettingsIcon,
} from "@/components/icons/index.tsx";
import type { ChatShellController } from "../useChatShell.ts";

function SidebarUserMenu({ c }: { c: ChatShellController }) {
  const { modal, sidebar, auth, sidebarOpen } = c;

  const placement = sidebarOpen ? "inset-x-4" : "left-2 w-60";
  const state = sidebar.userMenuOpen
    ? "visible grid-rows-[1fr]"
    : "invisible grid-rows-[0fr]";
  return (
    <div
      className={`absolute bottom-full mb-1.5 grid content-end transition-[grid-template-rows,visibility] duration-200 ease-out ${placement} ${state}`}
    >
      <div className="flex min-h-0 flex-col justify-end overflow-hidden rounded-xl bg-white shadow-[0_2px_12px_0_rgba(158,177,194,0.45)]">
        <div className="flex w-full flex-col items-start px-2 py-2">
          <button
            type="button"
            onClick={() => {
              modal.setActiveModal("settings");
              sidebar.setUserMenuOpen(false);
            }}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-neutral-50"
          >
            <SettingsIcon />
            Settings
          </button>
          <button
            type="button"
            onClick={() => {
              modal.setActiveModal("about");
              sidebar.setUserMenuOpen(false);
            }}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-neutral-50"
          >
            <AboutIcon />
            About
          </button>
          <a
            href="https://scottylabs.org/"
            target="_blank"
            rel="noreferrer"
            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-neutral-50"
          >
            <ScottyLabsIcon />
            ScottyLabs
          </a>
          <div className="self-center w-[90%] my-3 border-b border-fg-disabled-brandneutral" />
          <button
            type="button"
            onClick={() => {
              auth.logout();
            }}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50"
          >
            <LogOutIcon />
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}

export function SidebarFooter({ c }: { c: ChatShellController }) {
  const { sidebarOpen, sidebar, derived, auth } = c;
  return (
    <div className="mt-auto p-2.5 relative">
      <SidebarUserMenu c={c} />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          sidebar.setUserMenuOpen((o) => !o);
        }}
        className={`flex w-full items-center px-2 ${
          sidebarOpen ? "gap-3" : "justify-center"
        }`}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-300">
          <span>{derived.displayName.slice(0, 1).toUpperCase()}</span>
        </div>
        {sidebarOpen && (
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate font-medium">{derived.displayName}</p>
            <p className="truncate text-sm text-fg-neutral-tertiary hover:text-neutral-800">
              {auth.user?.email}
            </p>
          </div>
        )}
      </button>
    </div>
  );
}
