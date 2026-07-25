import type { ReactNode } from "react";
import { CheckIcon, DownArrowIcon } from "@/components/icons/index.tsx";
import { CmuMapsIcon } from "@/components/icons/CmuMapsIcon.tsx";
import type { ChatShellController } from "../useChatShell.ts";

const LANG_OPTIONS = [
  { id: "auto-detect", label: "Auto-detect" },
  { id: "english-us", label: "English (US)" },
];

function LanguageSelect({ c }: { c: ChatShellController }) {
  const { modal } = c;
  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          modal.setLangOpen((o) => !o);
        }}
        className="flex items-center gap-2 text-sm font-medium text-black"
      >
        {modal.lang}
        <DownArrowIcon />
      </button>
      {modal.langOpen && (
        <div className="absolute right-0 top-full mt-2 z-50 w-[14.5625rem] rounded-[0.75rem] bg-white shadow-[0_0_5.7px_0_rgba(158,177,194,0.29)] overflow-y-auto py-2">
          {LANG_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                modal.setLang(option.label);
                modal.setLangOpen(false);
              }}
              className="flex px-4 py-2 w-full items-center justify-between text-black text-xs font-medium text-left hover:bg-neutral-50"
            >
              {option.label}
              {modal.lang === option.label && <CheckIcon />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ToolToggleButton(
  { label, disabled, onToggle, children }: {
    label: string;
    disabled: boolean;
    onToggle: () => void;
    children: ReactNode;
  },
) {
  return (
    <button
      type="button"
      className={`flex items-center justify-center gap-[0.375rem] rounded-[6.25rem] px-3.5 py-1.5 text-xs font-medium bg-neutral-secondary-enabled ${
        disabled ? "text-fg-disabled-neutral" : "text-fg-neutral-primary"
      }`}
      onClick={onToggle}
    >
      {children}
      {label}
    </button>
  );
}

function ToolToggles({ c }: { c: ChatShellController }) {
  const { modal } = c;
  return (
    <div className="flex gap-4 flex-wrap">
      <ToolToggleButton
        label="CMUMaps"
        disabled={modal.mapsIsDisabled}
        onToggle={() => {
          modal.setMapsIsDisabled((o) => !o);
        }}
      >
        <CmuMapsIcon
          className={`shrink-0 w-auto ${modal.mapsIsDisabled ? "opacity-55" : "opacity-100"}`}
        />
      </ToolToggleButton>
      <ToolToggleButton
        label="CMUCourses"
        disabled={modal.coursesIsDisabled}
        onToggle={() => {
          modal.setCoursesIsDisabled((o) => !o);
        }}
      >
        <img
          src="/cmucoursesicon.png"
          alt=""
          className={`h-[1.0625rem] w-[1.125rem] shrink-0 rounded-[0.25rem] object-contain ${
            modal.coursesIsDisabled ? "opacity-55" : "opacity-100"
          }`}
        />
      </ToolToggleButton>
      <ToolToggleButton
        label="CMUEats"
        disabled={modal.eatsIsDisabled}
        onToggle={() => {
          modal.setEatsIsDisabled((o) => !o);
        }}
      >
        <img
          src="/cmueatsicon.png"
          alt=""
          className={`h-[1.3125rem] w-[1.3125rem] shrink-0 object-contain ${
            modal.eatsIsDisabled ? "opacity-55" : "opacity-100"
          }`}
        />
      </ToolToggleButton>
    </div>
  );
}

export function SettingsPanel({ c }: { c: ChatShellController }) {
  return (
    <div className="flex flex-col gap-6 px-2 pt-2">
      <div className="flex flex-col gap-4">
        <div className="pl-4 flex items-center justify-between">
          <span className="text-sm font-medium text-black">Language</span>
          <LanguageSelect c={c} />
        </div>
        <div className="ml-4 border-b border-fg-disabled-brandneutral" />
      </div>
      <div className="flex flex-col gap-4 pl-4">
        <p className="text-left text-sm font-medium text-black">Tools</p>
        <ToolToggles c={c} />
      </div>
    </div>
  );
}
