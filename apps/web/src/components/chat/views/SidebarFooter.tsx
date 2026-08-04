import { AboutIcon, LogOutIcon, ScottyLabsIcon, SettingsIcon } from "@/components/icons/index.tsx";
import type { ChatShellController } from "../useChatShell.ts";

function SidebarUserMenu({ c }: { c: ChatShellController }) {
  const { modal, sidebar, auth } = c;
  return (
    <div className="absolute bottom-full mb-2 flex w-[14.5625rem] px-2 flex-col items-start rounded-xl bg-white shadow-[0_0_5.7px_0_rgba(158,177,194,0.29)] py-2 left-1/2 -translate-x-1/2">
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
  );
}

export function SidebarFooter({ c }: { c: ChatShellController }) {
  const { sidebarOpen, sidebar, derived, auth } = c;
  return (
    <div className="mt-auto p-4 relative">
      {sidebarOpen && <div className="mb-3 border-b border-fg-disabled-brandneutral" />}
      {sidebar.userMenuOpen && <SidebarUserMenu c={c} />}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          sidebar.setUserMenuOpen((o) => !o);
        }}
        className={`flex w-full items-center px-2 ${sidebarOpen ? "gap-3" : "justify-center"}`}
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
