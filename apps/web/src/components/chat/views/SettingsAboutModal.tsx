import { useEffect } from "react";
import { CloseIcon } from "@/components/icons/index.tsx";
import type { ChatShellController } from "../useChatShell.ts";
import { SettingsPanel } from "./SettingsPanel.tsx";

function AboutPanel() {
  return (
    <>
      <div className="space-y-3 px-4 text-left text-sm font-normal leading-relaxed text-black">
        <p>
          CMUGPT is an AI assistant made by ScottyLabs for the Carnegie Mellon
          community. Ask it everyday campus questions, like how to get to class,
          what&apos;s open for lunch, or which course to take next.
        </p>
        <p>
          It taps into campus knowledge through MCP tools: CMUMaps for
          directions, CMUCourses for courses, CMUEats for dining, and CMUGuide
          for student resources. Each can be turned on or off in Settings, and
          CMUGPT remembers details you share so future chats feel more personal.
        </p>
      </div>
      <div className="mt-8 flex items-center justify-end gap-2 mr-4">
        <p className="text-base font-medium text-black">With love,</p>
        <button
          type="button"
          className="rounded-[6.25rem] px-3.5 py-1"
          style={{
            background: "white",
            border: "2px solid transparent",
            backgroundImage:
              "linear-gradient(white, white), linear-gradient(to bottom, #2B0D77, #29DAFA, #29DAFA, #FC1833)",
            backgroundOrigin: "border-box",
            backgroundClip: "padding-box, border-box",
          }}
        >
          <span className="text-sm font-semibold text-fg-neutral-primary">
            ScottyLabs
          </span>
        </button>
      </div>
    </>
  );
}

function useCloseOnEscape(isOpen: boolean, close: () => void): void {
  useEffect(() => {
    if (!isOpen) {
      return () => {};
    }
    function onKeyDown(ev: KeyboardEvent) {
      if (ev.key === "Escape") {
        close();
      }
    }
    globalThis.addEventListener("keydown", onKeyDown);
    return () => {
      globalThis.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, close]);
}

function ModalHeader(
  { isSettings, onClose }: { isSettings: boolean; onClose: () => void },
) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-2xl pt-4 pl-4 font-medium leading-8">
        {isSettings ? "Settings" : "About CMUGPT"}
      </h2>
      <button type="button" onClick={onClose}>
        <CloseIcon />
      </button>
    </div>
  );
}

export function SettingsAboutModal({ c }: { c: ChatShellController }) {
  const { modal } = c;
  const close = () => {
    modal.setActiveModal(null);
  };
  useCloseOnEscape(modal.activeModal !== null, close);

  if (modal.activeModal === null) {
    return null;
  }
  const isSettings = modal.activeModal === "settings";
  return (
    <button
      type="button"
      aria-label="Close modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(245,245,245,0.75)] backdrop-blur-[3.55px] w-full px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          close();
        }
      }}
    >
      <dialog
        open
        className={`relative w-[45.5625rem] max-w-full max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-4 sm:p-6 shadow-[0_2px_6px_0_rgba(0,0,0,0.20)] ${
          isSettings ? "sm:h-[15rem]" : ""
        }`}
      >
        <ModalHeader isSettings={isSettings} onClose={close} />
        {isSettings ? <SettingsPanel c={c} /> : <AboutPanel />}
      </dialog>
    </button>
  );
}
