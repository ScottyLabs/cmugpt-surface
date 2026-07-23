import type { ChatShellController } from "../useChatShell.ts";
import { Composer } from "./Composer.tsx";

const SUGGESTIONS = [
  "What time does Hunan close today?",
  "Plan my Fall 26 schedule",
  "Navigate me from Tepper to Rotunda Hall",
];

export function WelcomeScreen({ c }: { c: ChatShellController }) {
  const { composer } = c;
  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto w-full">
      <div className="flex flex-col items-start gap-2">
        <h1 className="text-left text-[2.81rem] font-medium text-black leading-8">Hi there!</h1>
        <p className="text-left text-2xl font-medium text-black">Welcome to CMUGPT...</p>
      </div>
      <div className="flex flex-col max-w-3xl gap-[0.625rem] rounded-[1.875rem] bg-white px-6 py-4 shadow-[0_0_24px_0_var(--color-brandneutral-secondary-enabled),0_0_6px_0_rgba(158,177,194,0.55)]">
        <Composer
          c={c}
          rowClassName="flex items-end gap-2"
          textareaClassName="min-h-[7.625rem] max-h-40 flex-1 resize-none bg-transparent py-2 text-sm font-normal leading-snug text-neutral-900 outline-none placeholder:text-fg-neutral-secondary placeholder:font-normal disabled:opacity-50"
        />
      </div>
      <div className="flex justify-center items-center gap-3">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              composer.setDraft(s);
              composer.draftComposerRef.current?.focus();
            }}
            className="whitespace-nowrap flex items-center justify-center gap-2 rounded-[6.25rem] bg-neutral-secondary-enabled px-4 py-[0.5625rem] text-sm font-semibold text-fg-neutral-primary hover:bg-neutral-200 shadow-sm"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
