import { useEffect, useRef, useState } from "react";

/** Chat title that wipes in from the left whenever the text changes.
 *
 * New chats are named "New chat" until the generated title lands a moment
 * later; animating that swap keeps it from reading as a glitch. The revision
 * counter is used as a key so the span remounts and the CSS animation
 * replays; revision 0 is the first paint, which must not animate. */
export function AnimatedTitle({ title, className = "" }: { title: string; className?: string }) {
  const [revision, setRevision] = useState(0);
  const previousTitleRef = useRef(title);

  useEffect(() => {
    if (previousTitleRef.current !== title) {
      previousTitleRef.current = title;
      setRevision((r) => r + 1);
    }
  }, [title]);

  return (
    <span key={revision} className={revision > 0 ? `chat-title-in ${className}` : className}>
      {title}
    </span>
  );
}
