import { useMemo } from "react";
import type { ChatShellController } from "../useChatShell.ts";
import { Composer } from "./Composer.tsx";

// Rotating CMU / ScottyLabs flavored greetings (no em dashes). One is picked at
// random each time the new-chat screen mounts.
const NAMED_GREETINGS: ((name: string) => string)[] = [
  (n) => `Hi ${n}, where are we headed on campus?`,
  (n) => `Ready when you are, ${n}.`,
  (n) => `What do you need on campus today, ${n}?`,
  (n) => `Hey ${n}, ask me anything about CMU.`,
  (n) => `Lost on campus, ${n}? I've got you.`,
  (n) => `Let's find your way around CMU, ${n}.`,
  (n) => `Good to see you, ${n}. What's the plan?`,
];

const ANON_GREETINGS: string[] = [
  "What can I help you find on campus?",
  "Ask me anything about CMU.",
  "Where are we headed on campus today?",
];

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

/** Centered greeting with the composer vertically centered on screen and the
 *  greeting floating just above it (the conversation footer composer is hidden
 *  in this state). */
export function WelcomeScreen({ c }: { c: ChatShellController }) {
  const name = c.derived.displayName;
  const firstName = name.includes("@") ? "" : name.split(" ")[0];
  const greeting = useMemo(
    () => (firstName ? pick(NAMED_GREETINGS)(firstName) : pick(ANON_GREETINGS)),
    [firstName],
  );
  return (
    <div className="relative mx-auto w-full max-w-[48.25rem] -translate-y-6">
      <h1 className="absolute inset-x-0 bottom-full mb-8 text-center text-xl font-medium text-black sm:text-2xl">
        {greeting}
      </h1>
      <Composer c={c} />
    </div>
  );
}
