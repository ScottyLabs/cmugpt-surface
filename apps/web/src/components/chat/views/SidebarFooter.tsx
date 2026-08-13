import { Brain } from "lucide-react";
import {
  AboutIcon,
  LogOutIcon,
  ScottyLabsIcon,
  SettingsIcon,
} from "@/components/icons/index.tsx";
import type { ChatShellController } from "../useChatShell.ts";

const MENU_ROW_CLASS = "flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-neutral-50";

function menuEntries(c: ChatShellController) {
  const { modal, memory } = c;
  return [
    {
      label: "Memories",
      icon: <Brain className="h-4 w-4" />,
      run: () => {
        memory.openManager();
      },
    },
    {
      label: "Settings",
      icon: <SettingsIcon />,
      run: () => {
        modal.setActiveModal("settings");
      },
    },
    {
      label: "About",
      icon: <AboutIcon />,
      run: () => {
        modal.setActiveModal("about");
      },
    },
  ];
}

function SidebarMenuItems({ c }: { c: ChatShellController }) {
  const { sidebar, auth } = c;
  const entries = menuEntries(c);
  return (
    <div className="flex w-full flex-col items-start px-2 py-2">
      {entries.map((entry) => (
        <button
          key={entry.label}
          type="button"
          onClick={() => {
            entry.run();
            sidebar.setUserMenuOpen(false);
          }}
          className={MENU_ROW_CLASS}
        >
          {entry.icon}
          {entry.label}
        </button>
      ))}
      <a
        href="https://scottylabs.org/"
        target="_blank"
        rel="noreferrer"
        className={MENU_ROW_CLASS}
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
        className={`${MENU_ROW_CLASS} text-neutral-700`}
      >
        <LogOutIcon />
        Log out
      </button>
    </div>
  );
}

function SidebarUserMenu({ c }: { c: ChatShellController }) {
  const { sidebar, sidebarOpen } = c;
  const placement = sidebarOpen ? "inset-x-4" : "left-2 w-60";
  const state = sidebar.userMenuOpen
    ? "visible grid-rows-[1fr]"
    : "invisible grid-rows-[0fr]";
  return (
    <div
      className={`absolute bottom-full mb-1.5 grid content-end transition-[grid-template-rows,visibility] duration-200 ease-out ${placement} ${state}`}
    >
      <div className="flex min-h-0 flex-col justify-end overflow-hidden rounded-xl bg-white shadow-[0_2px_12px_0_rgba(158,177,194,0.45)]">
        <SidebarMenuItems c={c} />
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
        ref={c.memory.userMenuTriggerRef}
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
