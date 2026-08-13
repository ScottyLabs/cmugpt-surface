/** Resolve after `ms`, or immediately when the user prefers reduced motion,
 *  so exit animations get their duration without delaying anyone who has
 *  animations turned off. */
export async function waitForMotion(ms: number): Promise<void> {
  const reduceMotion =
    typeof globalThis.matchMedia === "function" &&
    globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;
  await new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}
