export function StreamingStatus({ text }: { text: string }) {
  const label = text.replace(/\.+$/u, "");
  return (
    <output
      aria-live="polite"
      aria-label={text}
      className="-mt-1 block font-normal text-neutral-400 text-sm leading-relaxed motion-safe:animate-pulse"
    >
      {label}
    </output>
  );
}
